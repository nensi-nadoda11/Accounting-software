import { db } from "../../db";
import { auditLogService } from "../audit-logs/audit-log.service";
import { accountingService } from "../accounting/accounting.service";
import { companyRepository } from "../company/company.repository";
import { inventoryRepository } from "../inventory/inventory.repository";
import { inventoryService } from "../inventory/inventory.service";
import {
  addDecimals,
  compareDecimals,
  decimalToScaledBigInt,
  divideMoneyByQuantity,
  normalizeMoney,
  normalizeQuantity,
  scaledBigIntToDecimal,
  subtractDecimals
} from "../inventory/inventory.utils";
import { suppliersRepository } from "../suppliers/suppliers.repository";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
import { buildTextPdfFile } from "../../utils/export-documents";
import { purchasesRepository } from "./purchases.repository";
import type {
  CreatePurchaseReturnInput,
  CreatePurchaseInput,
  ExportPurchaseReturnsQuery,
  ExportPurchasesQuery,
  ListPurchasePaymentsQuery,
  ListPurchaseReturnsQuery,
  ListPurchasesQuery,
  RecordPurchasePaymentInput,
  RecordPurchaseReturnRefundInput,
  UpdatePurchaseInput
} from "./purchases.validator";
import type { PurchaseActor, PurchaseExportPayload, PurchaseRequestContext } from "./purchases.types";
import {
  calculateDueAmount,
  calculateInvoiceTotals,
  calculatePaymentStatus,
  normalizeQuantity as normalizePurchaseQuantity
} from "./purchases.calculation";

type ProductContextRow = Awaited<ReturnType<typeof inventoryRepository.findProductInventoryContext>>;
type InvoiceRecord = Awaited<ReturnType<typeof purchasesRepository.findPurchaseById>>;
type InvoiceItemRow = Awaited<ReturnType<typeof purchasesRepository.listPurchaseInvoiceItems>>[number];

type ResolvedPurchaseItem = {
  product: NonNullable<ProductContextRow>;
  warehouseId: string | null;
  batchId: string | null;
  batchNumber: string | null;
  quantity: string;
  freeQuantity: string;
  totalStockQuantity: string;
  purchaseRate: string;
  priceTaxType: "inclusive" | "exclusive";
  discountPercent: string;
  discountAmount: string;
  gstRate: string;
  cessRate: string;
  manufacturingDate: Date | null;
  expiryDate: Date | null;
  remarks: string | null;
  isInterState: boolean;
};

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const toDateOnly = (value: Date) => value.toISOString().slice(0, 10);
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

const roundHalfUp = (dividend: bigint, divisor: bigint) => {
  if (divisor === 0n) {
    throw new Error("Division by zero");
  }

  const negative = dividend < 0n;
  const absoluteDividend = negative ? dividend * -1n : dividend;
  const quotient = absoluteDividend / divisor;
  const remainder = absoluteDividend % divisor;
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;

  return negative ? rounded * -1n : rounded;
};

class PurchasesService {
  private normalizePrefix(prefix: string | null | undefined, fallback: string) {
    const base = (prefix?.trim() || fallback).replace(/-+$/, "");
    return `${base}-`;
  }

  private buildNextSequenceNumber(previousValue: string | null, prefix: string) {
    const match = previousValue?.match(/(\d+)$/);
    const nextNumber = match ? Number(match[1]) + 1 : 1;
    return `${prefix}${String(Number.isFinite(nextNumber) ? nextNumber : 1).padStart(6, "0")}`;
  }

  private hasFractionalQuantity(value: string) {
    return decimalToScaledBigInt(value, 3) % 1000n !== 0n;
  }

  private normalizeState(value: string | null | undefined) {
    return value?.trim().toUpperCase() ?? null;
  }

  private prorateMoney(totalAmount: string | number, totalQuantity: string | number, partialQuantity: string | number) {
    const totalAmountScaled = decimalToScaledBigInt(totalAmount, 2);
    const totalQuantityScaled = decimalToScaledBigInt(totalQuantity, 3);
    const partialQuantityScaled = decimalToScaledBigInt(partialQuantity, 3);

    if (totalQuantityScaled <= 0n || partialQuantityScaled <= 0n) {
      return "0.00";
    }

    return scaledBigIntToDecimal(roundHalfUp(totalAmountScaled * partialQuantityScaled, totalQuantityScaled), 2);
  }

  private clampMoneyToZero(value: string) {
    return compareDecimals(value, "0.00", 2) < 0 ? "0.00" : normalizeMoney(value);
  }

  private calculateAvailableRefundBalance(input: {
    returnGrandTotal: string | number;
    refundedAmount: string | number;
    invoicePaidAmount: string | number;
    invoiceRefundedAmount: string | number;
  }) {
    const pendingReturnAmount = this.clampMoneyToZero(
      subtractDecimals(input.returnGrandTotal, input.refundedAmount, 2)
    );
    const remainingInvoiceRefundable = this.clampMoneyToZero(
      subtractDecimals(input.invoicePaidAmount, input.invoiceRefundedAmount, 2)
    );

    return compareDecimals(pendingReturnAmount, remainingInvoiceRefundable, 2) <= 0
      ? pendingReturnAmount
      : remainingInvoiceRefundable;
  }

  private calculateReturnAdjustedAmount(input: {
    invoiceGrandTotal: string | number;
    invoicePaidAmount: string | number;
    priorReturnGrandTotal: string | number;
    returnGrandTotal: string | number;
  }) {
    const outstandingBeforeReturn = this.clampMoneyToZero(
      subtractDecimals(
        subtractDecimals(input.invoiceGrandTotal, input.priorReturnGrandTotal, 2),
        input.invoicePaidAmount,
        2
      )
    );
    const normalizedReturnTotal = normalizeMoney(input.returnGrandTotal);

    return compareDecimals(normalizedReturnTotal, outstandingBeforeReturn, 2) <= 0
      ? normalizedReturnTotal
      : outstandingBeforeReturn;
  }

  private calculateReturnRefundableAmount(input: {
    returnGrandTotal: string | number;
    adjustedAmount: string | number;
  }) {
    return this.clampMoneyToZero(subtractDecimals(input.returnGrandTotal, input.adjustedAmount, 2));
  }

  private buildReturnAdjustmentMap(
    rows: Awaited<ReturnType<typeof purchasesRepository.listPurchaseReturnSettlementRows>>
  ) {
    const adjustments = new Map<string, string>();
    let activeInvoiceId: string | null = null;
    let priorReturnGrandTotal = "0.00";

    for (const row of rows) {
      if (row.purchaseInvoiceId !== activeInvoiceId) {
        activeInvoiceId = row.purchaseInvoiceId;
        priorReturnGrandTotal = "0.00";
      }

      const adjustedAmount = this.calculateReturnAdjustedAmount({
        invoiceGrandTotal: row.invoiceGrandTotal,
        invoicePaidAmount: row.invoicePaidAmount,
        priorReturnGrandTotal,
        returnGrandTotal: row.returnGrandTotal
      });

      adjustments.set(row.purchaseReturnId, adjustedAmount);
      priorReturnGrandTotal = addDecimals(priorReturnGrandTotal, row.returnGrandTotal, 2);
    }

    return adjustments;
  }

  private mapInvoiceRow(
    row: NonNullable<Awaited<ReturnType<typeof purchasesRepository.findPurchaseDetail>>>,
    extras?: {
      items?: unknown[];
      payments?: unknown[];
      returns?: unknown[];
    }
  ) {
    return {
      id: row.invoice.id,
      purchaseNumber: row.invoice.purchaseNumber,
      supplierInvoiceNumber: row.invoice.supplierInvoiceNumber,
      invoiceDate: row.invoice.invoiceDate,
      dueDate: row.invoice.dueDate,
      purchaseStatus: row.invoice.purchaseStatus,
      paymentStatus: row.invoice.paymentStatus,
      subtotal: normalizeMoney(row.invoice.subtotal),
      itemDiscountTotal: normalizeMoney(row.invoice.itemDiscountTotal),
      invoiceDiscountTotal: normalizeMoney(row.invoice.invoiceDiscountTotal),
      additionalCharges: normalizeMoney(row.invoice.additionalCharges),
      freightCharges: normalizeMoney(row.invoice.freightCharges),
      taxableAmount: normalizeMoney(row.invoice.taxableAmount),
      cgstTotal: normalizeMoney(row.invoice.cgstTotal),
      sgstTotal: normalizeMoney(row.invoice.sgstTotal),
      igstTotal: normalizeMoney(row.invoice.igstTotal),
      cessTotal: normalizeMoney(row.invoice.cessTotal),
      gstTotal: normalizeMoney(row.invoice.gstTotal),
      roundOffAmount: normalizeMoney(row.invoice.roundOffAmount),
      grandTotal: normalizeMoney(row.invoice.grandTotal),
      paidAmount: normalizeMoney(row.invoice.paidAmount),
      dueAmount: normalizeMoney(row.invoice.dueAmount),
      paymentMode: row.invoice.paymentMode,
      paymentReference: row.invoice.paymentReference,
      bankAccountId: row.invoice.bankAccountId,
      notes: row.invoice.notes,
      termsConditions: row.invoice.termsConditions,
      attachmentUrl: row.invoice.attachmentUrl,
      accountingEventCreated: row.invoice.accountingEventCreated,
      postedAt: row.invoice.postedAt,
      cancelledAt: row.invoice.cancelledAt,
      createdBy: row.invoice.createdBy,
      updatedBy: row.invoice.updatedBy,
      createdAt: row.invoice.createdAt,
      updatedAt: row.invoice.updatedAt,
      supplier: {
        id: row.supplier.id,
        supplierCode: row.supplier.supplierCode,
        name: row.supplier.name,
        gstNumber: row.supplier.gstNumber,
        gstState: row.supplier.gstState,
        mobile: row.supplier.mobile
      },
      warehouse: row.warehouse
        ? {
            id: row.warehouse.id,
            warehouseCode: row.warehouse.warehouseCode,
            name: row.warehouse.name
          }
        : null,
      ...(extras?.items ? { items: extras.items } : {}),
      ...(extras?.payments ? { payments: extras.payments } : {}),
      ...(extras?.returns ? { returns: extras.returns } : {})
    };
  }

