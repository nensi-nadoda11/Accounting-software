import { db } from "../../db";
import { auditLogService } from "../audit-logs/audit-log.service";
import { accountingService } from "../accounting/accounting.service";
import { companyRepository } from "../company/company.repository";
import { customersRepository } from "../customers/customers.repository";
import { emailService } from "../../services/email.service";
import {
  addDecimals,
  compareDecimals,
  normalizeMoney as normalizeMoneyValue,
  subtractDecimals
} from "../inventory/inventory.utils";
import { salesRepository } from "../sales/sales.repository";
import { calculateDueAmount as calculateSalesDueAmount, calculatePaymentStatus as calculateSalesInvoicePaymentStatus } from "../sales/sales.calculation";
import { suppliersRepository } from "../suppliers/suppliers.repository";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { purchasesRepository } from "../purchases/purchases.repository";
import {
  calculateDueAmount as calculatePurchaseDueAmount,
  calculatePaymentStatus as calculatePurchaseInvoicePaymentStatus
} from "../purchases/purchases.calculation";
import {
  calculateAgingBucket,
  calculateAgingBuckets,
  calculateAllocatedAmount,
  calculateDueAfterAllocation,
  calculatePaymentStatus,
  calculateUnallocatedAmount,
  normalizeMoney,
  validateAllocation
} from "./payments.calculation";
import { paymentsRepository } from "./payments.repository";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
import { buildTextPdfFile, buildWhatsappShareUrl } from "../../utils/export-documents";
import type {
  CancelPaymentInput,
  CompletePaymentInput,
  CreatePaymentInput,
  DueListQuery,
  ExportPaymentsQuery,
  ListPaymentsQuery,
  ListRemindersQuery,
  ReplaceAllocationsInput,
  SendReceiptInput,
  SendReminderInput,
  UpdateChequeStatusInput,
  UpdatePaymentInput,
  UpdateReminderStatusInput
} from "./payments.validator";
import type {
  ChequeStatus,
  PaymentActor,
  PaymentAllocationType,
  PaymentExportPayload,
  PaymentPartyType,
  PaymentReceiptType,
  PaymentRequestContext,
  PaymentType
} from "./payments.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AllocationPayload = ReplaceAllocationsInput["allocations"][number];

type PartyRecord =
  | NonNullable<Awaited<ReturnType<typeof customersRepository.findById>>>
  | NonNullable<Awaited<ReturnType<typeof suppliersRepository.findById>>>;

type ReceiptParty = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  mobile: string | null;
};

type ReceiptPdfData = {
  receiptType: PaymentReceiptType;
  payment: {
    paymentNumber: string;
    paymentDate: Date | string;
    paymentMode: string;
    referenceNumber: string | null;
    amount: string;
    allocatedAmount: string;
    unallocatedAmount: string;
    notes: string | null;
  };
  party: {
    name: string;
    code: string;
  };
  bankAccount: {
    bankName: string;
    accountNumber: string;
  } | null;
  allocations: Array<{
    allocationType: string;
    referenceNumber: string | null;
    allocationDate: Date | string | null;
    allocatedAmount: string;
  }>;
};

type InvoiceReferenceRow =
  | (typeof import("../../db/schema").salesInvoices.$inferSelect & {
      referenceType: "sales_invoice";
      partyType: "customer";
      referenceNumber: string;
    })
  | (typeof import("../../db/schema").purchaseInvoices.$inferSelect & {
      referenceType: "purchase_invoice";
      partyType: "supplier";
      referenceNumber: string;
    });

const electronicReceiptModes = new Set(["bank", "upi", "card", "neft", "rtgs", "imps"]);
const formatDateValue = (value: Date | string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toISOString().slice(0, 10);
};

