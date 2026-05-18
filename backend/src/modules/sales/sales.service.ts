import { db } from "../../db";
import { auditLogService } from "../audit-logs/audit-log.service";
import { companyRepository } from "../company/company.repository";
import { customersRepository } from "../customers/customers.repository";
import { inventoryRepository } from "../inventory/inventory.repository";
import { inventoryService } from "../inventory/inventory.service";
import {
  addDecimals,
  buildCsvBuffer,
  compareDecimals,
  decimalToScaledBigInt,
  divideMoneyByQuantity,
  normalizeMoney,
  normalizeQuantity,
  scaledBigIntToDecimal,
  subtractDecimals,
  toDateOnly
} from "../inventory/inventory.utils";
import { emailService } from "../../services/email.service";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import {
  calculateDueAmount,
  calculateInvoiceTotals,
  calculatePaymentStatus,
  calculateReturnTotals
} from "./sales.calculation";
import { salesRepository } from "./sales.repository";
import type {
  BarcodeLookupQuery,
  CreatePosInvoiceInput,
  CreateSalesInvoiceInput,
  CreateSalesReturnInput,
  ExportSalesInvoicesQuery,
  ExportSalesReturnsQuery,
  ListSalesInvoicesQuery,
  ListSalesPaymentsQuery,
  ListSalesReturnsQuery,
  RecordSalesPaymentInput,
  SendInvoiceEmailInput,
  SendInvoiceWhatsappInput,
  UpdateSalesInvoiceInput
} from "./sales.validator";
import type {
  SalesActor,
  SalesExportPayload,
  SalesInvoiceType,
  SalesRequestContext
} from "./sales.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ProductContextRow = Awaited<ReturnType<typeof inventoryRepository.findProductInventoryContext>>;
type InvoiceRecord = Awaited<ReturnType<typeof salesRepository.findInvoiceById>>;
type InvoiceItemRow = Awaited<ReturnType<typeof salesRepository.listInvoiceItems>>[number];
type CustomerRecord = NonNullable<Awaited<ReturnType<typeof customersRepository.findById>>>;

type AddressSnapshot = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
};

type ResolvedSalesItem = {
  product: NonNullable<ProductContextRow>;
  warehouseId: string;
  batchId: string | null;
  batchNumber: string | null;
  quantity: string;
  saleRate: string;
  mrp: string;
  priceTaxType: "inclusive" | "exclusive";
  discountPercent: string;
  discountAmount: string;
  gstRate: string;
  cessRate: string;
  remarks: string | null;
  isInterState: boolean;
  stockWarning: string | null;
};

type CreateOrUpdatePermissionContext = {
  canOverrideMinimumPrice: boolean;
};

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

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

class SalesService {
  private normalizePrefix(prefix: string | null | undefined, fallback: string) {
    const base = (prefix?.trim() || fallback).replace(/-+$/, "");
    return `${base}-`;
  }