  private mapInvoiceItemRow(row: InvoiceItemRow) {
    return {
      id: row.item.id,
      lineNumber: row.item.lineNumber,
      productId: row.item.productId,
      productNameSnapshot: row.item.productNameSnapshot,
      skuSnapshot: row.item.skuSnapshot,
      hsnSacSnapshot: row.item.hsnSacSnapshot,
      unitSnapshot: row.item.unitSnapshot,
      quantity: normalizeQuantity(row.item.quantity),
      freeQuantity: normalizeQuantity(row.item.freeQuantity),
      purchaseRate: normalizeMoney(row.item.purchaseRate),
      priceTaxType: row.item.priceTaxType,
      discountPercent: normalizeMoney(row.item.discountPercent),
      discountAmount: normalizeMoney(row.item.discountAmount),
      taxableAmount: normalizeMoney(row.item.taxableAmount),
      gstRate: normalizeMoney(row.item.gstRate),
      cgstAmount: normalizeMoney(row.item.cgstAmount),
      sgstAmount: normalizeMoney(row.item.sgstAmount),
      igstAmount: normalizeMoney(row.item.igstAmount),
      cessRate: normalizeMoney(row.item.cessRate),
      cessAmount: normalizeMoney(row.item.cessAmount),
      lineTotal: normalizeMoney(row.item.lineTotal),
      manufacturingDate: row.item.manufacturingDate,
      expiryDate: row.item.expiryDate,
      remarks: row.item.remarks,
      warehouse: row.item.warehouseId
        ? {
            id: row.item.warehouseId,
            name: row.warehouseName,
            warehouseCode: row.warehouseCode
          }
        : null,
      batch: row.item.batchId
        ? {
            id: row.item.batchId,
            batchNumber: row.batchNumber
          }
        : null,
      product: {
        id: row.product.id,
        productCode: row.product.productCode,
        productType: row.product.productType,
        stockTrackingEnabled: row.product.stockTrackingEnabled
      }
    };
  }

  private mapPaymentRow(row: {
    id: string;
    paymentDate: Date;
    amount: string;
    paymentMode: string;
    bankAccountId: string | null;
    referenceNumber: string | null;
    notes: string | null;
    createdBy: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      paymentDate: row.paymentDate,
      amount: normalizeMoney(row.amount),
      paymentMode: row.paymentMode,
      bankAccountId: row.bankAccountId,
      referenceNumber: row.referenceNumber,
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt
    };
  }

  private mapReturnRefundRow(row: typeof import("../../db/schema").purchaseReturnRefunds.$inferSelect) {
    return {
      id: row.id,
      refundDate: row.refundDate,
      amount: normalizeMoney(row.amount),
      paymentMode: row.paymentMode,
      bankAccountId: row.bankAccountId,
      referenceNumber: row.referenceNumber,
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt
    };
  }

  private sumRefundRows(refunds: Array<{ amount: string | number }> | undefined) {
    return normalizeMoney((refunds ?? []).reduce((sum, refund) => addDecimals(sum, refund.amount, 2), "0.00"));
  }

  private mapReturnItemRow(
    row: Awaited<ReturnType<typeof purchasesRepository.listPurchaseReturnItems>>[number]
  ) {
    return {
      id: row.item.id,
      purchaseInvoiceItemId: row.item.purchaseInvoiceItemId,
      productId: row.item.productId,
      productName: row.product.name,
      productCode: row.product.productCode,
      quantity: normalizeQuantity(row.item.quantity),
      returnRate: normalizeMoney(row.item.returnRate),
      taxableAmount: normalizeMoney(row.item.taxableAmount),
      gstRate: normalizeMoney(row.item.gstRate),
      gstAmount: normalizeMoney(row.item.gstAmount),
      lineTotal: normalizeMoney(row.item.lineTotal)
    };
  }

  private mapReturnRow(
    row:
      | Awaited<ReturnType<typeof purchasesRepository.listPurchaseReturns>>["rows"][number]
      | NonNullable<Awaited<ReturnType<typeof purchasesRepository.findPurchaseReturnDetail>>>,
    extras?: {
      items?: Array<ReturnType<PurchasesService["mapReturnItemRow"]>>;
      refunds?: Array<ReturnType<PurchasesService["mapReturnRefundRow"]>>;
    },
    adjustmentOverride?: string,
    refundedAmountOverride?: string
  ) {
    const refundedAmount = normalizeMoney(refundedAmountOverride ?? ("refundedAmount" in row ? row.refundedAmount : "0.00"));
    const returnGrandTotal = normalizeMoney("purchaseReturn" in row ? row.purchaseReturn.grandTotal : 0);
    const adjustedAmount =
      adjustmentOverride ??
      this.calculateReturnAdjustedAmount({
        invoiceGrandTotal: "invoice" in row ? row.invoice.grandTotal : returnGrandTotal,
        invoicePaidAmount:
          "invoice" in row
            ? row.invoice.paidAmount
            : "invoicePaidAmount" in row
              ? row.invoicePaidAmount
              : "0.00",
        priorReturnGrandTotal: "0.00",
        returnGrandTotal
      });
    const refundableAmount = this.calculateReturnRefundableAmount({
      returnGrandTotal,
      adjustedAmount
    });
    const remainingAmount = this.clampMoneyToZero(subtractDecimals(refundableAmount, refundedAmount, 2));
    const settlementStatus =
      compareDecimals(refundableAmount, "0.00", 2) <= 0
        ? "settled"
        : compareDecimals(refundedAmount, "0.00", 2) <= 0
          ? "pending"
          : compareDecimals(remainingAmount, "0.00", 2) <= 0
            ? "settled"
            : "partial";

    if ("purchaseReturn" in row && "supplierName" in row) {
      return {
        id: row.purchaseReturn.id,
        returnNumber: row.purchaseReturn.returnNumber,
        purchaseInvoiceId: row.purchaseReturn.purchaseInvoiceId,
        purchaseNumber: row.purchaseNumber,
        supplierId: row.purchaseReturn.supplierId,
        supplierName: row.supplierName,
        supplierCode: row.supplierCode,
        returnDate: row.purchaseReturn.returnDate,
        grandTotal: returnGrandTotal,
        adjustedAmount: normalizeMoney(adjustedAmount),
        refundedAmount: normalizeMoney(refundedAmount),
        remainingRefundAmount: remainingAmount,
        settlementStatus,
        gstTotal: normalizeMoney(row.purchaseReturn.gstTotal),
        subtotal: normalizeMoney(row.purchaseReturn.subtotal),
        roundOffAmount: normalizeMoney(row.purchaseReturn.roundOffAmount),
        warehouse: row.purchaseReturn.warehouseId
          ? {
              id: row.purchaseReturn.warehouseId,
              name: row.warehouseName,
              warehouseCode: row.warehouseCode
            }
          : null,
        notes: row.purchaseReturn.notes,
        createdAt: row.purchaseReturn.createdAt,
        updatedAt: row.purchaseReturn.updatedAt,
        ...(extras?.items ? { items: extras.items } : {}),
        ...(extras?.refunds ? { refunds: extras.refunds } : {})
      };
    }

    return {
      id: row.purchaseReturn.id,
      returnNumber: row.purchaseReturn.returnNumber,
      purchaseInvoiceId: row.purchaseReturn.purchaseInvoiceId,
      purchaseNumber: row.invoice.purchaseNumber,
      supplierId: row.purchaseReturn.supplierId,
      supplierName: row.supplier.name,
      supplierCode: row.supplier.supplierCode,
      returnDate: row.purchaseReturn.returnDate,
      grandTotal: returnGrandTotal,
      adjustedAmount: normalizeMoney(adjustedAmount),
      refundedAmount: normalizeMoney(refundedAmount),
      remainingRefundAmount: remainingAmount,
      settlementStatus,
      gstTotal: normalizeMoney(row.purchaseReturn.gstTotal),
      subtotal: normalizeMoney(row.purchaseReturn.subtotal),
      roundOffAmount: normalizeMoney(row.purchaseReturn.roundOffAmount),
      warehouse: row.purchaseReturn.warehouseId && row.warehouse
        ? {
            id: row.purchaseReturn.warehouseId,
            name: row.warehouse.name,
            warehouseCode: row.warehouse.warehouseCode
          }
        : null,
      notes: row.purchaseReturn.notes,
      createdAt: row.purchaseReturn.createdAt,
      updatedAt: row.purchaseReturn.updatedAt,
      ...(extras?.items ? { items: extras.items } : {}),
      ...(extras?.refunds ? { refunds: extras.refunds } : {})
    };
  }

  private async getSupplierOrThrow(companyId: string, supplierId: string) {
    const supplier = await suppliersRepository.findById(companyId, supplierId);
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }

    if (supplier.status !== "active" || supplier.deletedAt) {
      throw new AppError("Only active suppliers can be used for purchases", 400);
    }

    if (supplier.isBlacklisted) {
      throw new AppError("Blacklisted suppliers cannot be used for purchases", 400);
    }