const formatDateTimeValue = (value: Date | string | null | undefined) => {
  if (!value) {
    return "-";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toISOString().replace("T", " ").slice(0, 16);
};

const padCell = (value: string | number, width: number, align: "left" | "right" = "left") => {
  const normalized = String(value);
  if (normalized.length >= width) {
    return normalized.slice(0, width);
  }

  return align === "right" ? normalized.padStart(width, " ") : normalized.padEnd(width, " ");
};

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

class PaymentsService {
  private normalizePrefix(prefix: string) {
    return prefix.replace(/-+$/, "");
  }

  private buildNextSequenceNumber(previousValue: string | null, prefix: string, padding = 6) {
    const match = previousValue?.match(/(\d+)$/);
    const nextNumber = match ? Number(match[1]) + 1 : 1;
    return `${this.normalizePrefix(prefix)}-${String(Number.isFinite(nextNumber) ? nextNumber : 1).padStart(padding, "0")}`;
  }

  private getReceiptType(paymentType: PaymentType): PaymentReceiptType {
    return paymentType === "customer_receive" ? "customer_receipt" : "supplier_voucher";
  }

  private getReceiptPrefix(paymentType: PaymentType) {
    return paymentType === "customer_receive" ? "RCPT" : "PV";
  }

  private getPaymentActionName(paymentType: PaymentType) {
    return paymentType === "customer_receive" ? "customer_payment_received" : "supplier_payment_made";
  }

  private getPaymentAccountingEventName(paymentType: PaymentType) {
    return paymentType === "customer_receive" ? "customer_payment_completed" : "supplier_payment_completed";
  }

  private getPaymentReversalEventName(paymentType: PaymentType) {
    return paymentType === "customer_receive" ? "customer_payment_reversed" : "supplier_payment_reversed";
  }

  private getDefaultChequeStatus(paymentType: PaymentType, paymentCompleted: boolean): ChequeStatus {
    if (paymentCompleted) {
      return "cleared";
    }

    return paymentType === "customer_receive" ? "received" : "issued";
  }

  private assertValidChequeTransition(currentStatus: ChequeStatus | null, nextStatus: ChequeStatus) {
    const transitions: Record<ChequeStatus, ChequeStatus[]> = {
      received: ["deposited", "cleared", "bounced", "cancelled"],
      issued: ["cleared", "bounced", "cancelled"],
      deposited: ["cleared", "bounced", "cancelled"],
      cleared: [],
      bounced: [],
      cancelled: []
    };

    if (!currentStatus) {
      return;
    }

    if (!transitions[currentStatus].includes(nextStatus) && currentStatus !== nextStatus) {
      throw new AppError(`Invalid cheque status transition from ${currentStatus} to ${nextStatus}`, 400);
    }
  }

  private async getPartyOrThrow(companyId: string, partyType: PaymentPartyType, partyId: string, executor?: TransactionClient) {
    if (partyType === "customer") {
      const customer = await customersRepository.findById(companyId, partyId, false, executor);
      if (!customer) {
        throw new AppError("Customer not found", 404);
      }

      if (customer.status !== "active" || customer.deletedAt || customer.isBlacklisted) {
        throw new AppError("Only active customers can be used for payments", 400);
      }

      return customer;
    }

    const supplier = await suppliersRepository.findById(companyId, partyId, false, executor);
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    if (supplier.status !== "active" || supplier.deletedAt || supplier.isBlacklisted) {
      throw new AppError("Only active suppliers can be used for payments", 400);
    }

    return supplier;
  }

  private toReceiptParty(partyType: PaymentPartyType, party: PartyRecord): ReceiptParty {
    if (partyType === "customer") {
      const customer = party as NonNullable<Awaited<ReturnType<typeof customersRepository.findById>>>;
      return {
        id: customer.id,
        code: customer.customerCode,
        name: customer.name,
        email: customer.email,
        mobile: customer.mobile
      };
    }

    const supplier = party as NonNullable<Awaited<ReturnType<typeof suppliersRepository.findById>>>;
    return {
      id: supplier.id,
      code: supplier.supplierCode,
      name: supplier.name,
      email: supplier.email,
      mobile: supplier.mobile
    };
  }

  private async getBankAccountOrThrow(companyId: string, bankAccountId: string) {
    const bankAccount = await companyRepository.findBankAccountById(companyId, bankAccountId);
    if (!bankAccount || !bankAccount.isActive) {
      throw new AppError("Active bank account not found", 404);
    }

    return bankAccount;
  }

  private async getPaymentOrThrow(companyId: string, paymentId: string, executor?: TransactionClient) {
    const payment = await paymentsRepository.findPaymentById(companyId, paymentId, executor);
    if (!payment) {
      throw new AppError("Payment not found", 404);
    }

    return payment;
  }

  private async getNextPaymentNumber(companyId: string, executor: TransactionClient) {
    await paymentsRepository.acquireScopedLock("payment-number", companyId, executor);
    const latest = await paymentsRepository.findLatestPaymentNumber(companyId, executor);
    return this.buildNextSequenceNumber(latest, "PAY", 6);
  }

  private async getNextReceiptNumber(companyId: string, paymentType: PaymentType, executor: TransactionClient) {
    const receiptType = this.getReceiptType(paymentType);
    await paymentsRepository.acquireScopedLock(`payment-receipt-number:${receiptType}`, companyId, executor);
    const latest = await paymentsRepository.findLatestReceiptNumber(companyId, receiptType, executor);
    return this.buildNextSequenceNumber(latest, this.getReceiptPrefix(paymentType), 6);
  }

  private mapPaymentRow(
    row: Awaited<ReturnType<typeof paymentsRepository.listPayments>>["rows"][number] | NonNullable<Awaited<ReturnType<typeof paymentsRepository.findPaymentDetail>>>
  ) {
    if ("customerName" in row || "supplierName" in row) {
      const listRow = row as Awaited<ReturnType<typeof paymentsRepository.listPayments>>["rows"][number];
      return {
        id: listRow.payment.id,
        paymentNumber: listRow.payment.paymentNumber,
        receiptNumber: listRow.payment.receiptNumber,
        paymentType: listRow.payment.paymentType,
        partyType: listRow.payment.partyType,
        partyId: listRow.payment.partyId,
        paymentDate: listRow.payment.paymentDate,
        amount: normalizeMoney(listRow.payment.amount),
        allocatedAmount: normalizeMoney(listRow.payment.allocatedAmount),
        unallocatedAmount: normalizeMoney(listRow.payment.unallocatedAmount),
        paymentMode: listRow.payment.paymentMode,
        referenceNumber: listRow.payment.referenceNumber,
        status: listRow.payment.status,
        isAdvance: listRow.payment.isAdvance,
        chequeNumber: listRow.payment.chequeNumber,
        chequeDate: listRow.payment.chequeDate,
        chequeBankName: listRow.payment.chequeBankName,
        chequeStatus: listRow.payment.chequeStatus,
        notes: listRow.payment.notes,
        completedAt: listRow.payment.completedAt,
        cancelledAt: listRow.payment.cancelledAt,
        cancellationReason: listRow.payment.cancellationReason,
        receiptGeneratedAt: listRow.payment.receiptGeneratedAt,
        accountingEventCreated: listRow.payment.accountingEventCreated,
        paymentAllocationStatus: calculatePaymentStatus({
          amount: listRow.payment.amount,
          allocatedAmount: listRow.payment.allocatedAmount,
          unallocatedAmount: listRow.payment.unallocatedAmount
        }),
        party:
          listRow.payment.partyType === "customer"
            ? {
                id: listRow.payment.partyId,
                name: listRow.customerName ?? null,
                code: listRow.customerCode ?? null
              }
            : {
                id: listRow.payment.partyId,
                name: listRow.supplierName ?? null,
                code: listRow.supplierCode ?? null
              }
      };
    }

    return {
      id: row.payment.id,
      paymentNumber: row.payment.paymentNumber,
      receiptNumber: row.payment.receiptNumber,
      paymentType: row.payment.paymentType,
      partyType: row.payment.partyType,
      partyId: row.payment.partyId,
      paymentDate: row.payment.paymentDate,
      amount: normalizeMoney(row.payment.amount),
      allocatedAmount: normalizeMoney(row.payment.allocatedAmount),
      unallocatedAmount: normalizeMoney(row.payment.unallocatedAmount),
      paymentMode: row.payment.paymentMode,
      referenceNumber: row.payment.referenceNumber,
      status: row.payment.status,
      isAdvance: row.payment.isAdvance,
      chequeNumber: row.payment.chequeNumber,
      chequeDate: row.payment.chequeDate,
      chequeBankName: row.payment.chequeBankName,
      chequeStatus: row.payment.chequeStatus,
      notes: row.payment.notes,
      completedAt: row.payment.completedAt,
      cancelledAt: row.payment.cancelledAt,
      cancellationReason: row.payment.cancellationReason,
      receiptGeneratedAt: row.payment.receiptGeneratedAt,
      accountingEventCreated: row.payment.accountingEventCreated,
      paymentAllocationStatus: calculatePaymentStatus({
        amount: row.payment.amount,
        allocatedAmount: row.payment.allocatedAmount,
        unallocatedAmount: row.payment.unallocatedAmount
      }),
      party:
        row.payment.partyType === "customer" && row.customer
          ? {
              id: row.customer.id,
              name: row.customer.name,
              code: row.customer.customerCode,
              mobile: row.customer.mobile,
              email: row.customer.email
            }
          : row.supplier
            ? {
                id: row.supplier.id,
                name: row.supplier.name,
                code: row.supplier.supplierCode,
                mobile: row.supplier.mobile,
                email: row.supplier.email
              }
            : null,
      bankAccount: row.bankAccount
        ? {
            id: row.bankAccount.id,
            bankName: row.bankAccount.bankName,
            accountNumber: row.bankAccount.accountNumber,
            upiId: row.bankAccount.upiId
          }
        : null
    };
  }

  private async resolveInvoiceReferenceMap(
    companyId: string,
    paymentType: PaymentType,
    allocationReferences: string[],
    executor?: TransactionClient
  ) {
    if (allocationReferences.length === 0) {
      return new Map<string, InvoiceReferenceRow>();
    }

    if (paymentType === "customer_receive") {
      const rows = await paymentsRepository.findSalesInvoicesByIds(companyId, allocationReferences, executor);
      return rows.reduce<Map<string, InvoiceReferenceRow>>((map, row) => {
        map.set(row.id, {
          ...row,
          referenceType: "sales_invoice",
          partyType: "customer",
          referenceNumber: row.invoiceNumber
        });
        return map;
      }, new Map());
    }

    const rows = await paymentsRepository.findPurchaseInvoicesByIds(companyId, allocationReferences, executor);
    return rows.reduce<Map<string, InvoiceReferenceRow>>((map, row) => {
      map.set(row.id, {
        ...row,
        referenceType: "purchase_invoice",
        partyType: "supplier",
        referenceNumber: row.purchaseNumber
      });
      return map;
    }, new Map());
  }

  private async buildNormalizedAllocations(
    companyId: string,
    payment: Pick<typeof import("../../db/schema").payments.$inferSelect, "id" | "amount" | "paymentType" | "partyId" | "partyType" | "paymentDate">,
    requestedAllocations: AllocationPayload[],
    existingAllocations: Array<typeof import("../../db/schema").paymentAllocations.$inferSelect>,
    executor?: TransactionClient
  ) {
    const allocationType = payment.paymentType === "customer_receive" ? "sales_invoice" : "purchase_invoice";
    const seenReferences = new Set<string>();
    const currentAllocationByReference = new Map<string, string>();

    for (const allocation of existingAllocations) {
      if (!allocation.referenceId) {
        continue;
      }

      currentAllocationByReference.set(allocation.referenceId, normalizeMoney(allocation.allocatedAmount));
    }

    const referenceIds = requestedAllocations
      .map((allocation) => allocation.referenceId)
      .filter((referenceId): referenceId is string => Boolean(referenceId));

    const invoiceMap = await this.resolveInvoiceReferenceMap(companyId, payment.paymentType, referenceIds, executor);
    const normalizedAllocations = requestedAllocations.map((allocation) => {
      if (allocation.allocationType !== allocationType) {
        throw new AppError(`Allocation type must be ${allocationType} for this payment`, 400);
      }

      if (!allocation.referenceId) {
        throw new AppError("Allocation reference is required", 400);
      }

      const duplicateKey = `${allocation.allocationType}:${allocation.referenceId}`;
      if (seenReferences.has(duplicateKey)) {
        throw new AppError("Duplicate allocation reference is not allowed", 400);
      }

      seenReferences.add(duplicateKey);
      const invoice = invoiceMap.get(allocation.referenceId);
      if (!invoice) {
        throw new AppError("Allocation reference not found", 404);
      }

      const invoicePartyId = "customerId" in invoice ? invoice.customerId : invoice.supplierId;
      if (invoicePartyId !== payment.partyId || invoice.partyType !== payment.partyType) {
        throw new AppError("Allocation reference does not belong to the selected party", 400);
      }

      const currentDue = normalizeMoney(invoice.dueAmount);
      const currentAllocated = currentAllocationByReference.get(invoice.id) ?? "0.00";
      const availableDue = addDecimals(currentDue, currentAllocated, 2);
      const allocatedAmount = normalizeMoney(allocation.allocatedAmount);

      if (compareDecimals(currentDue, "0.00", 2) <= 0 && compareDecimals(currentAllocated, "0.00", 2) <= 0) {
        throw new AppError(`No outstanding due found for ${invoice.referenceNumber}`, 400);
      }

      const validation = validateAllocation({
        paymentAmount: payment.amount,
        totalAllocated: calculateAllocatedAmount(
          requestedAllocations.map((item) => ({ allocatedAmount: item.allocatedAmount }))
        ),
        invoiceDue: availableDue,
        allocatedAmount
      });

      if (!validation.isValid) {
        throw new AppError(validation.message ?? "Invalid allocation", 400);
      }

      return {
        allocationType,
        referenceId: invoice.id,
        referenceNumber: invoice.referenceNumber,
        partyType: payment.partyType,
        partyId: payment.partyId,
        allocatedAmount,
        allocationDate: allocation.allocationDate ?? payment.paymentDate
      };
    });

    const totalAllocated = calculateAllocatedAmount(normalizedAllocations);
    if (compareDecimals(totalAllocated, payment.amount, 2) > 0) {
      throw new AppError("Allocation total cannot exceed payment amount", 400);
    }

    return normalizedAllocations;
  }

  private async applyInvoiceAllocationDelta(
    companyId: string,
    paymentType: PaymentType,
    previousAllocations: Array<typeof import("../../db/schema").paymentAllocations.$inferSelect>,
    nextAllocations: Array<{
      referenceId: string;
      allocatedAmount: string;
    }>,
    actorId: string,
    executor: TransactionClient
  ) {
    const invoiceIds = Array.from(
      new Set([
        ...previousAllocations.map((allocation) => allocation.referenceId).filter((value): value is string => Boolean(value)),
        ...nextAllocations.map((allocation) => allocation.referenceId)
      ])
    );

    const invoiceMap = await this.resolveInvoiceReferenceMap(companyId, paymentType, invoiceIds, executor);

    for (const allocation of previousAllocations) {
      if (!allocation.referenceId) {
        continue;
      }

      const invoice = invoiceMap.get(allocation.referenceId);
      if (!invoice) {
        throw new AppError("Allocation invoice not found during reversal", 404);
      }

      if (paymentType === "customer_receive") {
        const nextPaidAmount = subtractDecimals(invoice.paidAmount, allocation.allocatedAmount, 2);
        const nextDueAmount = calculateSalesDueAmount(invoice.grandTotal, nextPaidAmount);
        const nextPaymentStatus = calculateSalesInvoicePaymentStatus({
          grandTotal: invoice.grandTotal,
          paidAmount: nextPaidAmount,
          dueDate: invoice.dueDate ?? null
        });

        const updated = await paymentsRepository.updateSalesInvoice(
          companyId,
          invoice.id,
          {
            paidAmount: nextPaidAmount,
            dueAmount: nextDueAmount,
            paymentStatus: nextPaymentStatus,
            updatedBy: actorId
          },
          executor
        );

        if (!updated) {
          throw new AppError("Failed to reverse sales invoice allocation", 500);
        }

        invoiceMap.set(invoice.id, {
          ...invoice,
          paidAmount: updated.paidAmount,
          dueAmount: updated.dueAmount,
          paymentStatus: updated.paymentStatus
        } as InvoiceReferenceRow);
      } else {
        const nextPaidAmount = subtractDecimals(invoice.paidAmount, allocation.allocatedAmount, 2);
        const nextDueAmount = calculatePurchaseDueAmount(invoice.grandTotal, nextPaidAmount);
        const nextPaymentStatus = calculatePurchaseInvoicePaymentStatus({
          grandTotal: invoice.grandTotal,
          paidAmount: nextPaidAmount,
          dueDate: invoice.dueDate ?? null
        });

        const updated = await paymentsRepository.updatePurchaseInvoice(
          companyId,
          invoice.id,
          {
            paidAmount: nextPaidAmount,
            dueAmount: nextDueAmount,
            paymentStatus: nextPaymentStatus,
            updatedBy: actorId
          },
          executor
        );

        if (!updated) {
          throw new AppError("Failed to reverse purchase invoice allocation", 500);
        }

        invoiceMap.set(invoice.id, {
          ...invoice,
          paidAmount: updated.paidAmount,
          dueAmount: updated.dueAmount,
          paymentStatus: updated.paymentStatus
        } as InvoiceReferenceRow);
      }
    }

    for (const allocation of nextAllocations) {
      const invoice = invoiceMap.get(allocation.referenceId);
      if (!invoice) {
        throw new AppError("Allocation invoice not found", 404);
      }

      if (paymentType === "customer_receive") {
        const nextPaidAmount = addDecimals(invoice.paidAmount, allocation.allocatedAmount, 2);
        const nextDueAmount = calculateSalesDueAmount(invoice.grandTotal, nextPaidAmount);
        const nextPaymentStatus = calculateSalesInvoicePaymentStatus({
          grandTotal: invoice.grandTotal,
          paidAmount: nextPaidAmount,
          dueDate: invoice.dueDate ?? null
        });

        const updated = await paymentsRepository.updateSalesInvoice(
          companyId,
          invoice.id,
          {
            paidAmount: nextPaidAmount,
            dueAmount: nextDueAmount,
            paymentStatus: nextPaymentStatus,
            updatedBy: actorId
          },
          executor
        );

        if (!updated) {
          throw new AppError("Failed to update sales invoice allocation", 500);
        }

        invoiceMap.set(invoice.id, {
          ...invoice,
          paidAmount: updated.paidAmount,
          dueAmount: updated.dueAmount,
          paymentStatus: updated.paymentStatus
        } as InvoiceReferenceRow);
      } else {
        const nextPaidAmount = addDecimals(invoice.paidAmount, allocation.allocatedAmount, 2);
        const nextDueAmount = calculatePurchaseDueAmount(invoice.grandTotal, nextPaidAmount);
        const nextPaymentStatus = calculatePurchaseInvoicePaymentStatus({
          grandTotal: invoice.grandTotal,
          paidAmount: nextPaidAmount,
          dueDate: invoice.dueDate ?? null
        });

        const updated = await paymentsRepository.updatePurchaseInvoice(
          companyId,
          invoice.id,
          {
            paidAmount: nextPaidAmount,
            dueAmount: nextDueAmount,
            paymentStatus: nextPaymentStatus,
            updatedBy: actorId
          },
          executor
        );

        if (!updated) {
          throw new AppError("Failed to update purchase invoice allocation", 500);
        }

        invoiceMap.set(invoice.id, {
          ...invoice,
          paidAmount: updated.paidAmount,
          dueAmount: updated.dueAmount,
          paymentStatus: updated.paymentStatus
        } as InvoiceReferenceRow);
      }
    }
  }

  private async saveAllocations(
    actor: PaymentActor,
    payment: typeof import("../../db/schema").payments.$inferSelect,
    requestedAllocations: AllocationPayload[],
    executor: TransactionClient
  ) {
    const existingAllocations = await paymentsRepository.listAllocations(actor.companyId, payment.id, executor);
    const normalizedAllocations = await this.buildNormalizedAllocations(
      actor.companyId,
      payment,
      requestedAllocations,
      existingAllocations,
      executor
    );

    if (payment.status === "completed") {
      await this.applyInvoiceAllocationDelta(
        actor.companyId,
        payment.paymentType,
        existingAllocations,
        normalizedAllocations.map((allocation) => ({
          referenceId: allocation.referenceId,
          allocatedAmount: allocation.allocatedAmount
        })),
        actor.id,
        executor
      );
    }

    await paymentsRepository.deleteAllocations(actor.companyId, payment.id, executor);
    const createdAllocations = await paymentsRepository.createAllocations(
      normalizedAllocations.map((allocation) => ({
        companyId: actor.companyId,
        paymentId: payment.id,
        allocationType: allocation.allocationType as PaymentAllocationType,
        referenceId: allocation.referenceId,
        referenceNumber: allocation.referenceNumber,
        partyType: allocation.partyType,
        partyId: allocation.partyId,
        allocatedAmount: allocation.allocatedAmount,
        allocationDate: allocation.allocationDate,
        createdBy: actor.id
      })),
      executor
    );

    const allocatedAmount = calculateAllocatedAmount(createdAllocations);
    const unallocatedAmount = calculateUnallocatedAmount(payment.amount, allocatedAmount);
    const updatedPayment = await paymentsRepository.updatePayment(
      actor.companyId,
      payment.id,
      {
        allocatedAmount,
        unallocatedAmount,
        isAdvance: compareDecimals(unallocatedAmount, "0.00", 2) > 0
      },
      executor
    );

    if (!updatedPayment) {
      throw new AppError("Failed to update payment allocations", 500);
    }

    return {
      payment: updatedPayment,
      allocations: createdAllocations
    };
  }

  private buildAccountingPayload(
    payment: typeof import("../../db/schema").payments.$inferSelect,
    party: ReceiptParty,
    allocations: Array<typeof import("../../db/schema").paymentAllocations.$inferSelect>,
    kind: "completed" | "reversed"
  ) {
    const amount = normalizeMoney(payment.amount);
    const bankOrCashAccount = payment.paymentMode === "cash" ? "Cash A/c" : "Bank A/c";
    const partyAccount = payment.partyType === "customer" ? "Customer A/c" : "Supplier A/c";
    const debitSide = payment.paymentType === "customer_receive" ? bankOrCashAccount : partyAccount;
    const creditSide = payment.paymentType === "customer_receive" ? partyAccount : bankOrCashAccount;

    return {
      paymentId: payment.id,
      paymentNumber: payment.paymentNumber,
      paymentType: payment.paymentType,
      status: kind,
      party: {
        id: party.id,
        name: party.name,
        code: party.code,
        partyType: payment.partyType
      },
      amount,
      paymentMode: payment.paymentMode,
      referenceNumber: payment.referenceNumber,
      entries:
        kind === "completed"
          ? [
              { account: debitSide, side: "debit", amount },
              { account: creditSide, side: "credit", amount }
            ]
          : [
              { account: creditSide, side: "debit", amount },
              { account: debitSide, side: "credit", amount }
            ],
      allocations: allocations.map((allocation) => ({
        allocationType: allocation.allocationType,
        referenceId: allocation.referenceId,
        referenceNumber: allocation.referenceNumber,
        allocatedAmount: normalizeMoney(allocation.allocatedAmount)
      })),
      advanceAmount: normalizeMoney(payment.unallocatedAmount)
    };
  }

  private buildReceiptData(
    payment: typeof import("../../db/schema").payments.$inferSelect,
    receiptNumber: string,
    receiptType: PaymentReceiptType,
    party: ReceiptParty,
    allocations: Array<typeof import("../../db/schema").paymentAllocations.$inferSelect>,
    bankAccount:
      | {
          id: string;
          bankName: string;
          accountNumber: string;
          upiId: string | null;
        }
      | null
  ) {
    return {
      receiptNumber,
      receiptType,
      payment: {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        paymentDate: payment.paymentDate,
        paymentType: payment.paymentType,
        paymentMode: payment.paymentMode,
        amount: normalizeMoney(payment.amount),
        allocatedAmount: normalizeMoney(payment.allocatedAmount),
        unallocatedAmount: normalizeMoney(payment.unallocatedAmount),
        referenceNumber: payment.referenceNumber,
        notes: payment.notes
      },
      party,
      bankAccount,
      allocations: allocations.map((allocation) => ({
        id: allocation.id,
        allocationType: allocation.allocationType,
        referenceId: allocation.referenceId,
        referenceNumber: allocation.referenceNumber,
        allocatedAmount: normalizeMoney(allocation.allocatedAmount),
        allocationDate: allocation.allocationDate
      })),
      generatedAt: new Date()
    };
  }

  private async ensureReceipt(
    actor: PaymentActor,
    payment: typeof import("../../db/schema").payments.$inferSelect,
    party: ReceiptParty,
    executor: TransactionClient
  ) {
    const allocations = await paymentsRepository.listAllocations(actor.companyId, payment.id, executor);
    const bankAccount =
      payment.bankAccountId
        ? await companyRepository.findBankAccountById(actor.companyId, payment.bankAccountId, executor)
        : null;
    const receiptType = this.getReceiptType(payment.paymentType);
    const receiptNumber = payment.receiptNumber ?? (await this.getNextReceiptNumber(actor.companyId, payment.paymentType, executor));
    const receiptData = this.buildReceiptData(
      {
        ...payment,
        receiptNumber,
        receiptGeneratedAt: payment.receiptGeneratedAt ?? new Date()
      },
      receiptNumber,
      receiptType,
      party,
      allocations,
      bankAccount
        ? {
            id: bankAccount.id,
            bankName: bankAccount.bankName,
            accountNumber: bankAccount.accountNumber,
            upiId: bankAccount.upiId
          }
        : null
    );

    const receipt = await paymentsRepository.upsertReceipt(
      actor.companyId,
      payment.id,
      {
        receiptNumber,
        receiptType,
        receiptData,
        pdfUrl: null,
        generatedAt: new Date(),
        createdBy: actor.id
      },
      executor
    );

    if (!receipt) {
      throw new AppError("Failed to generate payment receipt", 500);
    }

    const updatedPayment = await paymentsRepository.updatePayment(
      actor.companyId,
      payment.id,
      {
        receiptNumber,
        receiptGeneratedAt: new Date()
      },
      executor
    );

    if (!updatedPayment) {
      throw new AppError("Failed to update payment receipt details", 500);
    }

    return { receipt, payment: updatedPayment };
  }

  private async completePaymentInternal(
    actor: PaymentActor,
    paymentId: string,
    input: CompletePaymentInput | { allocations?: AllocationPayload[] },
    executor: TransactionClient
  ) {
    const existing = await this.getPaymentOrThrow(actor.companyId, paymentId, executor);
    if (existing.status === "completed") {
      throw new AppError("Payment is already completed", 400);
    }

    if (existing.status === "cancelled" || existing.status === "reversed" || existing.status === "bounced") {
      throw new AppError("Cancelled or reversed payments cannot be completed", 400);
    }

    const party = await this.getPartyOrThrow(actor.companyId, existing.partyType, existing.partyId, executor);
    const savedAllocations = await this.saveAllocations(actor, existing, input.allocations ?? [], executor);
    const completedChequeStatus =
      existing.paymentMode === "cheque" ? existing.chequeStatus ?? this.getDefaultChequeStatus(existing.paymentType, true) : null;

    const updatedPayment = await paymentsRepository.updatePayment(
      actor.companyId,
      paymentId,
      {
        status: "completed",
        chequeStatus: completedChequeStatus,
        completedAt: new Date(),
        accountingEventCreated: true,
        updatedBy: actor.id
      },
      executor
    );

    if (!updatedPayment) {
      throw new AppError("Failed to complete payment", 500);
    }

    if (updatedPayment.paymentMode === "cheque" && updatedPayment.chequeNumber && updatedPayment.chequeDate && updatedPayment.chequeBankName) {
      await paymentsRepository.createChequeTransaction(
        {
          companyId: actor.companyId,
          paymentId: updatedPayment.id,
          chequeNumber: updatedPayment.chequeNumber,
          chequeDate: updatedPayment.chequeDate,
          bankName: updatedPayment.chequeBankName,
          status: updatedPayment.chequeStatus ?? "cleared",
          statusDate: updatedPayment.paymentDate,
          remarks: updatedPayment.notes,
          createdBy: actor.id
        },
        executor
      );
    }

    const accountingEvent = await paymentsRepository.createAccountingEvent(
      {
        companyId: actor.companyId,
        eventType: this.getPaymentAccountingEventName(updatedPayment.paymentType),
        referenceType: "payment",
        referenceId: updatedPayment.id,
        payload: this.buildAccountingPayload(updatedPayment, this.toReceiptParty(updatedPayment.partyType, party), savedAllocations.allocations, "completed"),
        status: "pending"
      },
      executor
    );

    if (accountingEvent) {
      await accountingService.postEventInTransaction(actor, accountingEvent.id, executor);
    }

    const receipt = await this.ensureReceipt(actor, updatedPayment, this.toReceiptParty(updatedPayment.partyType, party), executor);
    return {
      payment: receipt.payment,
      allocations: savedAllocations.allocations,
      receipt: receipt.receipt
    };
  }

  private async reverseCompletedPayment(
    actor: PaymentActor,
    payment: typeof import("../../db/schema").payments.$inferSelect,
    status: "reversed" | "bounced",
    reason: string,
    executor: TransactionClient
  ) {
    const previousAllocations = await paymentsRepository.listAllocations(actor.companyId, payment.id, executor);
    await this.applyInvoiceAllocationDelta(actor.companyId, payment.paymentType, previousAllocations, [], actor.id, executor);
    await paymentsRepository.deleteAllocations(actor.companyId, payment.id, executor);

    const reversed = await paymentsRepository.updatePayment(
      actor.companyId,
      payment.id,
      {
        status,
        allocatedAmount: "0.00",
        unallocatedAmount: normalizeMoney(payment.amount),
        isAdvance: compareDecimals(payment.amount, "0.00", 2) > 0,
        cancellationReason: reason,
        cancelledAt: new Date(),
        updatedBy: actor.id
      },
      executor
    );

    if (!reversed) {
      throw new AppError("Failed to reverse payment", 500);
    }

    const party = await this.getPartyOrThrow(actor.companyId, payment.partyType, payment.partyId, executor);
    const accountingEvent = await paymentsRepository.createAccountingEvent(
      {
        companyId: actor.companyId,
        eventType: this.getPaymentReversalEventName(payment.paymentType),
        referenceType: "payment",
        referenceId: payment.id,
        payload: this.buildAccountingPayload(reversed, this.toReceiptParty(payment.partyType, party), previousAllocations, "reversed"),
        status: "pending"
      },
      executor
    );

    if (accountingEvent) {
      await accountingService.postEventInTransaction(actor, accountingEvent.id, executor);
    }

    return reversed;
  }

  private async loadPaymentReceipt(actor: PaymentActor, paymentId: string) {
    const detail = await paymentsRepository.findPaymentDetail(actor.companyId, paymentId);
    if (!detail) {
      throw new AppError("Payment not found", 404);
    }

    const receipt = await paymentsRepository.findReceiptByPayment(actor.companyId, paymentId);
    if (receipt) {
      return receipt;
    }

    if (detail.payment.status !== "completed") {
      throw new AppError("Receipt is only available for completed payments", 400);
    }

    const party = await this.getPartyOrThrow(actor.companyId, detail.payment.partyType, detail.payment.partyId);
    const mutation = await db.transaction((transaction) =>
      this.ensureReceipt(actor, detail.payment, this.toReceiptParty(detail.payment.partyType, party), transaction)
    );
    return mutation.receipt;
  }

  private async mapDueItems(
    companyId: string,
    partyType: PaymentPartyType,
    rows:
      | Awaited<ReturnType<typeof paymentsRepository.listCustomerDueItems>>
      | Awaited<ReturnType<typeof paymentsRepository.listSupplierDueItems>>
  ) {
    const items = rows.map((row) => {
      if ("customerName" in row) {
        return {
          referenceType: "sales_invoice" as const,
          referenceId: row.invoice.id,
          referenceNumber: row.invoice.invoiceNumber,
          partyId: row.invoice.customerId,
          partyName: row.customerName,
          partyCode: row.customerCode,
          invoiceDate: row.invoice.invoiceDate,
          dueDate: row.invoice.dueDate,
          grandTotal: normalizeMoney(row.invoice.grandTotal),
          paidAmount: normalizeMoney(row.invoice.paidAmount),
          dueAmount: normalizeMoney(row.invoice.dueAmount),
          agingBucket: calculateAgingBucket(row.invoice.dueDate ?? null)
        };
      }

      return {
        referenceType: "purchase_invoice" as const,
        referenceId: row.invoice.id,
        referenceNumber: row.invoice.purchaseNumber,
        partyId: row.invoice.supplierId,
        partyName: row.supplierName,
        partyCode: row.supplierCode,
        invoiceDate: row.invoice.invoiceDate,
        dueDate: row.invoice.dueDate,
        grandTotal: normalizeMoney(row.invoice.grandTotal),
        paidAmount: normalizeMoney(row.invoice.paidAmount),
        dueAmount: normalizeMoney(row.invoice.dueAmount),
        agingBucket: calculateAgingBucket(row.invoice.dueDate ?? null)
      };
    });

    const groupedPartyIds = Array.from(new Set(items.map((item) => item.partyId).filter((value): value is string => Boolean(value))));
    const advanceMap = new Map<string, string>();
    for (const partyId of groupedPartyIds) {
      advanceMap.set(partyId, await paymentsRepository.getAdvanceBalance(companyId, partyType, partyId));
    }

    return {
      items,
      advanceMap,
      agingSummary: calculateAgingBuckets(items.map((item) => ({ amountDue: item.dueAmount, dueDate: item.dueDate })))
    };
  }

  public async listPayments(actor: Pick<PaymentActor, "companyId">, query: ListPaymentsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await paymentsRepository.listPayments({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      partyType: query.partyType,
      paymentType: query.paymentType,
      partyId: query.partyId,
      paymentMode: query.paymentMode,
      status: query.status,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      isAdvance: query.isAdvance
    });

    return {
      items: result.rows.map((row) => this.mapPaymentRow(row)),
      summary: {
        amount: normalizeMoney(result.summary.amount),
        allocatedAmount: normalizeMoney(result.summary.allocatedAmount),
        unallocatedAmount: normalizeMoney(result.summary.unallocatedAmount)
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createPayment(actor: PaymentActor, input: CreatePaymentInput, context: PaymentRequestContext) {
    if (input.paymentType === "customer_receive" && input.partyType !== "customer") {
      throw new AppError("Customer receipt payments must use party type customer", 400);
    }

    if (input.paymentType === "supplier_pay" && input.partyType !== "supplier") {
      throw new AppError("Supplier payments must use party type supplier", 400);
    }

    const payment = await db.transaction(async (transaction) => {
      await this.getPartyOrThrow(actor.companyId, input.partyType, input.partyId, transaction);
      if (input.bankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
      }

      const paymentNumber = await this.getNextPaymentNumber(actor.companyId, transaction);
      const initialChequeStatus =
        input.paymentMode === "cheque"
          ? input.chequeStatus ?? this.getDefaultChequeStatus(input.paymentType, input.status === "completed")
          : null;
      const createdPayment = await paymentsRepository.createPayment(
        {
          companyId: actor.companyId,
          paymentNumber,
          paymentType: input.paymentType,
          partyType: input.partyType,
          partyId: input.partyId,
          paymentDate: input.paymentDate,
          amount: normalizeMoney(input.amount),
          allocatedAmount: "0.00",
          unallocatedAmount: normalizeMoney(input.amount),
          paymentMode: input.paymentMode,
          bankAccountId: input.bankAccountId ?? null,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
          status: "draft",
          isAdvance: false,
          chequeNumber: input.chequeNumber ?? null,
          chequeDate: input.chequeDate ?? null,
          chequeBankName: input.chequeBankName ?? null,
          chequeStatus: initialChequeStatus,
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!createdPayment) {
        throw new AppError("Failed to create payment", 500);
      }

      if (input.allocations.length > 0) {
        await this.saveAllocations(actor, createdPayment, input.allocations, transaction);
      }

      if (input.status === "completed") {
        return this.completePaymentInternal(actor, createdPayment.id, { allocations: input.allocations }, transaction);
      }

      const refreshed = await this.getPaymentOrThrow(actor.companyId, createdPayment.id, transaction);
      return {
        payment: refreshed,
        allocations: await paymentsRepository.listAllocations(actor.companyId, createdPayment.id, transaction),
        receipt: null
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payment_created",
      entityType: "payment",
      entityId: payment.payment.id,
      metadata: {
        paymentType: payment.payment.paymentType,
        paymentNumber: payment.payment.paymentNumber,
        status: payment.payment.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    if (payment.payment.status === "completed") {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: this.getPaymentActionName(payment.payment.paymentType),
        entityType: "payment",
        entityId: payment.payment.id,
        metadata: {
          amount: normalizeMoney(payment.payment.amount),
          paymentNumber: payment.payment.paymentNumber
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "payment_completed",
        entityType: "payment",
        entityId: payment.payment.id,
        metadata: {
          amount: normalizeMoney(payment.payment.amount),
          allocatedAmount: normalizeMoney(payment.payment.allocatedAmount)
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      if (payment.allocations.length > 0) {
        await auditLogService.log({
          companyId: actor.companyId,
          userId: actor.id,
          action: "payment_allocated",
          entityType: "payment",
          entityId: payment.payment.id,
          metadata: {
            allocationCount: payment.allocations.length,
            allocatedAmount: normalizeMoney(payment.payment.allocatedAmount)
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        });
      }

      if (compareDecimals(payment.payment.unallocatedAmount, "0.00", 2) > 0) {
        await auditLogService.log({
          companyId: actor.companyId,
          userId: actor.id,
          action: "advance_payment_created",
          entityType: "payment",
          entityId: payment.payment.id,
          metadata: {
            advanceAmount: normalizeMoney(payment.payment.unallocatedAmount)
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        });
      }

      if (payment.receipt) {
        await auditLogService.log({
          companyId: actor.companyId,
          userId: actor.id,
          action: "receipt_generated",
          entityType: "payment_receipt",
          entityId: payment.receipt.id,
          metadata: {
            receiptNumber: payment.receipt.receiptNumber
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        });
      }
    }

    return this.getPayment({ companyId: actor.companyId }, payment.payment.id);
  }

  public async getPayment(actor: Pick<PaymentActor, "companyId">, paymentId: string) {
    const detail = await paymentsRepository.findPaymentDetail(actor.companyId, paymentId);
    if (!detail) {
      throw new AppError("Payment not found", 404);
    }

    const [allocations, receipt, chequeHistory] = await Promise.all([
      paymentsRepository.listAllocations(actor.companyId, paymentId),
      paymentsRepository.findReceiptByPayment(actor.companyId, paymentId),
      paymentsRepository.listChequeTransactions(actor.companyId, paymentId)
    ]);

    return {
      payment: {
        ...this.mapPaymentRow(detail),
        allocations: allocations.map((allocation) => ({
          id: allocation.id,
          allocationType: allocation.allocationType,
          referenceId: allocation.referenceId,
          referenceNumber: allocation.referenceNumber,
          allocatedAmount: normalizeMoney(allocation.allocatedAmount),
          allocationDate: allocation.allocationDate
        })),
        receipt: receipt
          ? {
              id: receipt.id,
              receiptNumber: receipt.receiptNumber,
              receiptType: receipt.receiptType,
              generatedAt: receipt.generatedAt,
              pdfUrl: receipt.pdfUrl
            }
          : null,
        chequeTransactions: chequeHistory.map((cheque) => ({
          id: cheque.id,
          chequeNumber: cheque.chequeNumber,
          chequeDate: cheque.chequeDate,
          bankName: cheque.bankName,
          status: cheque.status,
          statusDate: cheque.statusDate,
          remarks: cheque.remarks
        }))
      }
    };
  }

  public async updatePayment(actor: PaymentActor, paymentId: string, input: UpdatePaymentInput, context: PaymentRequestContext) {
    const updated = await db.transaction(async (transaction) => {
      const existing = await this.getPaymentOrThrow(actor.companyId, paymentId, transaction);
      if (existing.status !== "draft") {
        throw new AppError("Only draft payments can be edited", 400);
      }

      if (input.bankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
      }

      const nextAmount = normalizeMoney(input.amount ?? existing.amount);
      const updatedPayment = await paymentsRepository.updatePayment(
        actor.companyId,
        paymentId,
        pickDefined({
          paymentDate: input.paymentDate,
          amount: nextAmount,
          paymentMode: input.paymentMode,
          bankAccountId: input.bankAccountId,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          chequeNumber: input.chequeNumber,
          chequeDate: input.chequeDate === undefined ? undefined : input.chequeDate,
          chequeBankName: input.chequeBankName,
          chequeStatus: input.paymentMode === "cheque" || existing.paymentMode === "cheque" ? input.chequeStatus : null,
          updatedBy: actor.id
        }) as Partial<typeof import("../../db/schema").payments.$inferInsert>,
        transaction
      );

      if (!updatedPayment) {
        throw new AppError("Failed to update payment", 500);
      }

      if (input.allocations) {
        return this.saveAllocations(actor, updatedPayment, input.allocations, transaction);
      }

      const allocations = await paymentsRepository.listAllocations(actor.companyId, paymentId, transaction);
      const allocatedAmount = calculateAllocatedAmount(allocations);
      const unallocatedAmount = calculateUnallocatedAmount(nextAmount, allocatedAmount);
      const syncedPayment = await paymentsRepository.updatePayment(
        actor.companyId,
        paymentId,
        {
          allocatedAmount,
          unallocatedAmount,
          isAdvance: compareDecimals(unallocatedAmount, "0.00", 2) > 0,
          updatedBy: actor.id
        },
        transaction
      );

      if (!syncedPayment) {
        throw new AppError("Failed to sync payment totals", 500);
      }

      return {
        payment: syncedPayment,
        allocations
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payment_created",
      entityType: "payment",
      entityId: paymentId,
      metadata: {
        updated: true,
        fields: Object.keys(input)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getPayment({ companyId: actor.companyId }, updated.payment.id);
  }

  public async completePayment(actor: PaymentActor, paymentId: string, input: CompletePaymentInput, context: PaymentRequestContext) {
    const completed = await db.transaction((transaction) => this.completePaymentInternal(actor, paymentId, input, transaction));

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payment_completed",
      entityType: "payment",
      entityId: paymentId,
      metadata: {
        amount: normalizeMoney(completed.payment.amount),
        allocatedAmount: normalizeMoney(completed.payment.allocatedAmount)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: this.getPaymentActionName(completed.payment.paymentType),
      entityType: "payment",
      entityId: paymentId,
      metadata: {
        amount: normalizeMoney(completed.payment.amount),
        paymentNumber: completed.payment.paymentNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    if (completed.allocations.length > 0) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "payment_allocated",
        entityType: "payment",
        entityId: paymentId,
        metadata: {
          allocationCount: completed.allocations.length,
          allocatedAmount: normalizeMoney(completed.payment.allocatedAmount)
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    if (compareDecimals(completed.payment.unallocatedAmount, "0.00", 2) > 0) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "advance_payment_created",
        entityType: "payment",
        entityId: paymentId,
        metadata: {
          advanceAmount: normalizeMoney(completed.payment.unallocatedAmount)
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "receipt_generated",
      entityType: "payment_receipt",
      entityId: completed.receipt.id,
      metadata: {
        receiptNumber: completed.receipt.receiptNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getPayment({ companyId: actor.companyId }, paymentId);
  }

  public async cancelPayment(actor: PaymentActor, paymentId: string, input: CancelPaymentInput, context: PaymentRequestContext) {
    const payment = await db.transaction(async (transaction) => {
      const existing = await this.getPaymentOrThrow(actor.companyId, paymentId, transaction);
      if (existing.status === "cancelled" || existing.status === "reversed" || existing.status === "bounced") {
        throw new AppError("Payment is already cancelled or reversed", 400);
      }

      if (existing.status === "draft") {
        const cancelled = await paymentsRepository.updatePayment(
          actor.companyId,
          paymentId,
          {
            status: "cancelled",
            cancellationReason: input.reason,
            cancelledAt: new Date(),
            updatedBy: actor.id
          },
          transaction
        );

        if (!cancelled) {
          throw new AppError("Failed to cancel payment", 500);
        }

        return cancelled;
      }

      return this.reverseCompletedPayment(actor, existing, "reversed", input.reason, transaction);
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: payment.status === "cancelled" ? "payment_cancelled" : "payment_reversed",
      entityType: "payment",
      entityId: payment.id,
      metadata: {
        reason: input.reason,
        status: payment.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getPayment({ companyId: actor.companyId }, payment.id);
  }

  public async exportPayments(
    actor: PaymentActor,
    query: ExportPaymentsQuery,
    context: PaymentRequestContext
  ): Promise<PaymentExportPayload> {
    const rows = await paymentsRepository.listPaymentsForExport({
      companyId: actor.companyId,
      search: query.search ?? null,
      partyType: query.partyType,
      paymentType: query.paymentType,
      partyId: query.partyId,
      paymentMode: query.paymentMode,
      status: query.status,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      isAdvance: query.isAdvance
    });
    const dataset: ReportExportDataset = {
      title: "Payments",
      columns: [
        { key: "paymentNumber", label: "Payment No" },
        { key: "receiptNumber", label: "Receipt No" },
        { key: "paymentType", label: "Type" },
        { key: "partyName", label: "Party" },
        { key: "paymentDate", label: "Date" },
        { key: "paymentMode", label: "Mode" },
        { key: "amount", label: "Amount", type: "number" },
        { key: "allocatedAmount", label: "Allocated", type: "number" },
        { key: "unallocatedAmount", label: "Unallocated", type: "number" },
        { key: "status", label: "Status" },
        { key: "referenceNumber", label: "Reference" }
      ],
      rows: rows.map((row) => ({
        paymentNumber: row.payment.paymentNumber,
        receiptNumber: row.payment.receiptNumber ?? "",
        paymentType: row.payment.paymentType,
        partyName: row.payment.partyType === "customer" ? (row.customerName ?? "") : (row.supplierName ?? ""),
        paymentDate: formatDateValue(row.payment.paymentDate),
        paymentMode: row.payment.paymentMode,
        amount: Number(normalizeMoney(row.payment.amount)),
        allocatedAmount: Number(normalizeMoney(row.payment.allocatedAmount)),
        unallocatedAmount: Number(normalizeMoney(row.payment.unallocatedAmount)),
        status: row.payment.status,
        referenceNumber: row.payment.referenceNumber ?? ""
      }))
    };
    const file = buildReportFile(dataset, query.format, `payments-${new Date().toISOString().slice(0, 10)}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payment_exported",
      entityType: "payment",
      metadata: {
        format: query.format,
        rowCount: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }

  public async listAllocations(actor: Pick<PaymentActor, "companyId">, paymentId: string) {
    await this.getPaymentOrThrow(actor.companyId, paymentId);
    const allocations = await paymentsRepository.listAllocations(actor.companyId, paymentId);

    return {
      items: allocations.map((allocation) => ({
        id: allocation.id,
        allocationType: allocation.allocationType,
        referenceId: allocation.referenceId,
        referenceNumber: allocation.referenceNumber,
        allocatedAmount: normalizeMoney(allocation.allocatedAmount),
        allocationDate: allocation.allocationDate
      })),
      totals: {
        allocatedAmount: calculateAllocatedAmount(allocations)
      }
    };
  }

  public async upsertAllocations(
    actor: PaymentActor,
    paymentId: string,
    input: ReplaceAllocationsInput,
    replace: boolean,
    context: PaymentRequestContext
  ) {
    const updated = await db.transaction(async (transaction) => {
      const existing = await this.getPaymentOrThrow(actor.companyId, paymentId, transaction);
      const currentAllocations = await paymentsRepository.listAllocations(actor.companyId, paymentId, transaction);

      const nextAllocations = replace
        ? input.allocations
        : [
            ...currentAllocations.map((allocation) => ({
              allocationType: allocation.allocationType as PaymentAllocationType,
              referenceId: allocation.referenceId,
              referenceNumber: allocation.referenceNumber,
              allocatedAmount: Number(allocation.allocatedAmount),
              allocationDate: allocation.allocationDate
            })),
            ...input.allocations
          ].reduce<AllocationPayload[]>((accumulator, allocation) => {
            const referenceId = allocation.referenceId ?? null;
            const key = `${allocation.allocationType}:${referenceId ?? "manual"}`;
            const existingItemIndex = accumulator.findIndex(
              (item) => `${item.allocationType}:${item.referenceId ?? "manual"}` === key
            );

            if (existingItemIndex >= 0) {
              accumulator[existingItemIndex] = allocation;
            } else {
              accumulator.push(allocation);
            }

            return accumulator;
          }, []);

      return this.saveAllocations(actor, existing, nextAllocations, transaction);
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "payment_allocated",
      entityType: "payment",
      entityId: paymentId,
      metadata: {
        replace,
        allocationCount: updated.allocations.length,
        allocatedAmount: normalizeMoney(updated.payment.allocatedAmount)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getPayment({ companyId: actor.companyId }, paymentId);
  }

  public async listCustomerDues(actor: Pick<PaymentActor, "companyId">, query: DueListQuery) {
    const pagination = getPagination(query.page, query.limit);
    const mapped = await this.mapDueItems(
      actor.companyId,
      "customer",
      await paymentsRepository.listCustomerDueItems({
        companyId: actor.companyId,
        partyId: query.partyId,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        overdueOnly: query.overdueOnly
      })
    );

    const filteredItems = query.agingBucket ? mapped.items.filter((item) => item.agingBucket === query.agingBucket) : mapped.items;
    const pagedItems = filteredItems.slice(pagination.offset, pagination.offset + pagination.limit);

    return {
      items: pagedItems.map((item) => ({
        ...item,
        advanceBalance: mapped.advanceMap.get(item.partyId ?? "") ?? "0.00"
      })),
      summary: {
        totalDue: filteredItems.reduce((total, item) => addDecimals(total, item.dueAmount, 2), "0.00"),
        aging: mapped.agingSummary
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: filteredItems.length,
        totalPages: Math.ceil(filteredItems.length / pagination.limit) || 1
      }
    };
  }

  public async listSupplierDues(actor: Pick<PaymentActor, "companyId">, query: DueListQuery) {
    const pagination = getPagination(query.page, query.limit);
    const mapped = await this.mapDueItems(
      actor.companyId,
      "supplier",
      await paymentsRepository.listSupplierDueItems({
        companyId: actor.companyId,
        partyId: query.partyId,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        overdueOnly: query.overdueOnly
      })
    );

    const filteredItems = query.agingBucket ? mapped.items.filter((item) => item.agingBucket === query.agingBucket) : mapped.items;
    const pagedItems = filteredItems.slice(pagination.offset, pagination.offset + pagination.limit);

    return {
      items: pagedItems.map((item) => ({
        ...item,
        advanceBalance: mapped.advanceMap.get(item.partyId ?? "") ?? "0.00"
      })),
      summary: {
        totalDue: filteredItems.reduce((total, item) => addDecimals(total, item.dueAmount, 2), "0.00"),
        aging: mapped.agingSummary
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: filteredItems.length,
        totalPages: Math.ceil(filteredItems.length / pagination.limit) || 1
      }
    };
  }

  public async getPartyDueItems(actor: Pick<PaymentActor, "companyId">, partyType: string, partyId: string) {
    if (partyType !== "customer" && partyType !== "supplier") {
      throw new AppError("Invalid party type", 400);
    }

    const mapped = await this.mapDueItems(
      actor.companyId,
      partyType,
      partyType === "customer"
        ? await paymentsRepository.listCustomerDueItems({ companyId: actor.companyId, partyId })
        : await paymentsRepository.listSupplierDueItems({ companyId: actor.companyId, partyId })
    );

    return {
      items: mapped.items,
      advanceBalance: mapped.advanceMap.get(partyId) ?? "0.00",
      aging: mapped.agingSummary
    };
  }

  public async getReceipt(actor: PaymentActor, paymentId: string, _context: PaymentRequestContext) {
    const receipt = await this.loadPaymentReceipt(actor, paymentId);
    return {
      receipt: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        receiptType: receipt.receiptType,
        generatedAt: receipt.generatedAt,
        pdfUrl: receipt.pdfUrl,
        receiptData: receipt.receiptData
      }
    };
  }

  public async getReceiptPdf(actor: PaymentActor, paymentId: string, context: PaymentRequestContext): Promise<PaymentExportPayload> {
    const receipt = await this.loadPaymentReceipt(actor, paymentId);
    const data = receipt.receiptData as ReceiptPdfData;

    const dataset: ReportExportDataset = {
      title: data.receiptType === "customer_receipt" ? "Payment Receipt" : "Payment Voucher",
      subtitle: receipt.receiptNumber,
      metadata: [
        { label: "Payment No", value: data.payment.paymentNumber },
        { label: "Payment Date", value: formatDateValue(data.payment.paymentDate) },
        { label: "Party", value: data.party.name },
        { label: "Party Code", value: data.party.code },
        { label: "Mode", value: data.payment.paymentMode },
        { label: "Reference", value: data.payment.referenceNumber ?? "-" },
        { label: "Status", value: data.receiptType === "customer_receipt" ? "Received" : "Paid" },
        { label: "Bank Account", value: data.bankAccount ? `${data.bankAccount.bankName} ${data.bankAccount.accountNumber}` : "-" }
      ],
      summary: [
        { label: "Total Amount", value: data.payment.amount },
        { label: "Allocated", value: data.payment.allocatedAmount },
        { label: "Unallocated", value: data.payment.unallocatedAmount }
      ],
      columns: [
        { key: "allocationType", label: "Allocation" },
        { key: "referenceNumber", label: "Reference" },
        { key: "allocationDate", label: "Date", type: "date" },
        { key: "allocatedAmount", label: "Amount", type: "number" }
      ],
      rows: data.allocations.map((alloc) => ({
        allocationType: alloc.allocationType,
        referenceNumber: alloc.referenceNumber ?? "-",
        allocationDate: new Date(alloc.allocationDate ?? data.payment.paymentDate),
        allocatedAmount: Number(alloc.allocatedAmount)
      })),
      notes: data.payment.notes || undefined
    };

    const file = buildReportFile(dataset, "pdf", receipt.receiptNumber);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "receipt_generated",
      entityType: "payment_receipt",
      entityId: receipt.id,
      metadata: {
        mode: "pdf"
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }

  public async sendReceipt(actor: PaymentActor, paymentId: string, input: SendReceiptInput, context: PaymentRequestContext) {
    const detail = await paymentsRepository.findPaymentDetail(actor.companyId, paymentId);
    if (!detail) {
      throw new AppError("Payment not found", 404);
    }

    const receipt = await this.loadPaymentReceipt(actor, paymentId);
    const party = await this.getPartyOrThrow(actor.companyId, detail.payment.partyType, detail.payment.partyId);
    const receiptParty = this.toReceiptParty(detail.payment.partyType, party);
    const targetEmail = input.email ?? receiptParty.email ?? null;
    if (!targetEmail) {
      throw new AppError("No email is available for this party", 400);
    }

    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
      await emailService.sendGenericEmail({
        to: targetEmail,
        subject: input.subject ?? `${receipt.receiptType === "customer_receipt" ? "Receipt" : "Voucher"} ${receipt.receiptNumber}`,
        html: `<p>Hello,</p><p>Please find ${receipt.receiptType === "customer_receipt" ? "receipt" : "voucher"} <strong>${receipt.receiptNumber}</strong> for amount <strong>${normalizeMoney(detail.payment.amount)}</strong>.</p><p>${input.message ?? ""}</p>`,
        text: `${receipt.receiptNumber} amount ${normalizeMoney(detail.payment.amount)} ${input.message ?? ""}`.trim()
      });
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : "Email send failed";
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "receipt_sent",
      entityType: "payment_receipt",
      entityId: receipt.id,
      metadata: {
        sentTo: targetEmail,
        status,
        errorMessage
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      sentTo: targetEmail,
      status,
      errorMessage
    };
  }

  public async listReminders(actor: Pick<PaymentActor, "companyId">, query: ListRemindersQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await paymentsRepository.listReminders({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      partyType: query.partyType,
      partyId: query.partyId,
      status: query.status,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });

    return {
      items: result.rows.map((row) => ({
        id: row.reminder.id,
        partyType: row.reminder.partyType,
        partyId: row.reminder.partyId,
        partyName: row.reminder.partyType === "customer" ? row.customerName : row.supplierName,
        referenceType: row.reminder.referenceType,
        referenceId: row.reminder.referenceId,
        referenceNumber: row.reminder.referenceNumber,
        dueDate: row.reminder.dueDate,
        amountDue: normalizeMoney(row.reminder.amountDue),
        channel: row.reminder.channel,
        status: row.reminder.status,
        message: row.reminder.message,
        sentAt: row.reminder.sentAt,
        errorMessage: row.reminder.errorMessage,
        createdAt: row.reminder.createdAt,
        updatedAt: row.reminder.updatedAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async sendReminder(actor: PaymentActor, input: SendReminderInput, context: PaymentRequestContext) {
    const party = await this.getPartyOrThrow(actor.companyId, input.partyType, input.partyId);
    const receiptParty = this.toReceiptParty(input.partyType, party);
    const defaultMessage = `Reminder for ${input.referenceNumber ?? "due item"} amount ${normalizeMoney(input.amountDue)} due on ${input.dueDate.toISOString().slice(0, 10)}.`;

    let status: "pending" | "sent" | "failed" = input.channel === "in_app" ? "sent" : "pending";
    let errorMessage: string | null = null;

    if (input.channel === "email") {
      const targetEmail = receiptParty.email;
      if (!targetEmail) {
        status = "failed";
        errorMessage = "No email available for the selected party";
      } else {
        try {
          await emailService.sendGenericEmail({
            to: targetEmail,
            subject: `Payment reminder ${input.referenceNumber ?? ""}`.trim(),
            html: `<p>${input.message ?? defaultMessage}</p>`,
            text: input.message ?? defaultMessage
          });
          status = "sent";
        } catch (error) {
          status = "failed";
          errorMessage = error instanceof Error ? error.message : "Email send failed";
        }
      }
    }

    if (input.channel === "whatsapp") {
      const whatsappUrl = buildWhatsappShareUrl(
        receiptParty.mobile ?? "",
        input.message ?? defaultMessage
      );

      if (!receiptParty.mobile || !whatsappUrl) {
        status = "failed";
        errorMessage = "No WhatsApp mobile is available for the selected party";
      } else {
        status = "sent";
        errorMessage = null;
      }
    }

    const reminder = await paymentsRepository.createReminder({
      companyId: actor.companyId,
      partyType: input.partyType,
      partyId: input.partyId,
      referenceType: input.referenceType,
      referenceId: input.referenceId ?? null,
      referenceNumber: input.referenceNumber ?? null,
      dueDate: input.dueDate,
      amountDue: normalizeMoney(input.amountDue),
      channel: input.channel,
      status,
      message: input.message ?? defaultMessage,
      sentAt: status === "sent" ? new Date() : null,
      errorMessage,
      createdBy: actor.id
    });

    if (!reminder) {
      throw new AppError("Failed to create reminder", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "reminder_sent",
      entityType: "payment_reminder",
      entityId: reminder.id,
      metadata: {
        channel: input.channel,
        status,
        referenceNumber: input.referenceNumber ?? null
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      reminder: {
        id: reminder.id,
        status: reminder.status,
        channel: reminder.channel,
        errorMessage: reminder.errorMessage,
        sentAt: reminder.sentAt
      },
      ...(input.channel === "whatsapp" && reminder.status === "sent" && receiptParty.mobile
        ? {
            whatsappUrl: buildWhatsappShareUrl(receiptParty.mobile, input.message ?? defaultMessage)
          }
        : {})
    };
  }

  public async updateReminderStatus(
    actor: PaymentActor,
    reminderId: string,
    input: UpdateReminderStatusInput,
    context: PaymentRequestContext
  ) {
    const existing = await paymentsRepository.findReminderById(actor.companyId, reminderId);
    if (!existing) {
      throw new AppError("Reminder not found", 404);
    }

    const updated = await paymentsRepository.updateReminder(actor.companyId, reminderId, {
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      sentAt: input.status === "sent" ? new Date() : existing.sentAt
    });

    if (!updated) {
      throw new AppError("Failed to update reminder", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "reminder_sent",
      entityType: "payment_reminder",
      entityId: updated.id,
      metadata: {
        previousStatus: existing.status,
        status: updated.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      reminder: {
        id: updated.id,
        status: updated.status,
        errorMessage: updated.errorMessage,
        sentAt: updated.sentAt
      }
    };
  }

  public async updateChequeStatus(
    actor: PaymentActor,
    paymentId: string,
    input: UpdateChequeStatusInput,
    context: PaymentRequestContext
  ) {
    const payment = await db.transaction(async (transaction) => {
      const existing = await this.getPaymentOrThrow(actor.companyId, paymentId, transaction);
      if (existing.paymentMode !== "cheque" || !existing.chequeNumber || !existing.chequeDate || !existing.chequeBankName) {
        throw new AppError("Cheque details are not available for this payment", 400);
      }

      this.assertValidChequeTransition(existing.chequeStatus ?? null, input.chequeStatus);

      let updatedPayment = await paymentsRepository.updatePayment(
        actor.companyId,
        paymentId,
        {
          chequeStatus: input.chequeStatus,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updatedPayment) {
        throw new AppError("Failed to update cheque status", 500);
      }

      await paymentsRepository.createChequeTransaction(
        {
          companyId: actor.companyId,
          paymentId: existing.id,
          chequeNumber: existing.chequeNumber,
          chequeDate: existing.chequeDate,
          bankName: existing.chequeBankName,
          status: input.chequeStatus,
          statusDate: input.statusDate ?? existing.paymentDate,
          remarks: input.remarks ?? input.reason ?? null,
          createdBy: actor.id
        },
        transaction
      );

      if (updatedPayment.status === "draft" && input.chequeStatus === "cleared") {
        const completed = await this.completePaymentInternal(actor, existing.id, { allocations: [] }, transaction);
        updatedPayment = completed.payment;
      }

      if (updatedPayment.status === "completed" && (input.chequeStatus === "bounced" || input.chequeStatus === "cancelled")) {
        updatedPayment = await this.reverseCompletedPayment(
          actor,
          updatedPayment,
          input.chequeStatus === "bounced" ? "bounced" : "reversed",
          input.reason ?? `Cheque ${input.chequeStatus}`,
          transaction
        );
      }

      return updatedPayment;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "cheque_status_changed",
      entityType: "payment",
      entityId: payment.id,
      metadata: {
        chequeStatus: input.chequeStatus,
        status: payment.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getPayment({ companyId: actor.companyId }, payment.id);
  }
}

export const paymentsService = new PaymentsService();