  private buildNextSequenceNumber(previousValue: string | null, prefix: string, padding = 6) {
    const match = previousValue?.match(/(\d+)$/);
    const nextNumber = match ? Number(match[1]) + 1 : 1;
    return `${prefix}${String(Number.isFinite(nextNumber) ? nextNumber : 1).padStart(padding, "0")}`;
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

  private ensureCsvFormat(format: "csv" | "xlsx" | "pdf") {
    if (format !== "csv") {
      throw new AppError("Only CSV export is available right now", 400);
    }
  }

  private buildAddressSnapshot(customer: CustomerRecord, type: "billing" | "shipping"): AddressSnapshot {
    if (type === "billing") {
      return {
        line1: customer.billingAddressLine1,
        line2: customer.billingAddressLine2,
        city: customer.billingCity,
        state: customer.billingState,
        pincode: customer.billingPincode,
        country: customer.billingCountry
      };
    }

    return {
      line1: customer.shippingAddressLine1,
      line2: customer.shippingAddressLine2,
      city: customer.shippingCity,
      state: customer.shippingState,
      pincode: customer.shippingPincode,
      country: customer.shippingCountry
    };
  }

  private mapInvoiceRow(
    row: NonNullable<Awaited<ReturnType<typeof salesRepository.findInvoiceDetail>>>,
    extras?: {
      items?: unknown[];
      payments?: unknown[];
      sendLogs?: unknown[];
      returns?: unknown[];
    }
  ) {
    return {
      id: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      invoiceType: row.invoice.invoiceType,
      invoiceDate: row.invoice.invoiceDate,
      dueDate: row.invoice.dueDate,
      placeOfSupply: row.invoice.placeOfSupply,
      isWalkIn: row.invoice.isWalkIn,
      walkInName: row.invoice.walkInName,
      walkInMobile: row.invoice.walkInMobile,
      customerNameSnapshot: row.invoice.customerNameSnapshot,
      customerGstSnapshot: row.invoice.customerGstSnapshot,
      customerPanSnapshot: row.invoice.customerPanSnapshot,
      billingAddressSnapshot: row.invoice.billingAddressSnapshot,
      shippingAddressSnapshot: row.invoice.shippingAddressSnapshot,
      priceTaxType: row.invoice.priceTaxType,
      invoiceStatus: row.invoice.invoiceStatus,
      paymentStatus: row.invoice.paymentStatus,
      subtotal: normalizeMoney(row.invoice.subtotal),
      itemDiscountTotal: normalizeMoney(row.invoice.itemDiscountTotal),
      invoiceDiscountTotal: normalizeMoney(row.invoice.invoiceDiscountTotal),
      deliveryCharges: normalizeMoney(row.invoice.deliveryCharges),
      packingCharges: normalizeMoney(row.invoice.packingCharges),
      otherCharges: normalizeMoney(row.invoice.otherCharges),
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
      accountingEventCreated: row.invoice.accountingEventCreated,
      postedAt: row.invoice.postedAt,
      cancelledAt: row.invoice.cancelledAt,
      createdBy: row.invoice.createdBy,
      updatedBy: row.invoice.updatedBy,
      createdAt: row.invoice.createdAt,
      updatedAt: row.invoice.updatedAt,
      warehouse: {
        id: row.warehouse.id,
        warehouseCode: row.warehouse.warehouseCode,
        name: row.warehouse.name
      },
      customer: row.customer
        ? {
            id: row.customer.id,
            customerCode: row.customer.customerCode,
            name: row.customer.name,
            mobile: row.customer.mobile,
            email: row.customer.email,
            gstNumber: row.customer.gstNumber
          }
        : null,
      ...(extras?.items ? { items: extras.items } : {}),
      ...(extras?.payments ? { payments: extras.payments } : {}),
      ...(extras?.sendLogs ? { sendLogs: extras.sendLogs } : {}),
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
      saleRate: normalizeMoney(row.item.saleRate),
      mrp: normalizeMoney(row.item.mrp),
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
      returnedQuantity: normalizeQuantity(row.item.returnedQuantity),
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

  private mapPaymentRow(row: typeof import("../../db/schema").salesPayments.$inferSelect) {
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

  private mapReturnRow(
    row:
      | Awaited<ReturnType<typeof salesRepository.listReturns>>["rows"][number]
      | NonNullable<Awaited<ReturnType<typeof salesRepository.findReturnDetail>>>
  ) {
    if ("invoiceNumber" in row) {
      return {
        id: row.salesReturn.id,
        returnNumber: row.salesReturn.returnNumber,
        salesInvoiceId: row.salesReturn.salesInvoiceId,
        invoiceNumber: row.invoiceNumber,
        customerId: row.salesReturn.customerId,
        returnDate: row.salesReturn.returnDate,
        grandTotal: normalizeMoney(row.salesReturn.grandTotal),
        gstTotal: normalizeMoney(row.salesReturn.gstTotal),
        subtotal: normalizeMoney(row.salesReturn.subtotal),
        roundOffAmount: normalizeMoney(row.salesReturn.roundOffAmount),
        warehouse: {
          id: row.salesReturn.warehouseId,
          name: row.warehouseName,
          warehouseCode: row.warehouseCode
        },
        reason: row.salesReturn.reason,
        notes: row.salesReturn.notes,
        createdAt: row.salesReturn.createdAt,
        updatedAt: row.salesReturn.updatedAt
      };
    }

    return {
      id: row.salesReturn.id,
      returnNumber: row.salesReturn.returnNumber,
      salesInvoiceId: row.salesReturn.salesInvoiceId,
      invoiceNumber: row.invoice.invoiceNumber,
      customerId: row.salesReturn.customerId,
      returnDate: row.salesReturn.returnDate,
      grandTotal: normalizeMoney(row.salesReturn.grandTotal),
      gstTotal: normalizeMoney(row.salesReturn.gstTotal),
      subtotal: normalizeMoney(row.salesReturn.subtotal),
      roundOffAmount: normalizeMoney(row.salesReturn.roundOffAmount),
      warehouse: {
        id: row.salesReturn.warehouseId,
        name: row.warehouse.name,
        warehouseCode: row.warehouse.warehouseCode
      },
      reason: row.salesReturn.reason,
      notes: row.salesReturn.notes,
      createdAt: row.salesReturn.createdAt,
      updatedAt: row.salesReturn.updatedAt
    };
  }

  private async getCustomerOrThrow(companyId: string, customerId: string, executor?: TransactionClient) {
    const customer = await customersRepository.findById(companyId, customerId, false, executor);
    if (!customer) {
      throw new AppError("Customer not found", 404);
    }

    if (customer.status !== "active" || customer.deletedAt) {
      throw new AppError("Only active customers can be used for sales", 400);
    }

    if (customer.isBlacklisted) {
      throw new AppError("Blacklisted customers cannot be used for sales", 400);
    }

    return customer;
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
      throw new AppError("Only active warehouses can be used for sales", 400);
    }

    return warehouse;
  }

  private async getInvoiceOrThrow(companyId: string, invoiceId: string, executor?: TransactionClient) {
    const invoice = await salesRepository.findInvoiceById(companyId, invoiceId, executor);
    if (!invoice) {
      throw new AppError("Sales invoice not found", 404);
    }

    return invoice;
  }

  private async getInvoiceSettings(companyId: string) {
    return companyRepository.findInvoiceSettingsByCompanyId(companyId);
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

  private derivePlaceOfSupply(inputPlaceOfSupply: string | null | undefined, customer: CustomerRecord | null, companyState: string | null) {
    const derived =
      inputPlaceOfSupply?.trim() ||
      customer?.shippingState?.trim() ||
      customer?.billingState?.trim() ||
      companyState ||
      null;

    if (!derived) {
      throw new AppError("Place of supply is required", 400);
    }

    return derived;
  }

  private async getNextInvoiceNumber(companyId: string, invoiceType: SalesInvoiceType, executor: TransactionClient) {
    const settings = await this.getInvoiceSettings(companyId);
    const padding = settings?.numberPadding && settings.numberPadding > 0 ? settings.numberPadding : 6;
    const prefix =
      invoiceType === "pos"
        ? this.normalizePrefix("POS", "POS")
        : this.normalizePrefix(settings?.salesInvoicePrefix, "INV");
    await salesRepository.acquireScopedLock(`sales-invoice-number:${invoiceType}`, companyId, executor);
    const latest = await salesRepository.findLatestInvoiceNumber(companyId, invoiceType, executor);
    return this.buildNextSequenceNumber(latest, prefix, padding);
  }

  private async getNextReturnNumber(companyId: string, executor: TransactionClient) {
    await salesRepository.acquireScopedLock("sales-return-number", companyId, executor);
    const latest = await salesRepository.findLatestReturnNumber(companyId, executor);
    return this.buildNextSequenceNumber(latest, "SR-", 6);
  }

  private async assertCreditLimit(
    companyId: string,
    customer: CustomerRecord,
    nextDueAmount: string,
    excludeInvoiceId?: string
  ) {
    if (compareDecimals(nextDueAmount, "0.00", 2) <= 0) {
      return;
    }

    const totals = await customersRepository.getCustomerTransactionTotals(companyId, customer.id, excludeInvoiceId);
    const openingAmount = decimalToScaledBigInt(customer.openingBalanceAmount, 2);
    const signedOpening =
      customer.openingBalanceType === "debit"
        ? openingAmount
        : customer.openingBalanceType === "credit"
          ? openingAmount * -1n
          : 0n;
    const outstanding =
      signedOpening +
      decimalToScaledBigInt(totals.totalSales, 2) -
      decimalToScaledBigInt(totals.totalReturns, 2) -
      decimalToScaledBigInt(totals.totalPayments, 2);
    const nextOutstanding = outstanding + decimalToScaledBigInt(nextDueAmount, 2);
    const creditLimit = decimalToScaledBigInt(customer.creditLimit, 2);

    if (creditLimit > 0n && nextOutstanding > creditLimit) {
      throw new AppError("Customer credit limit exceeded for this sale", 409);
    }
  }

  private async resolveSalesItems(
    companyId: string,
    placeOfSupply: string,
    invoiceWarehouseId: string,
    invoicePriceTaxType: "inclusive" | "exclusive",
    items: CreateSalesInvoiceInput["items"] | NonNullable<UpdateSalesInvoiceInput["items"]>,
    permissions: CreateOrUpdatePermissionContext,
    executor?: TransactionClient
  ) {
    const { company } = await this.getCompanyTaxContext(companyId);
    const companyState = this.normalizeState(company.state);
    const placeState = this.normalizeState(placeOfSupply);
    const stockRequests = new Map<string, string>();
    const resolvedItems: ResolvedSalesItem[] = [];

    for (const item of items) {
      const productRow = await inventoryRepository.findProductInventoryContext(companyId, item.productId, executor);
      if (!productRow) {
        throw new AppError("Product not found", 404);
      }

      if (productRow.product.deletedAt || productRow.product.status !== "active") {
        throw new AppError(`Only active products can be used in sales: ${productRow.product.name}`, 400);
      }

      const quantity = normalizeQuantity(item.quantity);
      if (!productRow.unitDecimalAllowed && this.hasFractionalQuantity(quantity)) {
        throw new AppError(`Decimal quantity is not allowed for ${productRow.product.name}`, 400);
      }

      const warehouseId = item.warehouseId ?? invoiceWarehouseId;
      if (productRow.product.productType === "goods" && !warehouseId) {
        throw new AppError(`Warehouse is required for goods product ${productRow.product.name}`, 400);
      }

      if (warehouseId) {
        await this.getWarehouseOrThrow(companyId, warehouseId);
      }

      const batchId = item.batchId ?? null;
      let batchNumber: string | null = null;
      let stockWarning: string | null = null;

      if (productRow.product.batchTrackingEnabled) {
        if (!batchId) {
          throw new AppError(`Batch is required for ${productRow.product.name}`, 400);
        }

        const batchRow = await inventoryRepository.findBatchById(companyId, batchId, false, executor);
        if (!batchRow) {
          throw new AppError(`Batch not found for ${productRow.product.name}`, 404);
        }

        if (batchRow.batch.productId !== productRow.product.id || batchRow.batch.warehouseId !== warehouseId) {
          throw new AppError(`Batch does not belong to ${productRow.product.name} in the selected warehouse`, 400);
        }

        if (batchRow.batch.status === "expired" || (batchRow.batch.expiryDate && toDateOnly(batchRow.batch.expiryDate) < toDateOnly(new Date()))) {
          throw new AppError(`Expired batch cannot be sold for ${productRow.product.name}`, 400);
        }

        batchNumber = batchRow.batch.batchNumber;
        if (batchRow.batch.expiryDate) {
          const today = new Date();
          const nearExpiry = new Date(batchRow.batch.expiryDate);
          nearExpiry.setDate(nearExpiry.getDate() - 7);
          if (today >= nearExpiry) {
            stockWarning = `Batch ${batchNumber} for ${productRow.product.name} is near expiry`;
          }
        }
      } else if (batchId) {
        throw new AppError(`Batch is not supported for ${productRow.product.name}`, 400);
      }

      const saleRate = normalizeMoney(item.saleRate ?? productRow.product.salePrice);
      if (
        compareDecimals(saleRate, productRow.product.minimumSalePrice, 2) < 0 &&
        !permissions.canOverrideMinimumPrice
      ) {
        throw new AppError(`Sale rate cannot be below minimum sale price for ${productRow.product.name}`, 400);
      }

      const gstRate =
        productRow.product.taxType === "taxable"
          ? normalizeMoney(item.gstRate ?? productRow.product.gstRate)
          : "0.00";
      const cessRate =
        productRow.product.taxType === "taxable"
          ? normalizeMoney(item.cessRate ?? productRow.product.cessRate)
          : "0.00";

      const priceTaxType = item.priceTaxType ?? invoicePriceTaxType;
      const mrp = normalizeMoney(item.mrp ?? productRow.product.mrp);

      if (productRow.product.productType === "goods" && productRow.product.stockTrackingEnabled && warehouseId) {
        const key = `${productRow.product.id}:${warehouseId}:${batchId ?? "no-batch"}`;
        const requestedSoFar = stockRequests.get(key) ?? "0.000";
        const requestedTotal = addDecimals(requestedSoFar, quantity, 3);
        stockRequests.set(key, requestedTotal);

        const balance = await inventoryRepository.findStockBalance(companyId, productRow.product.id, warehouseId, batchId, executor);
        const available = balance?.availableQuantity ?? "0.000";
        if (!productRow.product.negativeStockAllowed && compareDecimals(requestedTotal, available, 3) > 0) {
          throw new AppError(`Insufficient stock for ${productRow.product.name}`, 409);
        }
      }

      resolvedItems.push({
        product: productRow,
        warehouseId,
        batchId,
        batchNumber,
        quantity,
        saleRate,
        mrp,
        priceTaxType,
        discountPercent: normalizeMoney(item.discountPercent ?? 0),
        discountAmount: normalizeMoney(item.discountAmount ?? 0),
        gstRate,
        cessRate,
        remarks: item.remarks ?? null,
        isInterState: Boolean(companyState && placeState && companyState !== placeState),
        stockWarning
      });
    }

    return resolvedItems;
  }

  private buildAccountingPayload(invoice: typeof import("../../db/schema").salesInvoices.$inferSelect) {
    const revenueAmount = addDecimals(
      addDecimals(addDecimals(invoice.taxableAmount, invoice.deliveryCharges, 2), invoice.packingCharges, 2),
      invoice.otherCharges,
      2
    );
    const entries: Array<{ account: string; side: "debit" | "credit"; amount: string }> = [];

    if (compareDecimals(invoice.dueAmount, "0.00", 2) > 0) {
      entries.push({
        account: "Customer",
        side: "debit",
        amount: normalizeMoney(invoice.dueAmount)
      });
    }

    if (compareDecimals(invoice.paidAmount, "0.00", 2) > 0) {
      entries.push({
        account: invoice.paymentMode === "cash" ? "Cash" : "Bank",
        side: "debit",
        amount: normalizeMoney(invoice.paidAmount)
      });
    }

    entries.push({
      account: "Sales",
      side: "credit",
      amount: normalizeMoney(revenueAmount)
    });

    if (compareDecimals(invoice.gstTotal, "0.00", 2) > 0 || compareDecimals(invoice.cessTotal, "0.00", 2) > 0) {
      entries.push({
        account: "Output GST",
        side: "credit",
        amount: normalizeMoney(addDecimals(invoice.gstTotal, invoice.cessTotal, 2))
      });
    }

    if (compareDecimals(invoice.roundOffAmount, "0.00", 2) !== 0) {
      entries.push({
        account: "Round Off",
        side: compareDecimals(invoice.roundOffAmount, "0.00", 2) > 0 ? "credit" : "debit",
        amount: normalizeMoney(invoice.roundOffAmount)
      });
    }

    return {
      salesInvoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      entries
    };
  }

  private buildSalesReturnAccountingPayload(salesReturn: typeof import("../../db/schema").salesReturns.$inferSelect) {
    return {
      salesReturnId: salesReturn.id,
      returnNumber: salesReturn.returnNumber,
      salesInvoiceId: salesReturn.salesInvoiceId,
      customerId: salesReturn.customerId,
      entries: [
        {
          account: "Sales Return",
          side: "debit",
          amount: normalizeMoney(salesReturn.subtotal)
        },
        {
          account: "Output GST Reversal",
          side: "debit",
          amount: normalizeMoney(salesReturn.gstTotal)
        },
        {
          account: "Customer",
          side: "credit",
          amount: normalizeMoney(salesReturn.grandTotal)
        }
      ]
    };
  }

  private async createInitialPaymentIfNeeded(
    actor: SalesActor,
    invoice: typeof import("../../db/schema").salesInvoices.$inferSelect,
    executor: TransactionClient
  ) {
    if (compareDecimals(invoice.paidAmount, "0.00", 2) <= 0) {
      return null;
    }

    if (!invoice.paymentMode) {
      throw new AppError("Payment mode is required when initial payment is present", 400);
    }

    return salesRepository.createPayment(
      {
        companyId: actor.companyId,
        salesInvoiceId: invoice.id,
        customerId: invoice.customerId,
        paymentDate: invoice.invoiceDate,
        amount: normalizeMoney(invoice.paidAmount),
        paymentMode: invoice.paymentMode,
        bankAccountId: invoice.bankAccountId,
        referenceNumber: invoice.paymentReference,
        notes: invoice.notes,
        createdBy: actor.id
      },
      executor
    );
  }

  private async postInvoiceWithinTransaction(
    actor: SalesActor,
    invoice: typeof import("../../db/schema").salesInvoices.$inferSelect,
    items: InvoiceItemRow[],
    executor: TransactionClient
  ) {
    await inventoryService.reduceSalesStock(
      actor,
      {
        movementDate: new Date(invoice.invoiceDate),
        referenceType: "sales_invoice",
        referenceId: invoice.id,
        referenceNumber: invoice.invoiceNumber,
        remarks: invoice.notes,
        items: items.map((row) => ({
          productId: row.item.productId,
          warehouseId: row.item.warehouseId,
          batchId: row.item.batchId,
          quantity: row.item.quantity,
          rate: row.item.saleRate
        }))
      },
      executor
    );

    await this.createInitialPaymentIfNeeded(actor, invoice, executor);
    const accountingEvent = await salesRepository.createAccountingEvent(
      {
        companyId: actor.companyId,
        eventType: "sales_invoice_posted",
        referenceType: "sales_invoice",
        referenceId: invoice.id,
        payload: this.buildAccountingPayload(invoice),
        status: "pending"
      },
      executor
    );

    const updated = await salesRepository.updateInvoice(
      actor.companyId,
      invoice.id,
      {
        invoiceStatus: "posted",
        accountingEventCreated: Boolean(accountingEvent),
        postedAt: new Date(),
        updatedBy: actor.id
      },
      executor
    );

    if (!updated) {
      throw new AppError("Failed to post sales invoice", 500);
    }

    return updated;
  }

  private async determineReturnStatus(companyId: string, invoiceId: string, executor: TransactionClient) {
    const items = await salesRepository.listInvoiceItems(companyId, invoiceId, executor);
    const fullyReturned = items.every((row) => compareDecimals(row.item.returnedQuantity, row.item.quantity, 3) >= 0);
    return fullyReturned ? "returned" : "partially_returned";
  }

  private async loadInvoicePayload(companyId: string, invoiceId: string) {
    const detail = await salesRepository.findInvoiceDetail(companyId, invoiceId);
    if (!detail) {
      throw new AppError("Sales invoice not found", 404);
    }

    const [items, payments, sendLogs, returns] = await Promise.all([
      salesRepository.listInvoiceItems(companyId, invoiceId),
      salesRepository.listPayments(companyId, invoiceId),
      salesRepository.listSendLogs(companyId, invoiceId),
      salesRepository.listReturns({
        companyId,
        page: 1,
        limit: 100,
        salesInvoiceId: invoiceId
      })
    ]);

    return this.mapInvoiceRow(detail, {
      items: items.map((row) => this.mapInvoiceItemRow(row)),
      payments: payments.map((row) => this.mapPaymentRow(row)),
      sendLogs: sendLogs.map((row) => ({
        id: row.id,
        channel: row.channel,
        sentTo: row.sentTo,
        status: row.status,
        errorMessage: row.errorMessage,
        sentAt: row.sentAt,
        createdBy: row.createdBy,
        createdAt: row.createdAt
      })),
      returns: returns.rows.map((row) => this.mapReturnRow(row))
    });
  }

  public async listInvoices(actor: Pick<SalesActor, "companyId">, query: ListSalesInvoicesQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await salesRepository.listInvoices({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      invoiceStatus: query.invoiceStatus,
      paymentStatus: query.paymentStatus,
      customerId: query.customerId,
      warehouseId: query.warehouseId,
      invoiceType: query.invoiceType,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });

    return {
      items: result.rows.map((row) => ({
        id: row.invoice.id,
        invoiceNumber: row.invoice.invoiceNumber,
        invoiceType: row.invoice.invoiceType,
        invoiceDate: row.invoice.invoiceDate,
        customerId: row.invoice.customerId,
        customerName: row.invoice.customerNameSnapshot,
        walkInName: row.invoice.walkInName,
        warehouse: {
          id: row.invoice.warehouseId,
          name: row.warehouseName,
          warehouseCode: row.warehouseCode
        },
        invoiceStatus: row.invoice.invoiceStatus,
        paymentStatus: row.invoice.paymentStatus,
        grandTotal: normalizeMoney(row.invoice.grandTotal),
        paidAmount: normalizeMoney(row.invoice.paidAmount),
        dueAmount: normalizeMoney(row.invoice.dueAmount),
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

  public async getInvoice(actor: Pick<SalesActor, "companyId">, invoiceId: string) {
    return {
      invoice: await this.loadInvoicePayload(actor.companyId, invoiceId)
    };
  }

  public async createInvoice(
    actor: SalesActor,
    input: CreateSalesInvoiceInput | CreatePosInvoiceInput,
    context: SalesRequestContext,
    permissions: CreateOrUpdatePermissionContext
  ) {
    const mutation = await db.transaction(async (transaction) => {
      const settings = await this.getInvoiceSettings(actor.companyId);
      const { company } = await this.getCompanyTaxContext(actor.companyId);
      const companyState = company.state?.trim() ?? null;

      let customer: CustomerRecord | null = null;
      if (!input.isWalkIn && input.customerId) {
        customer = await this.getCustomerOrThrow(actor.companyId, input.customerId, transaction);
      }

      if (input.bankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
      }

      await this.getWarehouseOrThrow(actor.companyId, input.warehouseId);

      const placeOfSupply = this.derivePlaceOfSupply(input.placeOfSupply, customer, companyState);
      const resolvedItems = await this.resolveSalesItems(
        actor.companyId,
        placeOfSupply,
        input.warehouseId,
        input.priceTaxType,
        input.items,
        permissions,
        transaction
      );
      const calculated = calculateInvoiceTotals({
        items: resolvedItems.map((item) => ({
          quantity: item.quantity,
          saleRate: item.saleRate,
          priceTaxType: item.priceTaxType,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          gstRate: item.gstRate,
          cessRate: item.cessRate,
          isInterState: item.isInterState
        })),
        invoiceDiscountTotal: input.invoiceDiscountTotal,
        deliveryCharges: input.deliveryCharges,
        packingCharges: input.packingCharges,
        otherCharges: input.otherCharges,
        roundOffEnabled: settings?.roundOffEnabled ?? true
      });

      const paidAmount = normalizeMoney(input.paidAmount ?? 0);
      if (compareDecimals(paidAmount, calculated.grandTotal, 2) > 0) {
        throw new AppError("Paid amount cannot exceed grand total", 400);
      }

      const dueAmount = calculateDueAmount(calculated.grandTotal, paidAmount);
      const paymentStatus = calculatePaymentStatus({
        grandTotal: calculated.grandTotal,
        paidAmount,
        dueDate: input.dueDate ?? null
      });

      if (customer) {
        await this.assertCreditLimit(actor.companyId, customer, dueAmount);
      }

      const invoiceNumber = await this.getNextInvoiceNumber(actor.companyId, input.invoiceType, transaction);
      const invoice = await salesRepository.createInvoice(
        {
          companyId: actor.companyId,
          invoiceNumber,
          invoiceType: input.invoiceType,
          customerId: customer?.id ?? null,
          isWalkIn: input.isWalkIn,
          walkInName: input.isWalkIn ? input.walkInName ?? "Walk-in Customer" : null,
          walkInMobile: input.isWalkIn ? input.walkInMobile ?? null : null,
          customerNameSnapshot: customer?.name ?? (input.walkInName ?? "Walk-in Customer"),
          customerGstSnapshot: customer?.gstNumber ?? null,
          customerPanSnapshot: customer?.panNumber ?? null,
          billingAddressSnapshot: customer ? this.buildAddressSnapshot(customer, "billing") : null,
          shippingAddressSnapshot: customer ? this.buildAddressSnapshot(customer, "shipping") : null,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate ?? null,
          placeOfSupply,
          warehouseId: input.warehouseId,
          priceTaxType: input.priceTaxType,
          invoiceStatus: input.invoiceStatus,
          paymentStatus,
          subtotal: calculated.subtotal,
          itemDiscountTotal: calculated.itemDiscountTotal,
          invoiceDiscountTotal: calculated.invoiceDiscountTotal,
          deliveryCharges: calculated.deliveryCharges,
          packingCharges: calculated.packingCharges,
          otherCharges: calculated.otherCharges,
          taxableAmount: calculated.taxableAmount,
          cgstTotal: calculated.cgstTotal,
          sgstTotal: calculated.sgstTotal,
          igstTotal: calculated.igstTotal,
          cessTotal: calculated.cessTotal,
          gstTotal: calculated.gstTotal,
          roundOffAmount: calculated.roundOffAmount,
          grandTotal: calculated.grandTotal,
          paidAmount,
          dueAmount,
          paymentMode: input.paymentMode ?? null,
          paymentReference: input.paymentReference ?? null,
          bankAccountId: input.bankAccountId ?? null,
          notes: input.notes ?? null,
          termsConditions: input.termsConditions ?? settings?.termsAndConditions ?? null,
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!invoice) {
        throw new AppError("Failed to create sales invoice", 500);
      }

      await salesRepository.createInvoiceItems(
        resolvedItems.map((item, index) => ({
          companyId: actor.companyId,
          salesInvoiceId: invoice.id,
          productId: item.product.product.id,
          warehouseId: item.product.product.productType === "goods" ? item.warehouseId : null,
          batchId: item.batchId,
          lineNumber: index + 1,
          productNameSnapshot: item.product.product.name,
          skuSnapshot: item.product.product.sku,
          hsnSacSnapshot: item.product.product.hsnSacCode,
          unitSnapshot: item.product.unitSymbol ?? item.product.unitName ?? "",
          quantity: item.quantity,
          saleRate: item.saleRate,
          mrp: item.mrp,
          priceTaxType: item.priceTaxType,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          taxableAmount: calculated.lines[index]!.taxableAmount,
          gstRate: item.gstRate,
          cgstAmount: calculated.lines[index]!.cgstAmount,
          sgstAmount: calculated.lines[index]!.sgstAmount,
          igstAmount: calculated.lines[index]!.igstAmount,
          cessRate: item.cessRate,
          cessAmount: calculated.lines[index]!.cessAmount,
          lineTotal: calculated.lines[index]!.lineTotal,
          remarks: item.remarks
        })),
        transaction
      );

      let finalInvoice = invoice;
      if (input.invoiceStatus === "posted") {
        const invoiceItems = await salesRepository.listInvoiceItems(actor.companyId, invoice.id, transaction);
        finalInvoice = await this.postInvoiceWithinTransaction(actor, invoice, invoiceItems, transaction);
      }

      return {
        invoice: finalInvoice,
        warnings: resolvedItems.map((item) => item.stockWarning).filter((value): value is string => Boolean(value))
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_invoice_created",
      entityType: "sales_invoice",
      entityId: mutation.invoice.id,
      metadata: {
        invoiceNumber: mutation.invoice.invoiceNumber,
        invoiceStatus: mutation.invoice.invoiceStatus,
        warnings: mutation.warnings
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    if (mutation.invoice.invoiceStatus === "posted") {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "sales_invoice_posted",
        entityType: "sales_invoice",
        entityId: mutation.invoice.id,
        metadata: {
          invoiceNumber: mutation.invoice.invoiceNumber
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "sales_stock_reduced",
        entityType: "sales_invoice",
        entityId: mutation.invoice.id,
        metadata: {
          invoiceNumber: mutation.invoice.invoiceNumber
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });

      if (compareDecimals(mutation.invoice.dueAmount, "0.00", 2) > 0 && mutation.invoice.customerId) {
        await auditLogService.log({
          companyId: actor.companyId,
          userId: actor.id,
          action: "sales_receivable_created",
          entityType: "sales_invoice",
          entityId: mutation.invoice.id,
          metadata: {
            dueAmount: normalizeMoney(mutation.invoice.dueAmount)
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        });
      }
    }

    return {
      invoice: await this.loadInvoicePayload(actor.companyId, mutation.invoice.id),
      warnings: mutation.warnings
    };
  }

  public async createPosInvoice(
    actor: SalesActor,
    input: CreatePosInvoiceInput,
    context: SalesRequestContext,
    permissions: CreateOrUpdatePermissionContext
  ) {
    return this.createInvoice(actor, { ...input, invoiceType: "pos", invoiceStatus: "posted" }, context, permissions);
  }

  public async updateInvoice(
    actor: SalesActor,
    invoiceId: string,
    input: UpdateSalesInvoiceInput,
    context: SalesRequestContext,
    permissions: CreateOrUpdatePermissionContext
  ) {
    const mutation = await db.transaction(async (transaction) => {
      const existing = await this.getInvoiceOrThrow(actor.companyId, invoiceId, transaction);
      if (existing.invoiceStatus !== "draft") {
        throw new AppError("Only draft invoices can be updated", 400);
      }

      const settings = await this.getInvoiceSettings(actor.companyId);
      const { company } = await this.getCompanyTaxContext(actor.companyId);
      const currentCustomer =
        existing.customerId ? await this.getCustomerOrThrow(actor.companyId, existing.customerId, transaction) : null;
      const customerId = input.customerId !== undefined ? input.customerId : existing.customerId;
      const customer = customerId ? await this.getCustomerOrThrow(actor.companyId, customerId, transaction) : null;
      const isWalkIn = input.isWalkIn ?? existing.isWalkIn;

      if (!isWalkIn && !customer) {
        throw new AppError("Customer is required unless this is a walk-in sale", 400);
      }

      const warehouseId = input.warehouseId ?? existing.warehouseId;
      await this.getWarehouseOrThrow(actor.companyId, warehouseId);

      if (input.bankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
      }

      const placeOfSupply = this.derivePlaceOfSupply(
        input.placeOfSupply ?? existing.placeOfSupply,
        customer,
        company.state?.trim() ?? null
      );
      const itemsInput = input.items ?? (await salesRepository.listInvoiceItems(actor.companyId, existing.id, transaction)).map((row) => ({
        productId: row.item.productId,
        warehouseId: row.item.warehouseId,
        batchId: row.item.batchId,
        quantity: Number(row.item.quantity),
        saleRate: Number(row.item.saleRate),
        mrp: Number(row.item.mrp),
        priceTaxType: row.item.priceTaxType,
        discountPercent: Number(row.item.discountPercent),
        discountAmount: Number(row.item.discountAmount),
        gstRate: Number(row.item.gstRate),
        cessRate: Number(row.item.cessRate),
        remarks: row.item.remarks
      }));

      const priceTaxType = input.priceTaxType ?? existing.priceTaxType;
      const resolvedItems = await this.resolveSalesItems(
        actor.companyId,
        placeOfSupply,
        warehouseId,
        priceTaxType,
        itemsInput,
        permissions,
        transaction
      );
      const calculated = calculateInvoiceTotals({
        items: resolvedItems.map((item) => ({
          quantity: item.quantity,
          saleRate: item.saleRate,
          priceTaxType: item.priceTaxType,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          gstRate: item.gstRate,
          cessRate: item.cessRate,
          isInterState: item.isInterState
        })),
        invoiceDiscountTotal: input.invoiceDiscountTotal ?? existing.invoiceDiscountTotal,
        deliveryCharges: input.deliveryCharges ?? existing.deliveryCharges,
        packingCharges: input.packingCharges ?? existing.packingCharges,
        otherCharges: input.otherCharges ?? existing.otherCharges,
        roundOffEnabled: settings?.roundOffEnabled ?? true
      });

      const paidAmount = normalizeMoney(input.paidAmount ?? existing.paidAmount);
      if (compareDecimals(paidAmount, calculated.grandTotal, 2) > 0) {
        throw new AppError("Paid amount cannot exceed grand total", 400);
      }

      const dueDate = input.dueDate !== undefined ? input.dueDate : existing.dueDate;
      const dueAmount = calculateDueAmount(calculated.grandTotal, paidAmount);
      const paymentStatus = calculatePaymentStatus({
        grandTotal: calculated.grandTotal,
        paidAmount,
        dueDate
      });

      if (customer) {
        await this.assertCreditLimit(actor.companyId, customer, dueAmount, existing.id);
      }

      const updatedInvoice = await salesRepository.updateInvoice(
        actor.companyId,
        invoiceId,
        {
          customerId: customer?.id ?? null,
          isWalkIn,
          walkInName: isWalkIn ? input.walkInName ?? existing.walkInName ?? "Walk-in Customer" : null,
          walkInMobile: isWalkIn ? input.walkInMobile ?? existing.walkInMobile : null,
          customerNameSnapshot: customer?.name ?? (input.walkInName ?? existing.walkInName ?? "Walk-in Customer"),
          customerGstSnapshot: customer?.gstNumber ?? null,
          customerPanSnapshot: customer?.panNumber ?? null,
          billingAddressSnapshot: customer ? this.buildAddressSnapshot(customer, "billing") : null,
          shippingAddressSnapshot: customer ? this.buildAddressSnapshot(customer, "shipping") : null,
          invoiceDate: input.invoiceDate ?? existing.invoiceDate,
          dueDate: dueDate ?? null,
          placeOfSupply,
          warehouseId,
          priceTaxType,
          paymentStatus,
          subtotal: calculated.subtotal,
          itemDiscountTotal: calculated.itemDiscountTotal,
          invoiceDiscountTotal: calculated.invoiceDiscountTotal,
          deliveryCharges: calculated.deliveryCharges,
          packingCharges: calculated.packingCharges,
          otherCharges: calculated.otherCharges,
          taxableAmount: calculated.taxableAmount,
          cgstTotal: calculated.cgstTotal,
          sgstTotal: calculated.sgstTotal,
          igstTotal: calculated.igstTotal,
          cessTotal: calculated.cessTotal,
          gstTotal: calculated.gstTotal,
          roundOffAmount: calculated.roundOffAmount,
          grandTotal: calculated.grandTotal,
          paidAmount,
          dueAmount,
          paymentMode: input.paymentMode !== undefined ? input.paymentMode : existing.paymentMode,
          paymentReference: input.paymentReference !== undefined ? input.paymentReference : existing.paymentReference,
          bankAccountId: input.bankAccountId !== undefined ? input.bankAccountId : existing.bankAccountId,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          termsConditions: input.termsConditions !== undefined ? input.termsConditions : existing.termsConditions,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updatedInvoice) {
        throw new AppError("Failed to update sales invoice", 500);
      }

      await salesRepository.deleteInvoiceItems(actor.companyId, existing.id, transaction);
      await salesRepository.createInvoiceItems(
        resolvedItems.map((item, index) => ({
          companyId: actor.companyId,
          salesInvoiceId: existing.id,
          productId: item.product.product.id,
          warehouseId: item.product.product.productType === "goods" ? item.warehouseId : null,
          batchId: item.batchId,
          lineNumber: index + 1,
          productNameSnapshot: item.product.product.name,
          skuSnapshot: item.product.product.sku,
          hsnSacSnapshot: item.product.product.hsnSacCode,
          unitSnapshot: item.product.unitSymbol ?? item.product.unitName ?? "",
          quantity: item.quantity,
          saleRate: item.saleRate,
          mrp: item.mrp,
          priceTaxType: item.priceTaxType,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          taxableAmount: calculated.lines[index]!.taxableAmount,
          gstRate: item.gstRate,
          cgstAmount: calculated.lines[index]!.cgstAmount,
          sgstAmount: calculated.lines[index]!.sgstAmount,
          igstAmount: calculated.lines[index]!.igstAmount,
          cessRate: item.cessRate,
          cessAmount: calculated.lines[index]!.cessAmount,
          lineTotal: calculated.lines[index]!.lineTotal,
          remarks: item.remarks
        })),
        transaction
      );

      return {
        invoice: updatedInvoice,
        warnings: resolvedItems.map((item) => item.stockWarning).filter((value): value is string => Boolean(value)),
        previousCustomerId: currentCustomer?.id ?? null
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_invoice_updated",
      entityType: "sales_invoice",
      entityId: mutation.invoice.id,
      metadata: {
        warnings: mutation.warnings
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      invoice: await this.loadInvoicePayload(actor.companyId, mutation.invoice.id),
      warnings: mutation.warnings
    };
  }

  public async deleteInvoice(actor: SalesActor, invoiceId: string, context: SalesRequestContext) {
    const deleted = await db.transaction(async (transaction) => {
      const existing = await this.getInvoiceOrThrow(actor.companyId, invoiceId, transaction);
      if (existing.invoiceStatus !== "draft") {
        throw new AppError("Only draft invoices can be deleted", 400);
      }

      const removed = await salesRepository.softDeleteInvoice(actor.companyId, invoiceId, actor.id, transaction);
      if (!removed) {
        throw new AppError("Failed to delete sales invoice", 500);
      }

      return removed;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_invoice_deleted",
      entityType: "sales_invoice",
      entityId: deleted.id,
      metadata: {
        invoiceNumber: deleted.invoiceNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async postInvoice(actor: SalesActor, invoiceId: string, context: SalesRequestContext) {
    const mutation = await db.transaction(async (transaction) => {
      const existing = await this.getInvoiceOrThrow(actor.companyId, invoiceId, transaction);
      if (existing.invoiceStatus !== "draft") {
        throw new AppError("Only draft invoices can be posted", 400);
      }

      const items = await salesRepository.listInvoiceItems(actor.companyId, invoiceId, transaction);
      if (items.length === 0) {
        throw new AppError("Invoice must contain at least one item before posting", 400);
      }

      if (existing.customerId) {
        const customer = await this.getCustomerOrThrow(actor.companyId, existing.customerId, transaction);
        await this.assertCreditLimit(actor.companyId, customer, existing.dueAmount, existing.id);
      }

      const updated = await this.postInvoiceWithinTransaction(actor, existing, items, transaction);
      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_invoice_posted",
      entityType: "sales_invoice",
      entityId: mutation.id,
      metadata: {
        invoiceNumber: mutation.invoiceNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_stock_reduced",
      entityType: "sales_invoice",
      entityId: mutation.id,
      metadata: {
        invoiceNumber: mutation.invoiceNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    if (compareDecimals(mutation.dueAmount, "0.00", 2) > 0 && mutation.customerId) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "sales_receivable_created",
        entityType: "sales_invoice",
        entityId: mutation.id,
        metadata: {
          dueAmount: normalizeMoney(mutation.dueAmount)
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    return {
      invoice: await this.loadInvoicePayload(actor.companyId, mutation.id)
    };
  }

  public async cancelInvoice(actor: SalesActor, invoiceId: string, context: SalesRequestContext) {
    const mutation = await db.transaction(async (transaction) => {
      const existing = await this.getInvoiceOrThrow(actor.companyId, invoiceId, transaction);
      if (existing.invoiceStatus !== "posted") {
        throw new AppError("Only posted invoices can be cancelled", 400);
      }

      const paymentTotals = await salesRepository.getPaymentTotals(actor.companyId, invoiceId, transaction);
      const returnTotals = await salesRepository.getReturnTotals(actor.companyId, invoiceId, transaction);
      if (paymentTotals.paymentCount > 0) {
        throw new AppError("Invoices with payments cannot be cancelled", 400);
      }

      if (returnTotals.returnCount > 0) {
        throw new AppError("Invoices with returns cannot be cancelled", 400);
      }

      const items = await salesRepository.listInvoiceItems(actor.companyId, invoiceId, transaction);
      await inventoryService.increaseSalesReturnStock(
        actor,
        {
          movementDate: new Date(),
          referenceType: "sales_invoice_cancel",
          referenceId: existing.id,
          referenceNumber: existing.invoiceNumber,
          remarks: existing.notes,
          items: items.map((row) => ({
            productId: row.item.productId,
            warehouseId: row.item.warehouseId,
            batchId: row.item.batchId,
            quantity: row.item.quantity,
            rate: row.item.saleRate
          }))
        },
        transaction
      );

      await salesRepository.createAccountingEvent(
        {
          companyId: actor.companyId,
          eventType: "sales_invoice_cancelled",
          referenceType: "sales_invoice",
          referenceId: existing.id,
          payload: {
            salesInvoiceId: existing.id,
            invoiceNumber: existing.invoiceNumber,
            reverseOf: "sales_invoice_posted"
          },
          status: "pending"
        },
        transaction
      );

      const updated = await salesRepository.updateInvoice(
        actor.companyId,
        existing.id,
        {
          invoiceStatus: "cancelled",
          paymentStatus: "unpaid",
          dueAmount: "0.00",
          cancelledAt: new Date(),
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to cancel sales invoice", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_invoice_cancelled",
      entityType: "sales_invoice",
      entityId: mutation.id,
      metadata: {
        invoiceNumber: mutation.invoiceNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      invoice: await this.loadInvoicePayload(actor.companyId, mutation.id)
    };
  }

  public async listPayments(actor: Pick<SalesActor, "companyId">, invoiceId: string, query: ListSalesPaymentsQuery) {
    await this.getInvoiceOrThrow(actor.companyId, invoiceId);
    const pagination = getPagination(query.page, query.limit);
    const [payments, total] = await Promise.all([
      salesRepository.listPayments(actor.companyId, invoiceId, pagination.page, pagination.limit),
      salesRepository.countPayments(actor.companyId, invoiceId)
    ]);

    return {
      items: payments.map((row) => this.mapPaymentRow(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1
      }
    };
  }

  public async recordPayment(
    actor: SalesActor,
    invoiceId: string,
    input: RecordSalesPaymentInput,
    context: SalesRequestContext
  ) {
    const mutation = await db.transaction(async (transaction) => {
      const existing = await this.getInvoiceOrThrow(actor.companyId, invoiceId, transaction);
      if (!["posted", "partially_returned", "returned"].includes(existing.invoiceStatus)) {
        throw new AppError("Payments can only be recorded for posted invoices", 400);
      }

      if (input.bankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
      }

      if (compareDecimals(input.amount, existing.dueAmount, 2) > 0) {
        throw new AppError("Payment amount cannot exceed current due amount", 400);
      }

      const payment = await salesRepository.createPayment(
        {
          companyId: actor.companyId,
          salesInvoiceId: existing.id,
          customerId: existing.customerId,
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
        throw new AppError("Failed to record sales payment", 500);
      }

      const nextPaidAmount = addDecimals(existing.paidAmount, payment.amount, 2);
      const nextDueAmount = calculateDueAmount(existing.grandTotal, nextPaidAmount);
      const nextPaymentStatus = calculatePaymentStatus({
        grandTotal: existing.grandTotal,
        paidAmount: nextPaidAmount,
        dueDate: existing.dueDate ?? null
      });

      const updatedInvoice = await salesRepository.updateInvoice(
        actor.companyId,
        invoiceId,
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
        throw new AppError("Failed to update invoice after payment", 500);
      }

      await salesRepository.createAccountingEvent(
        {
          companyId: actor.companyId,
          eventType: "sales_payment_received",
          referenceType: "sales_payment",
          referenceId: payment.id,
          payload: {
            salesInvoiceId: existing.id,
            invoiceNumber: existing.invoiceNumber,
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
      action: "sales_payment_received",
      entityType: "sales_payment",
      entityId: mutation.payment.id,
      metadata: {
        salesInvoiceId: invoiceId,
        amount: normalizeMoney(mutation.payment.amount)
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

  public async listReturns(actor: Pick<SalesActor, "companyId">, query: ListSalesReturnsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await salesRepository.listReturns({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      customerId: query.customerId,
      salesInvoiceId: query.salesInvoiceId,
      warehouseId: query.warehouseId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });

    return {
      items: result.rows.map((row) => this.mapReturnRow(row)),
      summary: {
        grandTotal: normalizeMoney(result.summary.grandTotal)
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async getReturn(actor: Pick<SalesActor, "companyId">, returnId: string) {
    const detail = await salesRepository.findReturnDetail(actor.companyId, returnId);
    if (!detail) {
      throw new AppError("Sales return not found", 404);
    }

    const items = await salesRepository.listReturnItems(actor.companyId, returnId);
    return {
      salesReturn: {
        ...this.mapReturnRow(detail),
        items: items.map((row) => ({
          id: row.item.id,
          salesInvoiceItemId: row.item.salesInvoiceItemId,
          productId: row.item.productId,
          productName: row.product.name,
          productCode: row.product.productCode,
          quantity: normalizeQuantity(row.item.quantity),
          returnRate: normalizeMoney(row.item.returnRate),
          taxableAmount: normalizeMoney(row.item.taxableAmount),
          gstRate: normalizeMoney(row.item.gstRate),
          gstAmount: normalizeMoney(row.item.gstAmount),
          lineTotal: normalizeMoney(row.item.lineTotal)
        }))
      }
    };
  }

  public async createReturn(actor: SalesActor, input: CreateSalesReturnInput, context: SalesRequestContext) {
    const mutation = await db.transaction(async (transaction) => {
      const invoice = await this.getInvoiceOrThrow(actor.companyId, input.salesInvoiceId, transaction);
      if (!["posted", "partially_returned"].includes(invoice.invoiceStatus)) {
        throw new AppError("Sales return can only be created for posted invoices", 400);
      }

      const invoiceItems = await salesRepository.listInvoiceItems(actor.companyId, invoice.id, transaction);
      const itemsMap = new Map(invoiceItems.map((row) => [row.item.id, row]));

      const returnLines: Array<{
        source: InvoiceItemRow;
        quantity: string;
        returnRate: string;
        taxableAmount: string;
        gstRate: string;
        gstAmount: string;
        lineTotal: string;
      }> = [];

      for (const item of input.items) {
        const source = itemsMap.get(item.salesInvoiceItemId);
        if (!source) {
          throw new AppError("Return item does not belong to the selected invoice", 400);
        }

        const requestedQty = normalizeQuantity(item.quantity);
        const remainingQty = subtractDecimals(source.item.quantity, source.item.returnedQuantity, 3);
        if (compareDecimals(requestedQty, remainingQty, 3) > 0) {
          throw new AppError(`Return quantity exceeds remaining quantity for ${source.item.productNameSnapshot}`, 400);
        }

        const taxableAmount = this.prorateMoney(source.item.taxableAmount, source.item.quantity, requestedQty);
        const gstAmount = this.prorateMoney(
          addDecimals(addDecimals(source.item.cgstAmount, source.item.sgstAmount, 2), source.item.igstAmount, 2),
          source.item.quantity,
          requestedQty
        );
        const lineTotal = this.prorateMoney(source.item.lineTotal, source.item.quantity, requestedQty);
        const returnRate =
          compareDecimals(source.item.quantity, "0.000", 3) > 0
            ? divideMoneyByQuantity(source.item.taxableAmount, source.item.quantity)
            : normalizeMoney(source.item.saleRate);

        returnLines.push({
          source,
          quantity: requestedQty,
          returnRate,
          taxableAmount,
          gstRate: normalizeMoney(source.item.gstRate),
          gstAmount,
          lineTotal
        });
      }

      await this.getWarehouseOrThrow(actor.companyId, input.warehouseId ?? invoice.warehouseId);
      const settings = await this.getInvoiceSettings(actor.companyId);
      const totals = calculateReturnTotals({
        items: returnLines.map((line) => ({
          taxableAmount: line.taxableAmount,
          gstAmount: line.gstAmount,
          lineTotal: line.lineTotal
        })),
        roundOffEnabled: settings?.roundOffEnabled ?? true
      });

      const returnNumber = await this.getNextReturnNumber(actor.companyId, transaction);
      const salesReturn = await salesRepository.createReturn(
        {
          companyId: actor.companyId,
          returnNumber,
          salesInvoiceId: invoice.id,
          customerId: invoice.customerId,
          returnDate: input.returnDate,
          warehouseId: input.warehouseId ?? invoice.warehouseId,
          subtotal: totals.subtotal,
          gstTotal: totals.gstTotal,
          roundOffAmount: totals.roundOffAmount,
          grandTotal: totals.grandTotal,
          reason: input.reason,
          notes: input.notes ?? null,
          accountingEventCreated: true,
          createdBy: actor.id
        },
        transaction
      );

      if (!salesReturn) {
        throw new AppError("Failed to create sales return", 500);
      }

      await salesRepository.createReturnItems(
        returnLines.map((line) => ({
          companyId: actor.companyId,
          salesReturnId: salesReturn.id,
          salesInvoiceItemId: line.source.item.id,
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

      for (const line of returnLines) {
        await salesRepository.updateInvoiceItemReturnedQuantity(
          actor.companyId,
          line.source.item.id,
          addDecimals(line.source.item.returnedQuantity, line.quantity, 3),
          transaction
        );
      }

      await inventoryService.increaseSalesReturnStock(
        actor,
        {
          movementDate: new Date(input.returnDate),
          referenceType: "sales_return",
          referenceId: salesReturn.id,
          referenceNumber: returnNumber,
          remarks: input.notes,
          items: returnLines.map((line) => ({
            productId: line.source.item.productId,
            warehouseId: line.source.item.warehouseId,
            batchId: line.source.item.batchId,
            quantity: line.quantity,
            rate: line.returnRate
          }))
        },
        transaction
      );

      await salesRepository.createAccountingEvent(
        {
          companyId: actor.companyId,
          eventType: "sales_return_created",
          referenceType: "sales_return",
          referenceId: salesReturn.id,
          payload: this.buildSalesReturnAccountingPayload(salesReturn),
          status: "pending"
        },
        transaction
      );

      const totalReturned = addDecimals(
        (await salesRepository.getReturnTotals(actor.companyId, invoice.id, transaction)).grandTotal,
        "0.00",
        2
      );
      const effectiveGrandTotal = subtractDecimals(invoice.grandTotal, totalReturned, 2);
      const nextDueAmount = calculateDueAmount(effectiveGrandTotal, invoice.paidAmount);
      const nextPaymentStatus = calculatePaymentStatus({
        grandTotal: effectiveGrandTotal,
        paidAmount: invoice.paidAmount,
        dueDate: invoice.dueDate ?? null
      });
      const nextStatus = await this.determineReturnStatus(actor.companyId, invoice.id, transaction);

      const updatedInvoice = await salesRepository.updateInvoice(
        actor.companyId,
        invoice.id,
        {
          invoiceStatus: nextStatus,
          dueAmount: nextDueAmount,
          paymentStatus: nextPaymentStatus,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updatedInvoice) {
        throw new AppError("Failed to update invoice after sales return", 500);
      }

      return salesReturn;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_return_created",
      entityType: "sales_return",
      entityId: mutation.id,
      metadata: {
        returnNumber: mutation.returnNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getReturn(actor, mutation.id);
  }

  public async barcodeLookup(actor: Pick<SalesActor, "companyId">, query: BarcodeLookupQuery) {
    const rows = await salesRepository.barcodeLookup(actor.companyId, query.q, query.warehouseId);
    return {
      items: rows.map((row) => ({
        id: row.product.id,
        productCode: row.product.productCode,
        name: row.product.name,
        sku: row.product.sku,
        barcode: row.product.barcode,
        productType: row.product.productType,
        salePrice: normalizeMoney(row.product.salePrice),
        mrp: normalizeMoney(row.product.mrp),
        minimumSalePrice: normalizeMoney(row.product.minimumSalePrice),
        priceTaxType: row.product.priceTaxType,
        gstRate: normalizeMoney(row.product.gstRate),
        cessRate: normalizeMoney(row.product.cessRate),
        stockTrackingEnabled: row.product.stockTrackingEnabled,
        totalStock: normalizeQuantity(row.totalStock)
      }))
    };
  }

  public async exportInvoices(
    actor: SalesActor,
    query: ExportSalesInvoicesQuery,
    context: SalesRequestContext
  ): Promise<SalesExportPayload> {
    this.ensureCsvFormat(query.format);
    const rows = await salesRepository.listInvoicesForExport({
      companyId: actor.companyId,
      search: query.search ?? null,
      invoiceStatus: query.invoiceStatus,
      paymentStatus: query.paymentStatus,
      customerId: query.customerId,
      warehouseId: query.warehouseId,
      invoiceType: query.invoiceType,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });

    const content = buildCsvBuffer(
      ["Invoice No", "Type", "Customer", "Invoice Date", "Status", "Payment Status", "Grand Total", "Paid", "Due"],
      rows.map((row) => [
        row.invoice.invoiceNumber,
        row.invoice.invoiceType,
        row.invoice.customerNameSnapshot,
        row.invoice.invoiceDate.toISOString(),
        row.invoice.invoiceStatus,
        row.invoice.paymentStatus,
        normalizeMoney(row.invoice.grandTotal),
        normalizeMoney(row.invoice.paidAmount),
        normalizeMoney(row.invoice.dueAmount)
      ])
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_exported",
      entityType: "sales_invoice",
      metadata: {
        format: query.format,
        rowCount: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      fileName: `sales-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async exportReturns(
    actor: SalesActor,
    query: ExportSalesReturnsQuery,
    context: SalesRequestContext
  ): Promise<SalesExportPayload> {
    this.ensureCsvFormat(query.format);
    const rows = await salesRepository.listReturnsForExport({
      companyId: actor.companyId,
      search: query.search ?? null,
      customerId: query.customerId,
      salesInvoiceId: query.salesInvoiceId,
      warehouseId: query.warehouseId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });

    const content = buildCsvBuffer(
      ["Return No", "Invoice No", "Return Date", "Reason", "Grand Total"],
      rows.map((row) => [
        row.salesReturn.returnNumber,
        row.invoiceNumber,
        row.salesReturn.returnDate.toISOString(),
        row.salesReturn.reason,
        normalizeMoney(row.salesReturn.grandTotal)
      ])
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_exported",
      entityType: "sales_return",
      metadata: {
        format: query.format,
        rowCount: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      fileName: `sales-returns-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async generateInvoicePdf(actor: SalesActor, invoiceId: string, context: SalesRequestContext) {
    const invoice = await this.loadInvoicePayload(actor.companyId, invoiceId);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_invoice_pdf_generated",
      entityType: "sales_invoice",
      entityId: invoiceId,
      metadata: {
        fallback: "structured-data"
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      pdfAvailable: false,
      invoice
    };
  }

  public async sendInvoiceEmail(
    actor: SalesActor,
    invoiceId: string,
    input: SendInvoiceEmailInput,
    context: SalesRequestContext
  ) {
    const detail = await salesRepository.findInvoiceDetail(actor.companyId, invoiceId);
    if (!detail) {
      throw new AppError("Sales invoice not found", 404);
    }

    const targetEmail = input.email ?? detail.customer?.email ?? null;
    if (!targetEmail) {
      throw new AppError("No customer email available for this invoice", 400);
    }

    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
      await emailService.sendGenericEmail({
        to: targetEmail,
        subject: input.subject ?? `Invoice ${detail.invoice.invoiceNumber}`,
        html: `<p>Hello,</p><p>Please find invoice <strong>${detail.invoice.invoiceNumber}</strong> for amount <strong>${normalizeMoney(detail.invoice.grandTotal)}</strong>.</p><p>${input.message ?? ""}</p>`,
        text: `Invoice ${detail.invoice.invoiceNumber} amount ${normalizeMoney(detail.invoice.grandTotal)}. ${input.message ?? ""}`
      });
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : "Email send failed";
    }

    const log = await salesRepository.createSendLog({
      companyId: actor.companyId,
      salesInvoiceId: invoiceId,
      channel: "email",
      sentTo: targetEmail,
      status,
      errorMessage,
      sentAt: status === "sent" ? new Date() : null,
      createdBy: actor.id
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_invoice_email_sent",
      entityType: "sales_invoice",
      entityId: invoiceId,
      metadata: {
        status,
        sentTo: targetEmail
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      sendLog: log
        ? {
            id: log.id,
            channel: log.channel,
            status: log.status,
            sentTo: log.sentTo,
            errorMessage: log.errorMessage,
            sentAt: log.sentAt
          }
        : null
    };
  }

  public async sendInvoiceWhatsapp(
    actor: SalesActor,
    invoiceId: string,
    input: SendInvoiceWhatsappInput,
    context: SalesRequestContext
  ) {
    const detail = await salesRepository.findInvoiceDetail(actor.companyId, invoiceId);
    if (!detail) {
      throw new AppError("Sales invoice not found", 404);
    }

    const mobile = input.mobile ?? detail.invoice.walkInMobile ?? detail.customer?.mobile ?? null;
    if (!mobile) {
      throw new AppError("No mobile number available for this invoice", 400);
    }

    const log = await salesRepository.createSendLog({
      companyId: actor.companyId,
      salesInvoiceId: invoiceId,
      channel: "whatsapp",
      sentTo: mobile,
      status: "pending",
      errorMessage: "WhatsApp provider not configured",
      createdBy: actor.id
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "sales_invoice_whatsapp_attempted",
      entityType: "sales_invoice",
      entityId: invoiceId,
      metadata: {
        status: "pending",
        sentTo: mobile
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      sendLog: log
        ? {
            id: log.id,
            channel: log.channel,
            status: log.status,
            sentTo: log.sentTo,
            errorMessage: log.errorMessage
          }
        : null
    };
  }
}

export const salesService = new SalesService();