    return supplier;
  }

  private async getBankAccountOrThrow(companyId: string, bankAccountId: string) {
    const bankAccount = await companyRepository.findBankAccountById(companyId, bankAccountId);
    if (!bankAccount || !bankAccount.isActive) {
      throw new AppError("Active bank account not found", 404);
    }

    return bankAccount;
  }

  private async getWarehouseOrThrow(companyId: string, warehouseId: string) {
    const warehouse = await inventoryRepository.findWarehouseById(companyId, warehouseId);
    if (!warehouse) {
      throw new AppError("Warehouse not found", 404);
    }

    if (warehouse.status !== "active" || warehouse.deletedAt) {
      throw new AppError("Only active warehouses can be used for purchases", 400);
    }

    return warehouse;
  }

  private async getPurchaseOrThrow(companyId: string, purchaseId: string, executor?: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
    const purchase = await purchasesRepository.findPurchaseById(companyId, purchaseId, executor);
    if (!purchase) {
      throw new AppError("Purchase invoice not found", 404);
    }

    return purchase;
  }

  private async getPurchasePrefix(companyId: string) {
    const settings = await companyRepository.findInvoiceSettingsByCompanyId(companyId);
    return this.normalizePrefix(settings?.purchaseInvoicePrefix, "PUR");
  }

  private async getNextPurchaseNumber(companyId: string, executor: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
    await purchasesRepository.acquireScopedLock("purchase-number", companyId, executor);
    const latest = await purchasesRepository.findLatestPurchaseNumber(companyId, executor);
    const prefix = await this.getPurchasePrefix(companyId);
    return this.buildNextSequenceNumber(latest, prefix);
  }

  private async getNextReturnNumber(companyId: string, executor: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
    await purchasesRepository.acquireScopedLock("purchase-return-number", companyId, executor);
    const latest = await purchasesRepository.findLatestReturnNumber(companyId, executor);
    return this.buildNextSequenceNumber(latest, "PR-");
  }

  private async getCompanyTaxContext(companyId: string) {
    const [company, taxSettings] = await Promise.all([
      companyRepository.findCompanyById(companyId),
      companyRepository.findTaxSettingsByCompanyId(companyId)
    ]);

    if (!company) {
      throw new AppError("Company not found", 404);
    }

    return {
      company,
      taxSettings
    };
  }

  private async resolvePurchaseItems(
    companyId: string,
    supplierState: string | null,
    invoiceWarehouseId: string | null,
    items: CreatePurchaseInput["items"] | NonNullable<UpdatePurchaseInput["items"]>
  ) {
    const { company } = await this.getCompanyTaxContext(companyId);
    const companyState = this.normalizeState(company.state);
    const resolvedItems: ResolvedPurchaseItem[] = [];

    for (const item of items) {
      const productRow = await inventoryRepository.findProductInventoryContext(companyId, item.productId);
      if (!productRow) {
        throw new AppError("Product not found", 404);
      }

      if (productRow.product.deletedAt || productRow.product.status !== "active") {
        throw new AppError(`Only active products can be used in purchases: ${productRow.product.name}`, 400);
      }

      const quantity = normalizePurchaseQuantity(item.quantity);
      const freeQuantity = normalizePurchaseQuantity(item.freeQuantity ?? 0);
      const totalStockQuantity = addDecimals(quantity, freeQuantity, 3);

      if (!productRow.unitDecimalAllowed && (this.hasFractionalQuantity(quantity) || this.hasFractionalQuantity(freeQuantity))) {
        throw new AppError(`Decimal quantity is not allowed for ${productRow.product.name}`, 400);
      }

      const warehouseId = item.warehouseId ?? invoiceWarehouseId ?? null;
      if (productRow.product.productType === "goods") {
        if (!warehouseId) {
          throw new AppError(`Warehouse is required for goods product ${productRow.product.name}`, 400);
        }

        await this.getWarehouseOrThrow(companyId, warehouseId);
      }

      if (productRow.product.productType === "service" && warehouseId) {
        throw new AppError(`Service product ${productRow.product.name} must not be assigned a warehouse`, 400);
      }

      if (productRow.product.batchTrackingEnabled && !item.batchId && !item.batchNumber) {
        throw new AppError(`Batch details are required for ${productRow.product.name}`, 400);
      }

      if (productRow.product.expiryTrackingEnabled && !item.expiryDate) {
        throw new AppError(`Expiry date is required for ${productRow.product.name}`, 400);
      }

      if (item.expiryDate && item.manufacturingDate && item.expiryDate <= item.manufacturingDate) {
        throw new AppError(`Expiry date must be after manufacturing date for ${productRow.product.name}`, 400);
      }

      const gstRate =
        productRow.product.taxType === "taxable"
          ? normalizeMoney(item.gstRate ?? productRow.product.gstRate)
          : "0.00";
      const cessRate =
        productRow.product.taxType === "taxable"
          ? normalizeMoney(item.cessRate ?? productRow.product.cessRate)
          : "0.00";

      resolvedItems.push({
        product: productRow,
        warehouseId,
        batchId: item.batchId ?? null,
        batchNumber: item.batchNumber ?? null,
        quantity,
        freeQuantity,
        totalStockQuantity,
        purchaseRate: normalizeMoney(item.purchaseRate),
        priceTaxType: item.priceTaxType,
        discountPercent: normalizeMoney(item.discountPercent ?? 0),
        discountAmount: normalizeMoney(item.discountAmount ?? 0),
        gstRate,
        cessRate,
        manufacturingDate: item.manufacturingDate ?? null,
        expiryDate: item.expiryDate ?? null,
        remarks: item.remarks ?? null,
        isInterState: Boolean(companyState && supplierState && companyState !== supplierState)
      });
    }

    return resolvedItems;
  }

  private buildAccountingPayload(invoice: typeof import("../../db/schema").purchaseInvoices.$inferSelect) {
    return {
      entries: [
        {
          account: "Purchase",
          side: "debit",
          amount: normalizeMoney(invoice.taxableAmount)
        },
        {
          account: "Input GST",
          side: "debit",
          amount: normalizeMoney(invoice.gstTotal)
        },
        {
          account: invoice.paidAmount !== "0" ? "Bank/Cash" : "Supplier",
          side: "credit",
          amount: normalizeMoney(invoice.grandTotal)
        }
      ],
      roundOff: normalizeMoney(invoice.roundOffAmount),
      supplierId: invoice.supplierId,
      purchaseNumber: invoice.purchaseNumber
    };
  }

  private async syncInventoryAlerts(actor: PurchaseActor, touched: Array<{ productId: string; warehouseId: string | null; batchId: string | null }>) {
    const uniqueKeys = new Set<string>();
    for (const entry of touched) {
      if (!entry.warehouseId) {
        continue;
      }

      const key = `${entry.productId}:${entry.warehouseId}:${entry.batchId ?? ""}`;
      if (uniqueKeys.has(key)) {
        continue;
      }

      uniqueKeys.add(key);
      await inventoryService.recalculateAlerts(
        actor,
        {
          productId: entry.productId,
          warehouseId: entry.warehouseId,
          batchId: entry.batchId ?? undefined
        },
        {
          ipAddress: "",
          userAgent: ""
        }
      );
    }
  }

  private async logPurchaseAudit(
    actor: PurchaseActor,
    action: string,
    purchaseId: string,
    metadata: Record<string, unknown>,
    context: PurchaseRequestContext
  ) {
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action,
      entityType: "purchase_invoice",
      entityId: purchaseId,
      metadata,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  private async buildDraftPayload(
    actor: PurchaseActor,
    input: {
      supplierId: string;
      supplierInvoiceNumber?: string | null | undefined;
      invoiceDate: Date;
      dueDate?: Date | null | undefined;
      warehouseId: string | null;
      items: CreatePurchaseInput["items"];
      invoiceDiscountTotal?: number | null | undefined;
      additionalCharges?: number | null | undefined;
      freightCharges?: number | null | undefined;
      paidAmount?: number | null | undefined;
      paymentMode?: CreatePurchaseInput["paymentMode"];
      paymentReference?: string | null | undefined;
      bankAccountId?: string | null | undefined;
      notes?: string | null | undefined;
      termsConditions?: string | null | undefined;
      attachmentUrl?: string | null | undefined;
    },
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0],
    existingPurchaseId?: string
  ) {
    const supplier = await this.getSupplierOrThrow(actor.companyId, input.supplierId);
    const invoiceWarehouseId = input.warehouseId ?? null;
    if (invoiceWarehouseId) {
      await this.getWarehouseOrThrow(actor.companyId, invoiceWarehouseId);
    }

    if (input.bankAccountId) {
      await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
    }

    if (input.supplierInvoiceNumber) {
      const duplicate = await purchasesRepository.findSupplierInvoiceDuplicate(
        actor.companyId,
        supplier.id,
        input.supplierInvoiceNumber,
        existingPurchaseId,
        executor
      );

      if (duplicate) {
        throw new AppError("Supplier invoice number already exists for this supplier", 409);
      }
    }

    const items = await this.resolvePurchaseItems(
      actor.companyId,
      this.normalizeState(supplier.gstState ?? supplier.billingState ?? supplier.shippingState),
      invoiceWarehouseId,
      input.items
    );

    const totals = calculateInvoiceTotals({
      items: items.map((item) => ({
        quantity: item.quantity,
        purchaseRate: item.purchaseRate,
        priceTaxType: item.priceTaxType,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        gstRate: item.gstRate,
        cessRate: item.cessRate,
        isInterState: item.isInterState
      })),
      invoiceDiscountTotal: input.invoiceDiscountTotal ?? 0,
      additionalCharges: input.additionalCharges ?? 0,
      freightCharges: input.freightCharges ?? 0,
      roundOffEnabled: true
    });

    const paidAmount = normalizeMoney(input.paidAmount ?? 0);
    if (compareDecimals(paidAmount, totals.grandTotal, 2) > 0) {
      throw new AppError("Paid amount cannot exceed grand total", 400);
    }

    const dueAmount = calculateDueAmount(totals.grandTotal, paidAmount);
    const paymentStatus = calculatePaymentStatus({
      grandTotal: totals.grandTotal,
      paidAmount,
      dueDate: input.dueDate ?? null,
      asOf: new Date()
    });

    return {
      supplier,
      resolvedItems: items,
      calculatedItems: totals.lines,
      invoiceTotals: totals,
      paidAmount,
      dueAmount,
      paymentStatus
    };
  }

  private async postPurchaseInTransaction(
    actor: PurchaseActor,
    purchase: typeof import("../../db/schema").purchaseInvoices.$inferSelect,
    items: Awaited<ReturnType<typeof purchasesRepository.listPurchaseInvoiceItems>>,
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    if (purchase.purchaseStatus !== "draft") {
      throw new AppError("Only draft purchases can be posted", 400);
    }

    const stockTouch = await inventoryService.receivePurchaseStock(
      actor,
      {
        movementDate: new Date(purchase.invoiceDate),
        referenceType: "purchase_invoice",
        referenceId: purchase.id,
        referenceNumber: purchase.purchaseNumber,
        remarks: purchase.notes,
        items: items.map((row) => ({
          productId: row.item.productId,
          warehouseId: row.item.warehouseId,
          batchId: row.item.batchId,
          batchNumber: row.batchNumber,
          manufacturingDate: row.item.manufacturingDate,
          expiryDate: row.item.expiryDate,
          quantity: addDecimals(row.item.quantity, row.item.freeQuantity, 3),
          movementValue: normalizeMoney(row.item.taxableAmount),
          rate:
            compareDecimals(addDecimals(row.item.quantity, row.item.freeQuantity, 3), "0.000", 3) > 0
              ? divideMoneyByQuantity(row.item.taxableAmount, addDecimals(row.item.quantity, row.item.freeQuantity, 3))
              : normalizeMoney(row.item.purchaseRate)
        }))
      },
      executor
    );

    if (compareDecimals(purchase.paidAmount, "0.00", 2) > 0) {
      const paymentCount = await purchasesRepository.countPurchasePayments(actor.companyId, purchase.id, executor);
      if (paymentCount === 0) {
        const paymentMode = purchase.paymentMode;
        if (!paymentMode) {
          throw new AppError("Payment mode is required for the initial paid amount", 400);
        }

        await purchasesRepository.createPurchasePayment(
          {
            companyId: actor.companyId,
            purchaseInvoiceId: purchase.id,
            supplierId: purchase.supplierId,
            paymentDate: purchase.invoiceDate,
            amount: purchase.paidAmount,
            paymentMode,
            bankAccountId: purchase.bankAccountId,
            referenceNumber: purchase.paymentReference,
            notes: purchase.notes,
            createdBy: actor.id
          },
          executor
        );
      }
    }

    const accountingEvent = await purchasesRepository.createAccountingEvent(
      {
        companyId: actor.companyId,
        eventType: "purchase_posted",
        referenceType: "purchase_invoice",
        referenceId: purchase.id,
        payload: this.buildAccountingPayload(purchase),
        status: "pending"
      },
      executor
    );

    if (accountingEvent) {
      await accountingService.postEventInTransaction(actor, accountingEvent.id, executor);
    }

    const updatedInvoice = await purchasesRepository.updatePurchaseInvoice(
      actor.companyId,
      purchase.id,
      {
        purchaseStatus: "posted",
        paymentStatus: calculatePaymentStatus({
          grandTotal: purchase.grandTotal,
          paidAmount: purchase.paidAmount,
          dueDate: purchase.dueDate ?? null
        }),
        dueAmount: calculateDueAmount(purchase.grandTotal, purchase.paidAmount),
        accountingEventCreated: Boolean(accountingEvent),
        postedAt: new Date(),
        updatedBy: actor.id
      },
      executor
    );

    if (!updatedInvoice) {
      throw new AppError("Failed to post purchase invoice", 500);
    }

    return {
      invoice: updatedInvoice,
      stockTouch
    };
  }

  private async determineReturnedStatus(companyId: string, items: Awaited<ReturnType<typeof purchasesRepository.listPurchaseInvoiceItems>>, executor: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
    for (const row of items) {
      const returnedQty = await purchasesRepository.getReturnedQuantityByInvoiceItem(companyId, row.item.id, executor);
      const maxReturnQty = addDecimals(row.item.quantity, row.item.freeQuantity, 3);
      if (compareDecimals(returnedQty, maxReturnQty, 3) < 0) {
        return "posted" as const;
      }
    }

    return "returned" as const;
  }

  public async listPurchases(actor: Pick<PurchaseActor, "companyId">, query: ListPurchasesQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await purchasesRepository.listPurchases({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      purchaseStatus: query.purchaseStatus,
      paymentStatus: query.paymentStatus,
      supplierId: query.supplierId,
      warehouseId: query.warehouseId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });

    return {
      items: result.rows.map((row) => ({
        id: row.invoice.id,
        purchaseNumber: row.invoice.purchaseNumber,
        supplierInvoiceNumber: row.invoice.supplierInvoiceNumber,
        invoiceDate: row.invoice.invoiceDate,
        dueDate: row.invoice.dueDate,
        purchaseStatus: row.invoice.purchaseStatus,
        paymentStatus: row.invoice.paymentStatus,
        grandTotal: normalizeMoney(row.invoice.grandTotal),
        paidAmount: normalizeMoney(row.invoice.paidAmount),
        dueAmount: normalizeMoney(row.invoice.dueAmount),
        supplier: {
          id: row.invoice.supplierId,
          name: row.supplierName,
          supplierCode: row.supplierCode
        },
        warehouse: row.invoice.warehouseId
          ? {
              id: row.invoice.warehouseId,
              name: row.warehouseName,
              warehouseCode: row.warehouseCode
            }
          : null,
        createdAt: row.invoice.createdAt
      })),
      summary: {
        grandTotal: normalizeMoney(result.summary.grandTotal),
        paidAmount: normalizeMoney(result.summary.paidAmount),
        dueAmount: normalizeMoney(result.summary.dueAmount)
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createPurchase(
    actor: PurchaseActor,
    input: CreatePurchaseInput,
    context: PurchaseRequestContext,
    options: { canApprove: boolean }
  ) {
    if (input.purchaseStatus === "posted" && !options.canApprove) {
      throw new AppError("You do not have permission to post purchases", 403);
    }

    const mutation = await db.transaction(async (transaction) => {
      const draftPayload = await this.buildDraftPayload(
        actor,
        {
          supplierId: input.supplierId,
          supplierInvoiceNumber: input.supplierInvoiceNumber,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate ?? null,
          warehouseId: input.warehouseId ?? null,
          items: input.items,
          invoiceDiscountTotal: input.invoiceDiscountTotal,
          additionalCharges: input.additionalCharges,
          freightCharges: input.freightCharges,
          paidAmount: input.paidAmount,
          paymentMode: input.paymentMode,
          paymentReference: input.paymentReference,
          bankAccountId: input.bankAccountId ?? null,
          notes: input.notes ?? null,
          termsConditions: input.termsConditions ?? null,
          attachmentUrl: input.attachmentUrl ?? null
        },
        transaction
      );
      const purchaseNumber = await this.getNextPurchaseNumber(actor.companyId, transaction);

      const invoice = await purchasesRepository.createPurchaseInvoice(
        {
          companyId: actor.companyId,
          purchaseNumber,
          supplierId: input.supplierId,
          supplierInvoiceNumber: input.supplierInvoiceNumber,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate ?? null,
          warehouseId: input.warehouseId ?? null,
          purchaseStatus: "draft",
          paymentStatus: draftPayload.paymentStatus,
          subtotal: draftPayload.invoiceTotals.subtotal,
          itemDiscountTotal: draftPayload.invoiceTotals.itemDiscountTotal,
          invoiceDiscountTotal: draftPayload.invoiceTotals.invoiceDiscountTotal,
          additionalCharges: draftPayload.invoiceTotals.additionalCharges,
          freightCharges: draftPayload.invoiceTotals.freightCharges,
          taxableAmount: draftPayload.invoiceTotals.taxableAmount,
          cgstTotal: draftPayload.invoiceTotals.cgstTotal,
          sgstTotal: draftPayload.invoiceTotals.sgstTotal,
          igstTotal: draftPayload.invoiceTotals.igstTotal,
          cessTotal: draftPayload.invoiceTotals.cessTotal,
          gstTotal: draftPayload.invoiceTotals.gstTotal,
          roundOffAmount: draftPayload.invoiceTotals.roundOffAmount,
          grandTotal: draftPayload.invoiceTotals.grandTotal,
          paidAmount: draftPayload.paidAmount,
          dueAmount: draftPayload.dueAmount,
          paymentMode: input.paymentMode ?? null,
          paymentReference: input.paymentReference ?? null,
          bankAccountId: input.bankAccountId ?? null,
          notes: input.notes ?? null,
          termsConditions: input.termsConditions ?? null,
          attachmentUrl: input.attachmentUrl ?? null,
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!invoice) {
        throw new AppError("Failed to create purchase invoice", 500);
      }

      await purchasesRepository.createPurchaseInvoiceItems(
        draftPayload.resolvedItems.map((item, index) => ({
          companyId: actor.companyId,
          purchaseInvoiceId: invoice.id,
          productId: item.product.product.id,
          warehouseId: item.warehouseId,
          batchId: item.batchId,
          lineNumber: index + 1,
          productNameSnapshot: item.product.product.name,
          skuSnapshot: item.product.product.sku,
          hsnSacSnapshot: item.product.product.hsnSacCode,
          unitSnapshot: item.product.unitSymbol ?? item.product.unitName ?? "",
          quantity: item.quantity,
          freeQuantity: item.freeQuantity,
          purchaseRate: item.purchaseRate,
          priceTaxType: item.priceTaxType,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          taxableAmount: draftPayload.calculatedItems[index]!.taxableAmount,
          gstRate: item.gstRate,
          cgstAmount: draftPayload.calculatedItems[index]!.cgstAmount,
          sgstAmount: draftPayload.calculatedItems[index]!.sgstAmount,
          igstAmount: draftPayload.calculatedItems[index]!.igstAmount,
          cessRate: item.cessRate,
          cessAmount: draftPayload.calculatedItems[index]!.cessAmount,
          lineTotal: draftPayload.calculatedItems[index]!.lineTotal,
          manufacturingDate: item.manufacturingDate ?? null,
          expiryDate: item.expiryDate ?? null,
          remarks: item.remarks ?? null
        })),
        transaction
      );

      if (input.purchaseStatus === "posted") {
        const items = await purchasesRepository.listPurchaseInvoiceItems(actor.companyId, invoice.id, transaction);
        const posted = await this.postPurchaseInTransaction(actor, invoice, items, transaction);
        return {
          invoice: posted.invoice,
          stockTouch: posted.stockTouch,
          posted: true
        };
      }

      return {
        invoice,
        stockTouch: [] as Array<{ productId: string; warehouseId: string | null; batchId: string | null }>,
        posted: false
      };
    });

    await this.logPurchaseAudit(
      actor,
      "purchase_created",
      mutation.invoice.id,
      {
        purchaseNumber: mutation.invoice.purchaseNumber,
        status: mutation.invoice.purchaseStatus
      },
      context
    );

    if (mutation.posted) {
      await this.logPurchaseAudit(
        actor,
        "purchase_posted",
        mutation.invoice.id,
        {
          purchaseNumber: mutation.invoice.purchaseNumber
        },
        context
      );

      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "purchase_stock_updated",
        entityType: "purchase_invoice",
        entityId: mutation.invoice.id,
        metadata: {
          purchaseNumber: mutation.invoice.purchaseNumber
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "purchase_payable_updated",
        entityType: "purchase_invoice",
        entityId: mutation.invoice.id,
        metadata: {
          dueAmount: normalizeMoney(mutation.invoice.dueAmount)
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      await this.syncInventoryAlerts(actor, mutation.stockTouch);
    }

    const detail = await this.getPurchase(actor, mutation.invoice.id);
    return detail;
  }

  public async getPurchase(actor: Pick<PurchaseActor, "companyId">, purchaseId: string) {
    const detail = await purchasesRepository.findPurchaseDetail(actor.companyId, purchaseId);
    if (!detail) {
      throw new AppError("Purchase invoice not found", 404);
    }

    const [items, payments, returns] = await Promise.all([
      purchasesRepository.listPurchaseInvoiceItems(actor.companyId, purchaseId),
      purchasesRepository.listPurchasePayments(actor.companyId, purchaseId),
      purchasesRepository.listPurchaseReturns({
        companyId: actor.companyId,
        page: 1,
        limit: 100,
        purchaseInvoiceId: purchaseId
      })
    ]);

    const returnsWithItems = await Promise.all(
      returns.rows.map(async (entry) => {
        const returnItems = await purchasesRepository.listPurchaseReturnItems(actor.companyId, entry.purchaseReturn.id);
        return this.mapReturnRow(entry, {
          items: returnItems.map((item) => this.mapReturnItemRow(item))
        });
      })
    );

    return {
      invoice: this.mapInvoiceRow(detail, {
        items: items.map((item) => this.mapInvoiceItemRow(item)),
        payments: payments.map((payment) => this.mapPaymentRow(payment)),
        returns: returnsWithItems
      })
    };
  }

  public async updatePurchase(actor: PurchaseActor, purchaseId: string, input: UpdatePurchaseInput, context: PurchaseRequestContext) {
    const updated = await db.transaction(async (transaction) => {
      const existing = await this.getPurchaseOrThrow(actor.companyId, purchaseId, transaction);
      if (existing.purchaseStatus !== "draft") {
        throw new AppError("Only draft purchases can be edited", 400);
      }

      const supplierId = input.supplierId ?? existing.supplierId;
      const invoiceDate = input.invoiceDate ?? existing.invoiceDate;
      const warehouseId = input.warehouseId !== undefined ? input.warehouseId : existing.warehouseId;
      const existingItems = await purchasesRepository.listPurchaseInvoiceItems(actor.companyId, purchaseId, transaction);

      const draftPayload = await this.buildDraftPayload(
        actor,
        {
          supplierId,
          supplierInvoiceNumber: input.supplierInvoiceNumber ?? existing.supplierInvoiceNumber,
          invoiceDate,
          dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
          warehouseId,
          items:
            input.items ??
            existingItems.map((row) => ({
              productId: row.item.productId,
              warehouseId: row.item.warehouseId,
              batchId: row.item.batchId,
              batchNumber: row.batchNumber,
              quantity: Number(row.item.quantity),
              freeQuantity: Number(row.item.freeQuantity),
              purchaseRate: Number(row.item.purchaseRate),
              priceTaxType: row.item.priceTaxType,
              discountPercent: Number(row.item.discountPercent),
              discountAmount: Number(row.item.discountAmount),
              gstRate: Number(row.item.gstRate),
              cessRate: Number(row.item.cessRate),
              manufacturingDate: row.item.manufacturingDate,
              expiryDate: row.item.expiryDate,
              remarks: row.item.remarks
            })),
          invoiceDiscountTotal: input.invoiceDiscountTotal ?? Number(existing.invoiceDiscountTotal),
          additionalCharges: input.additionalCharges ?? Number(existing.additionalCharges),
          freightCharges: input.freightCharges ?? Number(existing.freightCharges),
          paidAmount: Number(existing.paidAmount),
          paymentMode: existing.paymentMode,
          paymentReference: existing.paymentReference,
          bankAccountId: existing.bankAccountId,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          termsConditions: input.termsConditions !== undefined ? input.termsConditions : existing.termsConditions,
          attachmentUrl: input.attachmentUrl !== undefined ? input.attachmentUrl : existing.attachmentUrl
        },
        transaction,
        purchaseId
      );

      const invoice = await purchasesRepository.updatePurchaseInvoice(
        actor.companyId,
        purchaseId,
        {
          supplierId,
          supplierInvoiceNumber: input.supplierInvoiceNumber ?? existing.supplierInvoiceNumber,
          invoiceDate,
          dueDate: input.dueDate !== undefined ? input.dueDate : existing.dueDate,
          warehouseId,
          paymentStatus: draftPayload.paymentStatus,
          subtotal: draftPayload.invoiceTotals.subtotal,
          itemDiscountTotal: draftPayload.invoiceTotals.itemDiscountTotal,
          invoiceDiscountTotal: draftPayload.invoiceTotals.invoiceDiscountTotal,
          additionalCharges: draftPayload.invoiceTotals.additionalCharges,
          freightCharges: draftPayload.invoiceTotals.freightCharges,
          taxableAmount: draftPayload.invoiceTotals.taxableAmount,
          cgstTotal: draftPayload.invoiceTotals.cgstTotal,
          sgstTotal: draftPayload.invoiceTotals.sgstTotal,
          igstTotal: draftPayload.invoiceTotals.igstTotal,
          cessTotal: draftPayload.invoiceTotals.cessTotal,
          gstTotal: draftPayload.invoiceTotals.gstTotal,
          roundOffAmount: draftPayload.invoiceTotals.roundOffAmount,
          grandTotal: draftPayload.invoiceTotals.grandTotal,
          dueAmount: draftPayload.dueAmount,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          termsConditions: input.termsConditions !== undefined ? input.termsConditions : existing.termsConditions,
          attachmentUrl: input.attachmentUrl !== undefined ? input.attachmentUrl : existing.attachmentUrl,
          updatedBy: actor.id
        },
        transaction
      );

      if (!invoice) {
        throw new AppError("Failed to update purchase invoice", 500);
      }

      await purchasesRepository.deletePurchaseInvoiceItems(actor.companyId, purchaseId, transaction);
      await purchasesRepository.createPurchaseInvoiceItems(
        draftPayload.resolvedItems.map((item, index) => ({
          companyId: actor.companyId,
          purchaseInvoiceId: purchaseId,
          productId: item.product.product.id,
          warehouseId: item.warehouseId,
          batchId: item.batchId,
          lineNumber: index + 1,
          productNameSnapshot: item.product.product.name,
          skuSnapshot: item.product.product.sku,
          hsnSacSnapshot: item.product.product.hsnSacCode,
          unitSnapshot: item.product.unitSymbol ?? item.product.unitName ?? "",
          quantity: item.quantity,
          freeQuantity: item.freeQuantity,
          purchaseRate: item.purchaseRate,
          priceTaxType: item.priceTaxType,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          taxableAmount: draftPayload.calculatedItems[index]!.taxableAmount,
          gstRate: item.gstRate,
          cgstAmount: draftPayload.calculatedItems[index]!.cgstAmount,
          sgstAmount: draftPayload.calculatedItems[index]!.sgstAmount,
          igstAmount: draftPayload.calculatedItems[index]!.igstAmount,
          cessRate: item.cessRate,
          cessAmount: draftPayload.calculatedItems[index]!.cessAmount,
          lineTotal: draftPayload.calculatedItems[index]!.lineTotal,
          manufacturingDate: item.manufacturingDate ?? null,
          expiryDate: item.expiryDate ?? null,
          remarks: item.remarks ?? null
        })),
        transaction
      );

      return invoice;
    });

    await this.logPurchaseAudit(
      actor,
      "purchase_updated",
      updated.id,
      {
        fields: Object.keys(input)
      },
      context
    );

    return this.getPurchase(actor, updated.id);
  }

  public async deletePurchase(actor: PurchaseActor, purchaseId: string, context: PurchaseRequestContext) {
    const deleted = await db.transaction(async (transaction) => {
      const existing = await this.getPurchaseOrThrow(actor.companyId, purchaseId, transaction);
      if (existing.purchaseStatus !== "draft") {
        throw new AppError("Only draft purchases can be deleted", 400);
      }

      const softDeleted = await purchasesRepository.softDeletePurchaseInvoice(actor.companyId, purchaseId, actor.id, transaction);
      if (!softDeleted) {
        throw new AppError("Failed to delete purchase invoice", 500);
      }

      return softDeleted;
    });

    await this.logPurchaseAudit(
      actor,
      "purchase_deleted",
      deleted.id,
      {
        purchaseNumber: deleted.purchaseNumber
      },
      context
    );
  }

  public async postPurchase(actor: PurchaseActor, purchaseId: string, context: PurchaseRequestContext) {
    const mutation = await db.transaction(async (transaction) => {
      const existing = await this.getPurchaseOrThrow(actor.companyId, purchaseId, transaction);
      const items = await purchasesRepository.listPurchaseInvoiceItems(actor.companyId, purchaseId, transaction);
      return this.postPurchaseInTransaction(actor, existing, items, transaction);
    });

    await this.logPurchaseAudit(
      actor,
      "purchase_posted",
      mutation.invoice.id,
      {
        purchaseNumber: mutation.invoice.purchaseNumber
      },
      context
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_stock_updated",
      entityType: "purchase_invoice",
      entityId: mutation.invoice.id,
      metadata: {
        purchaseNumber: mutation.invoice.purchaseNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_payable_updated",
      entityType: "purchase_invoice",
      entityId: mutation.invoice.id,
      metadata: {
        dueAmount: normalizeMoney(mutation.invoice.dueAmount)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await this.syncInventoryAlerts(actor, mutation.stockTouch);
    return this.getPurchase(actor, mutation.invoice.id);
  }

  public async cancelPurchase(actor: PurchaseActor, purchaseId: string, context: PurchaseRequestContext) {
    const mutation = await db.transaction(async (transaction) => {
      const existing = await this.getPurchaseOrThrow(actor.companyId, purchaseId, transaction);
      if (existing.purchaseStatus !== "posted" && existing.purchaseStatus !== "returned") {
        throw new AppError("Only posted purchases can be cancelled", 400);
      }

      const [paymentCount, returnCount, items] = await Promise.all([
        purchasesRepository.countPurchasePayments(actor.companyId, purchaseId, transaction),
        purchasesRepository.countPurchaseReturns(actor.companyId, purchaseId, transaction),
        purchasesRepository.listPurchaseInvoiceItems(actor.companyId, purchaseId, transaction)
      ]);

      if (paymentCount > 0) {
        throw new AppError("Posted purchases with payments cannot be cancelled", 400);
      }

      if (returnCount > 0) {
        throw new AppError("Posted purchases with returns cannot be cancelled", 400);
      }

      const stockTouch = await inventoryService.reducePurchaseStock(
        actor,
        {
          movementDate: new Date(),
          referenceType: "purchase_invoice_cancel",
          referenceId: existing.id,
          referenceNumber: existing.purchaseNumber,
          remarks: existing.notes,
          items: items.map((row) => ({
            productId: row.item.productId,
            warehouseId: row.item.warehouseId,
            batchId: row.item.batchId,
            quantity: addDecimals(row.item.quantity, row.item.freeQuantity, 3),
            movementValue: normalizeMoney(row.item.taxableAmount),
            rate:
              compareDecimals(addDecimals(row.item.quantity, row.item.freeQuantity, 3), "0.000", 3) > 0
                ? divideMoneyByQuantity(row.item.taxableAmount, addDecimals(row.item.quantity, row.item.freeQuantity, 3))
                : normalizeMoney(row.item.purchaseRate)
          }))
        },
        transaction
      );

      await purchasesRepository.createAccountingEvent(
        {
          companyId: actor.companyId,
          eventType: "purchase_cancelled",
          referenceType: "purchase_invoice",
          referenceId: existing.id,
          payload: {
            purchaseNumber: existing.purchaseNumber,
            reversedAmount: normalizeMoney(existing.grandTotal)
          },
          status: "pending"
        },
        transaction
      );

      const updated = await purchasesRepository.updatePurchaseInvoice(
        actor.companyId,
        purchaseId,
        {
          purchaseStatus: "cancelled",
          paymentStatus: "unpaid",
          dueAmount: "0.00",
          cancelledAt: new Date(),
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to cancel purchase invoice", 500);
      }

      return {
        invoice: updated,
        stockTouch
      };
    });

    await this.logPurchaseAudit(
      actor,
      "purchase_cancelled",
      mutation.invoice.id,
      {
        purchaseNumber: mutation.invoice.purchaseNumber
      },
      context
    );

    await this.syncInventoryAlerts(actor, mutation.stockTouch);
    return this.getPurchase(actor, mutation.invoice.id);
  }

  public async listPayments(actor: Pick<PurchaseActor, "companyId">, purchaseId: string, query: ListPurchasePaymentsQuery) {
    await this.getPurchaseOrThrow(actor.companyId, purchaseId);
    const pagination = getPagination(query.page, query.limit);
    const rows = await purchasesRepository.listPurchasePayments(actor.companyId, purchaseId, pagination.page, pagination.limit);
    const total = await purchasesRepository.countPurchasePayments(actor.companyId, purchaseId);
    const totals = await purchasesRepository.getInvoicePaymentTotals(actor.companyId, purchaseId);

    return {
      items: rows.map((row) => this.mapPaymentRow(row)),
      totals: {
        totalAmount: normalizeMoney(totals.totalAmount)
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1
      }
    };
  }

  public async recordPayment(actor: PurchaseActor, purchaseId: string, input: RecordPurchasePaymentInput, context: PurchaseRequestContext) {
    const mutation = await db.transaction(async (transaction) => {
      const existing = await this.getPurchaseOrThrow(actor.companyId, purchaseId, transaction);
      if (existing.purchaseStatus !== "posted" && existing.purchaseStatus !== "returned") {
        throw new AppError("Payments can only be recorded for posted purchases", 400);
      }

      if (input.bankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
      }

      if (compareDecimals(input.amount, existing.dueAmount, 2) > 0) {
        throw new AppError("Payment amount cannot exceed current due amount", 400);
      }

      const payment = await purchasesRepository.createPurchasePayment(
        {
          companyId: actor.companyId,
          purchaseInvoiceId: existing.id,
          supplierId: existing.supplierId,
          paymentDate: input.paymentDate,
          amount: normalizeMoney(input.amount),
          paymentMode: input.paymentMode,
          bankAccountId: input.bankAccountId ?? null,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
          createdBy: actor.id
        },
        transaction
      );

      if (!payment) {
        throw new AppError("Failed to record purchase payment", 500);
      }

      const nextPaidAmount = addDecimals(existing.paidAmount, payment.amount, 2);
      const nextDueAmount = calculateDueAmount(existing.grandTotal, nextPaidAmount);
      const nextPaymentStatus = calculatePaymentStatus({
        grandTotal: existing.grandTotal,
        paidAmount: nextPaidAmount,
        dueDate: existing.dueDate ?? null
      });

      const updatedInvoice = await purchasesRepository.updatePurchaseInvoice(
        actor.companyId,
        purchaseId,
        {
          paidAmount: nextPaidAmount,
          dueAmount: nextDueAmount,
          paymentStatus: nextPaymentStatus,
          paymentMode: payment.paymentMode,
          paymentReference: payment.referenceNumber,
          bankAccountId: payment.bankAccountId,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updatedInvoice) {
        throw new AppError("Failed to update purchase after payment", 500);
      }

      await purchasesRepository.createAccountingEvent(
        {
          companyId: actor.companyId,
          eventType: "purchase_payment_recorded",
          referenceType: "purchase_payment",
          referenceId: payment.id,
          payload: {
            purchaseInvoiceId: existing.id,
            purchaseNumber: existing.purchaseNumber,
            amount: normalizeMoney(payment.amount),
            paymentMode: payment.paymentMode
          },
          status: "pending"
        },
        transaction
      );

      return {
        payment,
        invoice: updatedInvoice
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_payment_recorded",
      entityType: "purchase_payment",
      entityId: mutation.payment.id,
      metadata: {
        purchaseInvoiceId: purchaseId,
        amount: normalizeMoney(mutation.payment.amount)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_payable_updated",
      entityType: "purchase_invoice",
      entityId: purchaseId,
      metadata: {
        dueAmount: normalizeMoney(mutation.invoice.dueAmount)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      payment: this.mapPaymentRow(mutation.payment),
      invoice: {
        id: mutation.invoice.id,
        paidAmount: normalizeMoney(mutation.invoice.paidAmount),
        dueAmount: normalizeMoney(mutation.invoice.dueAmount),
        paymentStatus: mutation.invoice.paymentStatus
      }
    };
  }

  public async recordReturnRefund(
    actor: PurchaseActor,
    purchaseReturnId: string,
    input: RecordPurchaseReturnRefundInput,
    context: PurchaseRequestContext
  ) {
    const mutation = await db.transaction(async (transaction) => {
      const purchaseReturn = await purchasesRepository.findPurchaseReturnById(actor.companyId, purchaseReturnId, transaction);
      if (!purchaseReturn) {
        throw new AppError("Purchase return not found", 404);
      }

      const settlementRows = await purchasesRepository.listPurchaseReturnSettlementRows(
        actor.companyId,
        [purchaseReturn.purchaseInvoiceId],
        transaction
      );
      const adjustmentMap = this.buildReturnAdjustmentMap(settlementRows);
      const refundTotals = await purchasesRepository.getPurchaseReturnRefundTotals(actor.companyId, purchaseReturnId, transaction);
      const remainingAmount = this.clampMoneyToZero(subtractDecimals(
        this.calculateReturnRefundableAmount({
          returnGrandTotal: purchaseReturn.grandTotal,
          adjustedAmount: adjustmentMap.get(purchaseReturn.id) ?? "0.00"
        }),
        refundTotals.refundedAmount,
        2
      ));
      if (compareDecimals(normalizeMoney(input.amount), remainingAmount, 2) > 0) {
        throw new AppError("Refund amount cannot exceed pending refund balance", 400);
      }

      if (input.bankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
      }

      const refund = await purchasesRepository.createPurchaseReturnRefund(
        {
          companyId: actor.companyId,
          purchaseReturnId: purchaseReturn.id,
          supplierId: purchaseReturn.supplierId,
          refundDate: input.refundDate,
          amount: normalizeMoney(input.amount),
          paymentMode: input.paymentMode,
          bankAccountId: input.bankAccountId ?? null,
          referenceNumber: input.referenceNumber ?? null,
          notes: input.notes ?? null,
          createdBy: actor.id
        },
        transaction
      );

      if (!refund) {
        throw new AppError("Failed to record purchase return refund", 500);
      }

      return { refund, purchaseReturn };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_return_refund_recorded",
      entityType: "purchase_return_refund",
      entityId: mutation.refund.id,
      metadata: {
        purchaseReturnId,
        amount: normalizeMoney(mutation.refund.amount)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_payable_updated",
      entityType: "purchase_return",
      entityId: purchaseReturnId,
      metadata: {
        refundAmount: normalizeMoney(mutation.refund.amount)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getReturn(actor, purchaseReturnId);
  }

  public async listReturns(actor: Pick<PurchaseActor, "companyId">, query: ListPurchaseReturnsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await purchasesRepository.listPurchaseReturns({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      supplierId: query.supplierId,
      purchaseInvoiceId: query.purchaseInvoiceId,
      warehouseId: query.warehouseId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });

    const adjustmentMap = this.buildReturnAdjustmentMap(
      await purchasesRepository.listPurchaseReturnSettlementRows(
        actor.companyId,
        Array.from(new Set(result.rows.map((row) => row.purchaseReturn.purchaseInvoiceId)))
      )
    );

    return {
      items: result.rows.map((row) => this.mapReturnRow(row, undefined, adjustmentMap.get(row.purchaseReturn.id))),
      summary: {
        grandTotal: normalizeMoney(result.summary.grandTotal),
        refundedAmount: normalizeMoney(result.summary.refundedAmount)
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async getReturn(actor: Pick<PurchaseActor, "companyId">, purchaseReturnId: string) {
    const detail = await purchasesRepository.findPurchaseReturnDetail(actor.companyId, purchaseReturnId);
    if (!detail) {
      throw new AppError("Purchase return not found", 404);
    }

    const items = await purchasesRepository.listPurchaseReturnItems(actor.companyId, purchaseReturnId);
    const refunds = await purchasesRepository.listPurchaseReturnRefunds(actor.companyId, purchaseReturnId);
    const adjustmentMap = this.buildReturnAdjustmentMap(
      await purchasesRepository.listPurchaseReturnSettlementRows(actor.companyId, [detail.purchaseReturn.purchaseInvoiceId])
    );
    const mappedRefunds = refunds.map((row) => this.mapReturnRefundRow(row));
    return {
      purchaseReturn: {
        ...this.mapReturnRow(detail, {
          items: items.map((row) => this.mapReturnItemRow(row)),
          refunds: mappedRefunds
        }, adjustmentMap.get(detail.purchaseReturn.id), this.sumRefundRows(mappedRefunds))
      }
    };
  }

  public async createReturn(actor: PurchaseActor, input: CreatePurchaseReturnInput, context: PurchaseRequestContext) {
    const mutation = await db.transaction(async (transaction) => {
      const invoice = await this.getPurchaseOrThrow(actor.companyId, input.purchaseInvoiceId, transaction);
      if (invoice.purchaseStatus !== "posted" && invoice.purchaseStatus !== "returned") {
        throw new AppError("Purchase return can only be created for posted purchases", 400);
      }

      if (input.returnDate < invoice.invoiceDate) {
        throw new AppError("Purchase return date cannot be earlier than the purchase invoice date", 400);
      }

      const invoiceItems = await purchasesRepository.listPurchaseInvoiceItems(actor.companyId, invoice.id, transaction);
      const invoiceItemsMap = new Map(invoiceItems.map((row) => [row.item.id, row]));
      const requestedQtyByInvoiceItem = new Map<string, string>();

      for (const item of input.items) {
        const source = invoiceItemsMap.get(item.purchaseInvoiceItemId);
        if (!source) {
          throw new AppError("Purchase return item does not belong to the selected invoice", 400);
        }

        const requestedQty = normalizePurchaseQuantity(item.quantity);
        requestedQtyByInvoiceItem.set(
          item.purchaseInvoiceItemId,
          addDecimals(requestedQtyByInvoiceItem.get(item.purchaseInvoiceItemId) ?? "0.000", requestedQty, 3)
        );
      }

      const returnLines: Array<{
        source: InvoiceItemRow;
        quantity: string;
        returnRate: string;
        taxableAmount: string;
        gstRate: string;
        gstAmount: string;
        lineTotal: string;
      }> = [];

      for (const [purchaseInvoiceItemId, requestedQty] of requestedQtyByInvoiceItem.entries()) {
        const source = invoiceItemsMap.get(purchaseInvoiceItemId)!;
        const alreadyReturnedQty = await purchasesRepository.getReturnedQuantityByInvoiceItem(actor.companyId, source.item.id, transaction);
        const maxReturnQty = addDecimals(source.item.quantity, source.item.freeQuantity, 3);
        const remainingQty = subtractDecimals(maxReturnQty, alreadyReturnedQty, 3);

        if (compareDecimals(requestedQty, remainingQty, 3) > 0) {
          throw new AppError(`Return quantity exceeds remaining quantity for ${source.item.productNameSnapshot}`, 400);
        }

        const effectiveRate =
          compareDecimals(maxReturnQty, "0.000", 3) > 0
            ? divideMoneyByQuantity(source.item.taxableAmount, maxReturnQty)
            : normalizeMoney(source.item.purchaseRate);
        const taxableAmount = this.prorateMoney(source.item.taxableAmount, maxReturnQty, requestedQty);
        const gstAmount = this.prorateMoney(
          addDecimals(addDecimals(source.item.cgstAmount, source.item.sgstAmount, 2), source.item.igstAmount, 2),
          maxReturnQty,
          requestedQty
        );
        const lineTotal = this.prorateMoney(source.item.lineTotal, maxReturnQty, requestedQty);

        returnLines.push({
          source,
          quantity: requestedQty,
          returnRate: effectiveRate,
          taxableAmount,
          gstRate: normalizeMoney(source.item.gstRate),
          gstAmount,
          lineTotal
        });
      }

      const warehouseId = input.warehouseId ?? invoice.warehouseId ?? null;
      if (warehouseId) {
        await this.getWarehouseOrThrow(actor.companyId, warehouseId);
      }

      let subtotal = "0.00";
      let gstTotal = "0.00";
      let grandTotal = "0.00";
      for (const line of returnLines) {
        subtotal = addDecimals(subtotal, line.taxableAmount, 2);
        gstTotal = addDecimals(gstTotal, line.gstAmount, 2);
        grandTotal = addDecimals(grandTotal, line.lineTotal, 2);
      }

      const priorReturnRows = await purchasesRepository.listPurchaseReturnSettlementRows(actor.companyId, [invoice.id], transaction);
      const priorReturnGrandTotal = priorReturnRows.reduce(
        (sum, row) => addDecimals(sum, row.returnGrandTotal, 2),
        "0.00"
      );
      const adjustedAmount = this.calculateReturnAdjustedAmount({
        invoiceGrandTotal: invoice.grandTotal,
        invoicePaidAmount: invoice.paidAmount,
        priorReturnGrandTotal,
        returnGrandTotal: grandTotal
      });
      const initialRefundAmount = normalizeMoney(input.refundAmountReceived ?? 0);
      const availableInitialRefundAmount = this.calculateReturnRefundableAmount({
        returnGrandTotal: grandTotal,
        adjustedAmount
      });
      if (compareDecimals(initialRefundAmount, availableInitialRefundAmount, 2) > 0) {
        throw new AppError("Refund amount cannot exceed refundable balance after pending payment adjustment", 400);
      }

      if (input.refundBankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.refundBankAccountId);
      }

      const returnNumber = await this.getNextReturnNumber(actor.companyId, transaction);
      const purchaseReturn = await purchasesRepository.createPurchaseReturn(
        {
          companyId: actor.companyId,
          returnNumber,
          purchaseInvoiceId: invoice.id,
          supplierId: invoice.supplierId,
          returnDate: input.returnDate,
          warehouseId,
          subtotal,
          gstTotal,
          roundOffAmount: "0.00",
          grandTotal,
          notes: input.notes,
          createdBy: actor.id
        },
        transaction
      );

      if (!purchaseReturn) {
        throw new AppError("Failed to create purchase return", 500);
      }

      let refund: Awaited<ReturnType<typeof purchasesRepository.createPurchaseReturnRefund>> | null = null;
      if (compareDecimals(initialRefundAmount, "0.00", 2) > 0) {
        refund = await purchasesRepository.createPurchaseReturnRefund(
          {
            companyId: actor.companyId,
            purchaseReturnId: purchaseReturn.id,
            supplierId: invoice.supplierId,
            refundDate: input.returnDate,
            amount: initialRefundAmount,
            paymentMode: input.refundPaymentMode!,
            bankAccountId: input.refundBankAccountId ?? null,
            referenceNumber: input.refundReferenceNumber ?? null,
            notes: input.refundNotes ?? input.notes,
            createdBy: actor.id
          },
          transaction
        );

        if (!refund) {
          throw new AppError("Failed to record initial purchase return refund", 500);
        }
      }

      await purchasesRepository.createPurchaseReturnItems(
        returnLines.map((line) => ({
          companyId: actor.companyId,
          purchaseReturnId: purchaseReturn.id,
          purchaseInvoiceItemId: line.source.item.id,
          productId: line.source.item.productId,
          batchId: line.source.item.batchId,
          quantity: line.quantity,
          returnRate: line.returnRate,
          taxableAmount: line.taxableAmount,
          gstRate: line.gstRate,
          gstAmount: line.gstAmount,
          lineTotal: line.lineTotal
        })),
        transaction
      );

      const stockTouch = await inventoryService.reducePurchaseStock(
        actor,
        {
          movementDate: new Date(input.returnDate),
          referenceType: "purchase_return",
          referenceId: purchaseReturn.id,
          referenceNumber: returnNumber,
          remarks: input.notes,
          items: returnLines.map((line) => ({
            productId: line.source.item.productId,
            warehouseId: line.source.item.warehouseId ?? warehouseId,
            batchId: line.source.item.batchId,
            quantity: line.quantity,
            movementValue: line.taxableAmount,
            rate: line.returnRate
          }))
        },
        transaction
      );

      await purchasesRepository.createAccountingEvent(
        {
          companyId: actor.companyId,
          eventType: "purchase_return_created",
          referenceType: "purchase_return",
          referenceId: purchaseReturn.id,
          payload: {
            purchaseInvoiceId: invoice.id,
            purchaseNumber: invoice.purchaseNumber,
            returnNumber,
            amount: grandTotal
          },
          status: "pending"
        },
        transaction
      );

      const nextDueAmount = calculateDueAmount(subtractDecimals(invoice.grandTotal, grandTotal, 2), invoice.paidAmount);
      const nextPaymentStatus = calculatePaymentStatus({
        grandTotal: subtractDecimals(invoice.grandTotal, grandTotal, 2),
        paidAmount: invoice.paidAmount,
        dueDate: invoice.dueDate ?? null
      });
      const nextStatus = await this.determineReturnedStatus(actor.companyId, invoiceItems, transaction);

      const updatedInvoice = await purchasesRepository.updatePurchaseInvoice(
        actor.companyId,
        invoice.id,
        {
          purchaseStatus: nextStatus,
          dueAmount: nextDueAmount,
          paymentStatus: nextPaymentStatus,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updatedInvoice) {
        throw new AppError("Failed to update purchase after return", 500);
      }

      return {
        purchaseReturn,
        refund,
        stockTouch
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_return_created",
      entityType: "purchase_return",
      entityId: mutation.purchaseReturn.id,
      metadata: {
        returnNumber: mutation.purchaseReturn.returnNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    if (mutation.refund) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "purchase_return_refund_recorded",
        entityType: "purchase_return_refund",
        entityId: mutation.refund.id,
        metadata: {
          purchaseReturnId: mutation.purchaseReturn.id,
          amount: normalizeMoney(mutation.refund.amount)
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_stock_updated",
      entityType: "purchase_return",
      entityId: mutation.purchaseReturn.id,
      metadata: {
        returnNumber: mutation.purchaseReturn.returnNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_payable_updated",
      entityType: "purchase_return",
      entityId: mutation.purchaseReturn.id,
      metadata: {
        grandTotal: normalizeMoney(mutation.purchaseReturn.grandTotal)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await this.syncInventoryAlerts(actor, mutation.stockTouch);
    return this.getReturn(actor, mutation.purchaseReturn.id);
  }

  public async exportPurchases(
    actor: PurchaseActor,
    query: ExportPurchasesQuery,
    context: PurchaseRequestContext
  ): Promise<PurchaseExportPayload> {
    const rows = await purchasesRepository.listPurchasesForExport({
      companyId: actor.companyId,
      search: query.search ?? null,
      purchaseStatus: query.purchaseStatus,
      paymentStatus: query.paymentStatus,
      supplierId: query.supplierId,
      warehouseId: query.warehouseId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });
    const dataset: ReportExportDataset = {
      title: "Purchase Invoices",
      columns: [
        { key: "purchaseNumber", label: "Purchase No" },
        { key: "supplierName", label: "Supplier" },
        { key: "supplierInvoiceNumber", label: "Supplier Invoice" },
        { key: "invoiceDate", label: "Invoice Date" },
        { key: "purchaseStatus", label: "Status" },
        { key: "paymentStatus", label: "Payment Status" },
        { key: "grandTotal", label: "Grand Total", type: "number" },
        { key: "paidAmount", label: "Paid", type: "number" },
        { key: "dueAmount", label: "Due", type: "number" }
      ],
      rows: rows.map((row) => ({
        purchaseNumber: row.invoice.purchaseNumber,
        supplierName: row.supplierName,
        supplierInvoiceNumber: row.invoice.supplierInvoiceNumber ?? "",
        invoiceDate: formatDateValue(row.invoice.invoiceDate),
        purchaseStatus: row.invoice.purchaseStatus,
        paymentStatus: row.invoice.paymentStatus,
        grandTotal: Number(normalizeMoney(row.invoice.grandTotal)),
        paidAmount: Number(normalizeMoney(row.invoice.paidAmount)),
        dueAmount: Number(normalizeMoney(row.invoice.dueAmount))
      }))
    };
    const file = buildReportFile(dataset, query.format, `purchases-${new Date().toISOString().slice(0, 10)}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_exported",
      entityType: "purchase_invoice",
      metadata: {
        format: query.format,
        rowCount: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }
  public async generatePurchasePdf(
    actor: PurchaseActor,
    purchaseId: string,
    context: PurchaseRequestContext
  ): Promise<PurchaseExportPayload> {
    const detail = await this.getPurchase(actor, purchaseId);
    const invoice = detail.invoice;
    const items = (invoice.items ?? []) as Array<ReturnType<PurchasesService["mapInvoiceItemRow"]>>;
    const company = await companyRepository.findCompanyById(actor.companyId);

    const dataset: ReportExportDataset = {
      title: `Purchase Invoice ${invoice.purchaseNumber}`,
      subtitle: company?.legalName || company?.name || "Company",
      metadata: [
        { label: "Invoice Date", value: formatDateValue(invoice.invoiceDate) },
        { label: "Due Date", value: formatDateValue(invoice.dueDate) },
        { label: "Supplier", value: invoice.supplier.name },
        { label: "Supplier Code", value: invoice.supplier.supplierCode ?? "-" },
        { label: "Supplier GSTIN", value: invoice.supplier.gstNumber ?? "-" },
        { label: "Warehouse", value: invoice.warehouse?.name ?? "-" },
        { label: "Status", value: invoice.purchaseStatus },
        { label: "Payment Status", value: invoice.paymentStatus }
      ],
      summary: [
        { label: "Subtotal", value: invoice.subtotal },
        { label: "GST Total", value: invoice.gstTotal },
        { label: "Freight", value: invoice.freightCharges },
        { label: "Other Charges", value: invoice.additionalCharges },
        { label: "Round Off", value: invoice.roundOffAmount },
        { label: "Grand Total", value: invoice.grandTotal },
        { label: "Paid Amount", value: invoice.paidAmount },
        { label: "Due Amount", value: invoice.dueAmount }
      ],
      columns: [
        { key: "productName", label: "Product" },
        { key: "quantity", label: "Qty", type: "number" },
        { key: "freeQuantity", label: "Free", type: "number" },
        { key: "purchaseRate", label: "Rate", type: "number" },
        { key: "taxableAmount", label: "Taxable", type: "number" },
        { key: "lineTotal", label: "Total", type: "number" }
      ],
      rows: items.map((item) => ({
        productName: item.productNameSnapshot,
        quantity: Number(item.quantity),
        freeQuantity: Number(item.freeQuantity),
        purchaseRate: Number(item.purchaseRate),
        taxableAmount: Number(item.taxableAmount),
        lineTotal: Number(item.lineTotal)
      })),
      notes: invoice.notes || undefined,
      terms: invoice.termsConditions || undefined
    };

    const file = buildReportFile(dataset, "pdf", invoice.purchaseNumber);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_pdf_generated",
      entityType: "purchase_invoice",
      entityId: purchaseId,
      metadata: {
        mode: "pdf"
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }

  public async exportReturns(
    actor: PurchaseActor,
    query: ExportPurchaseReturnsQuery,
    context: PurchaseRequestContext
  ): Promise<PurchaseExportPayload> {
    const rows = await purchasesRepository.listPurchaseReturnsForExport({
      companyId: actor.companyId,
      search: query.search ?? null,
      supplierId: query.supplierId,
      purchaseInvoiceId: query.purchaseInvoiceId,
      warehouseId: query.warehouseId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });
    const adjustmentMap = this.buildReturnAdjustmentMap(
      await purchasesRepository.listPurchaseReturnSettlementRows(
        actor.companyId,
        Array.from(new Set(rows.map((row) => row.purchaseReturn.purchaseInvoiceId)))
      )
    );
    const dataset: ReportExportDataset = {
      title: "Purchase Returns",
      columns: [
        { key: "returnNumber", label: "Return No" },
        { key: "purchaseNumber", label: "Purchase No" },
        { key: "supplierName", label: "Supplier" },
        { key: "returnDate", label: "Return Date" },
        { key: "grandTotal", label: "Grand Total", type: "number" },
        { key: "adjustedAmount", label: "Adjusted To Due", type: "number" },
        { key: "refundedAmount", label: "Refund Received", type: "number" },
        { key: "remainingRefundAmount", label: "Refund Pending", type: "number" }
      ],
      rows: rows.map((row) => ({
        returnNumber: row.purchaseReturn.returnNumber,
        purchaseNumber: row.purchaseNumber ?? "",
        supplierName: row.supplierName,
        returnDate: formatDateValue(row.purchaseReturn.returnDate),
        grandTotal: Number(normalizeMoney(row.purchaseReturn.grandTotal)),
        adjustedAmount: Number(normalizeMoney(adjustmentMap.get(row.purchaseReturn.id) ?? "0.00")),
        refundedAmount: Number(normalizeMoney(row.refundedAmount)),
        remainingRefundAmount: Number(
          this.clampMoneyToZero(
            subtractDecimals(
              this.calculateReturnRefundableAmount({
                returnGrandTotal: row.purchaseReturn.grandTotal,
                adjustedAmount: adjustmentMap.get(row.purchaseReturn.id) ?? "0.00"
              }),
              row.refundedAmount,
              2
            )
          )
        )
      }))
    };
    const file = buildReportFile(dataset, query.format, `purchase-returns-${new Date().toISOString().slice(0, 10)}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_exported",
      entityType: "purchase_return",
      metadata: {
        format: query.format,
        rowCount: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }

  public async generateReturnPdf(
    actor: PurchaseActor,
    purchaseReturnId: string,
    context: PurchaseRequestContext
  ): Promise<PurchaseExportPayload> {
    const detail = await this.getReturn(actor, purchaseReturnId);
    const purchaseReturn = detail.purchaseReturn;
    const items = purchaseReturn.items as Array<{
      productName: string;
      quantity: string;
      returnRate: string;
      taxableAmount: string;
      gstAmount: string;
      lineTotal: string;
    }>;
    const refunds = (purchaseReturn.refunds ?? []) as Array<{
      refundDate: Date | string;
      amount: string;
      paymentMode: string;
      referenceNumber: string | null;
    }>;

    const company = await companyRepository.findCompanyById(actor.companyId);

    const dataset: ReportExportDataset = {
      title: `Purchase Return ${purchaseReturn.returnNumber}`,
      subtitle: company?.legalName || company?.name || "Company",
      metadata: [
        { label: "Return Date", value: formatDateValue(purchaseReturn.returnDate) },
        { label: "Purchase No", value: purchaseReturn.purchaseNumber ?? "-" },
        { label: "Supplier", value: purchaseReturn.supplierName },
        { label: "Supplier Code", value: purchaseReturn.supplierCode ?? "-" },
        { label: "Warehouse", value: purchaseReturn.warehouse?.name ?? "-" }
      ],
      summary: [
        { label: "Subtotal", value: purchaseReturn.subtotal },
        { label: "GST Total", value: purchaseReturn.gstTotal },
        { label: "Round Off", value: purchaseReturn.roundOffAmount },
        { label: "Grand Total", value: purchaseReturn.grandTotal },
        { label: "Refund Received", value: purchaseReturn.refundedAmount },
        { label: "Refund Pending", value: purchaseReturn.remainingRefundAmount }
      ],
      columns: [
        { key: "productName", label: "Product" },
        { key: "quantity", label: "Qty", type: "number" },
        { key: "returnRate", label: "Rate", type: "number" },
        { key: "taxableAmount", label: "Taxable", type: "number" },
        { key: "gstAmount", label: "GST", type: "number" },
        { key: "lineTotal", label: "Total", type: "number" }
      ],
      rows: items.map((item) => ({
        productName: item.productName,
        quantity: Number(item.quantity),
        returnRate: Number(item.returnRate),
        taxableAmount: Number(item.taxableAmount),
        gstAmount: Number(item.gstAmount),
        lineTotal: Number(item.lineTotal)
      })),
      notes: purchaseReturn.notes || undefined,
      secondaryTable: refunds.length ? {
        title: "Refund Entries",
        columns: [
          { key: "refundDate", label: "Date", type: "date" },
          { key: "paymentMode", label: "Payment Mode" },
          { key: "referenceNumber", label: "Reference" },
          { key: "amount", label: "Amount", type: "number" }
        ],
        rows: refunds.map((refund) => ({
          refundDate: refund.refundDate instanceof Date ? refund.refundDate : new Date(refund.refundDate),
          paymentMode: refund.paymentMode,
          referenceNumber: refund.referenceNumber ?? "-",
          amount: Number(refund.amount)
        }))
      } : undefined
    };

    const file = buildReportFile(dataset, "pdf", purchaseReturn.returnNumber);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "purchase_pdf_generated",
      entityType: "purchase_return",
      entityId: purchaseReturnId,
      metadata: {
        mode: "pdf"
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }
}

export const purchasesService = new PurchasesService();
