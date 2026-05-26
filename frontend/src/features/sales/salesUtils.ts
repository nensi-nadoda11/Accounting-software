import type { AxiosError } from "axios";

import type { CompanyInvoiceSettings, CompanyProfile } from "../../types/company";
import type { Customer } from "../../types/customer";
import type { Product } from "../../types/product";
import type {
  PaymentStatus,
  SalesBarcodeLookupItem,
  SalesFormInput,
  SalesInvoice,
  SalesInvoiceItem,
  SalesInvoiceItemInput,
  SalesPaymentInput,
  SalesPaymentMode,
  SalesPriceTaxType,
  SalesReturnInput,
  SalesReturnRefundInput,
} from "../../types/sales";

type ApiErrorShape = {
  message?: string;
  errors?: string[];
};

type CalculationItemInput = {
  quantity: string | number;
  saleRate: string | number;
  priceTaxType: SalesPriceTaxType;
  discountPercent?: string | number | null | undefined;
  discountAmount?: string | number | null | undefined;
  gstRate?: string | number | null | undefined;
  cessRate?: string | number | null | undefined;
  isInterState: boolean;
};

export type SalesPreviewLine = {
  subtotal: string;
  discountPercentAmount: string;
  discountAmount: string;
  itemDiscountTotal: string;
  invoiceDiscountShare: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  cessAmount: string;
  gstAmount: string;
  lineTotal: string;
};

export type SalesPreviewTotals = {
  lines: SalesPreviewLine[];
  subtotal: string;
  itemDiscountTotal: string;
  invoiceDiscountTotal: string;
  deliveryCharges: string;
  packingCharges: string;
  otherCharges: string;
  taxableAmount: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  cessTotal: string;
  gstTotal: string;
  roundOffAmount: string;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  paymentStatus: PaymentStatus;
};

export type ReturnPreviewItem = {
  salesInvoiceItemId: string;
  quantity: number;
};

export type ReturnPreviewTotals = {
  subtotal: string;
  gstTotal: string;
  grandTotal: string;
};

export type SalesItemMeta = {
  productType?: "goods" | "service";
  decimalAllowed?: boolean;
  batchTrackingEnabled?: boolean;
  expiryTrackingEnabled?: boolean;
  minimumSalePrice?: number;
  availableQuantity?: number;
  batchStatus?: string | null;
  batchExpiryDate?: string | null;
  productCode?: string | null;
  sku?: string | null;
  unitSymbol?: string | null;
  gstRate?: number;
  cessRate?: number;
};

const HUNDRED = 100n;
const THOUSAND = 1000n;
const TEN_THOUSAND = 10000n;

const trimToNull = (value: string | null | undefined) => {
  const next = value?.trim();
  return next ? next : null;
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

const toScaledBigInt = (value: string | number | null | undefined, scale: number) => {
  const numeric = typeof value === "number" ? value.toString() : `${value ?? 0}`;
  const sanitized = numeric.trim();
  if (!sanitized) {
    return 0n;
  }

  const negative = sanitized.startsWith("-");
  const unsigned = negative ? sanitized.slice(1) : sanitized;
  const [wholePart, decimalPart = ""] = unsigned.split(".");
  const padded = `${decimalPart}${"0".repeat(scale)}`.slice(0, scale);
  const whole = wholePart.replace(/\D/g, "") || "0";
  const decimal = padded.replace(/\D/g, "") || "0";
  const result = BigInt(whole) * 10n ** BigInt(scale) + BigInt(decimal);
  return negative ? result * -1n : result;
};

const scaledBigIntToDecimal = (value: bigint, scale: number) => {
  const negative = value < 0n;
  const absolute = negative ? value * -1n : value;
  const divisor = 10n ** BigInt(scale);
  const whole = absolute / divisor;
  const decimal = (absolute % divisor).toString().padStart(scale, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${decimal}`;
};

const moneyToBigInt = (value: string | number | null | undefined) => toScaledBigInt(value, 2);
const quantityToBigInt = (value: string | number | null | undefined) => toScaledBigInt(value, 3);
const percentToBigInt = (value: string | number | null | undefined) => toScaledBigInt(value, 2);
const bigIntToMoney = (value: bigint) => scaledBigIntToDecimal(value, 2);

const clampAtZero = (value: bigint) => (value < 0n ? 0n : value);

const addScaled = (left: string | number, right: string | number, scale: number) =>
  scaledBigIntToDecimal(toScaledBigInt(left, scale) + toScaledBigInt(right, scale), scale);

const subtractScaled = (left: string | number, right: string | number, scale: number) =>
  scaledBigIntToDecimal(toScaledBigInt(left, scale) - toScaledBigInt(right, scale), scale);

const compareScaled = (left: string | number, right: string | number, scale: number) => {
  const leftValue = toScaledBigInt(left, scale);
  const rightValue = toScaledBigInt(right, scale);
  if (leftValue === rightValue) {
    return 0;
  }

  return leftValue > rightValue ? 1 : -1;
};

const multiplyQuantityByRate = (quantity: string | number, rate: string | number) =>
  roundHalfUp(quantityToBigInt(quantity) * moneyToBigInt(rate), THOUSAND);

const calculatePercentAmount = (baseMoney: bigint, percent: string | number | null | undefined) =>
  roundHalfUp(baseMoney * percentToBigInt(percent), TEN_THOUSAND);

const calculateTaxAmount = (taxableMoney: bigint, rate: string | number | null | undefined) =>
  roundHalfUp(taxableMoney * percentToBigInt(rate), TEN_THOUSAND);

const allocateInvoiceDiscount = (taxableAmounts: string[], invoiceDiscountTotal: string) => {
  const totalTaxable = moneyToBigInt(taxableAmounts.reduce((sum, amount) => addScaled(sum, amount, 2), "0.00"));
  const discountTotal = moneyToBigInt(invoiceDiscountTotal);

  if (discountTotal <= 0n || totalTaxable <= 0n) {
    return taxableAmounts.map(() => "0.00");
  }

  let allocated = 0n;
  return taxableAmounts.map((taxableAmount, index) => {
    if (index === taxableAmounts.length - 1) {
      return bigIntToMoney(discountTotal - allocated);
    }

    const share = roundHalfUp(discountTotal * moneyToBigInt(taxableAmount), totalTaxable);
    allocated += share;
    return bigIntToMoney(share);
  });
};

const calculateLineValues = (input: CalculationItemInput) => {
  const subtotalMoney = multiplyQuantityByRate(input.quantity, input.saleRate);
  const discountPercentAmount = calculatePercentAmount(subtotalMoney, input.discountPercent ?? 0);
  const fixedDiscountAmount = moneyToBigInt(input.discountAmount ?? 0);
  const itemDiscountTotal = clampAtZero(discountPercentAmount + fixedDiscountAmount);
  const discountedTotal = clampAtZero(subtotalMoney - itemDiscountTotal);
  const gstRateScaled = percentToBigInt(input.gstRate ?? 0);
  const cessRateScaled = percentToBigInt(input.cessRate ?? 0);

  let taxableMoney = discountedTotal;
  let gstAmountMoney = 0n;
  let cessAmountMoney = 0n;

  if (input.priceTaxType === "inclusive") {
    const combinedRate = gstRateScaled + cessRateScaled;
    if (combinedRate > 0n && discountedTotal > 0n) {
      taxableMoney = roundHalfUp(discountedTotal * TEN_THOUSAND, TEN_THOUSAND + combinedRate);
      gstAmountMoney = calculateTaxAmount(taxableMoney, input.gstRate ?? 0);
      cessAmountMoney = calculateTaxAmount(taxableMoney, input.cessRate ?? 0);
    }
  } else {
    gstAmountMoney = calculateTaxAmount(taxableMoney, input.gstRate ?? 0);
    cessAmountMoney = calculateTaxAmount(taxableMoney, input.cessRate ?? 0);
  }

  const split = calculateGSTSplit(bigIntToMoney(gstAmountMoney), input.isInterState);

  return {
    subtotal: bigIntToMoney(subtotalMoney),
    discountPercentAmount: bigIntToMoney(discountPercentAmount),
    discountAmount: bigIntToMoney(fixedDiscountAmount),
    itemDiscountTotal: bigIntToMoney(itemDiscountTotal),
    taxableAmount: bigIntToMoney(taxableMoney),
    cgstAmount: split.cgstAmount,
    sgstAmount: split.sgstAmount,
    igstAmount: split.igstAmount,
    cessAmount: bigIntToMoney(cessAmountMoney),
    gstAmount: bigIntToMoney(gstAmountMoney),
  };
};

export const formatMoney = (value: string | number | null | undefined) => {
  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(Number(value ?? 0));
};

export const formatQty = (value: string | number | null | undefined, digits = 3) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(Number(value ?? 0));

export const normalizeMoney = (value: string | number | null | undefined) => scaledBigIntToDecimal(moneyToBigInt(value), 2);
export const normalizeQuantity = (value: string | number | null | undefined) => scaledBigIntToDecimal(quantityToBigInt(value), 3);

export const calculateGSTSplit = (gstAmount: string | number | null | undefined, isInterState: boolean) => {
  const gstMoney = moneyToBigInt(gstAmount);
  if (isInterState) {
    return {
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: bigIntToMoney(gstMoney),
    };
  }

  const cgst = roundHalfUp(gstMoney, 2n);
  return {
    cgstAmount: bigIntToMoney(cgst),
    sgstAmount: bigIntToMoney(gstMoney - cgst),
    igstAmount: "0.00",
  };
};

export const calculateRoundOff = (grandTotalBeforeRoundOff: string | number | null | undefined) => {
  const grandTotalMoney = moneyToBigInt(grandTotalBeforeRoundOff);
  const roundedWhole = roundHalfUp(grandTotalMoney, HUNDRED) * HUNDRED;
  return bigIntToMoney(roundedWhole - grandTotalMoney);
};

export const calculateDueAmount = (grandTotal: string | number, paidAmount: string | number) => {
  const due = subtractScaled(normalizeMoney(grandTotal), normalizeMoney(paidAmount), 2);
  return compareScaled(due, "0.00", 2) < 0 ? "0.00" : due;
};

export const calculatePaymentStatus = (input: {
  grandTotal: string | number;
  paidAmount: string | number;
  dueDate?: string | null;
  asOf?: Date;
}) => {
  const paidAmount = normalizeMoney(input.paidAmount);
  const dueAmount = calculateDueAmount(input.grandTotal, paidAmount);

  if (compareScaled(dueAmount, "0.00", 2) <= 0) {
    return "paid" as const;
  }

  if (compareScaled(paidAmount, "0.00", 2) > 0) {
    return "partial" as const;
  }

  if (input.dueDate) {
    const asOfDate = input.asOf ?? new Date();
    if (new Date(input.dueDate).getTime() < asOfDate.getTime()) {
      return "overdue" as const;
    }
  }

  return "unpaid" as const;
};

export const calculateSalesPreview = (input: {
  items: CalculationItemInput[];
  invoiceDiscountTotal?: string | number | null;
  deliveryCharges?: string | number | null;
  packingCharges?: string | number | null;
  otherCharges?: string | number | null;
  paidAmount?: string | number | null;
  dueDate?: string | null;
  roundOffEnabled?: boolean;
}): SalesPreviewTotals => {
  const rawLines = input.items.map((item) => calculateLineValues(item));
  const invoiceDiscountTotal = normalizeMoney(input.invoiceDiscountTotal ?? 0);
  const allocatedDiscounts = allocateInvoiceDiscount(
    rawLines.map((line) => line.taxableAmount),
    invoiceDiscountTotal,
  );

  let subtotal = "0.00";
  let itemDiscountTotal = "0.00";
  let taxableAmount = "0.00";
  let cgstTotal = "0.00";
  let sgstTotal = "0.00";
  let igstTotal = "0.00";
  let cessTotal = "0.00";
  let gstTotal = "0.00";
  let lineGrandTotal = "0.00";

  const lines = rawLines.map((line, index): SalesPreviewLine => {
    const invoiceDiscountShare = allocatedDiscounts[index];
    const netTaxable = subtractScaled(line.taxableAmount, invoiceDiscountShare, 2);
    const gstAmount = calculateTaxAmount(moneyToBigInt(netTaxable), input.items[index]?.gstRate ?? 0);
    const cessAmount = calculateTaxAmount(moneyToBigInt(netTaxable), input.items[index]?.cessRate ?? 0);
    const split = calculateGSTSplit(bigIntToMoney(gstAmount), input.items[index]?.isInterState ?? false);
    const lineTotal = addScaled(addScaled(netTaxable, bigIntToMoney(gstAmount), 2), bigIntToMoney(cessAmount), 2);

    subtotal = addScaled(subtotal, line.subtotal, 2);
    itemDiscountTotal = addScaled(itemDiscountTotal, line.itemDiscountTotal, 2);
    taxableAmount = addScaled(taxableAmount, netTaxable, 2);
    cgstTotal = addScaled(cgstTotal, split.cgstAmount, 2);
    sgstTotal = addScaled(sgstTotal, split.sgstAmount, 2);
    igstTotal = addScaled(igstTotal, split.igstAmount, 2);
    cessTotal = addScaled(cessTotal, bigIntToMoney(cessAmount), 2);
    gstTotal = addScaled(gstTotal, bigIntToMoney(gstAmount), 2);
    lineGrandTotal = addScaled(lineGrandTotal, lineTotal, 2);

    return {
      ...line,
      invoiceDiscountShare,
      taxableAmount: netTaxable,
      cgstAmount: split.cgstAmount,
      sgstAmount: split.sgstAmount,
      igstAmount: split.igstAmount,
      cessAmount: bigIntToMoney(cessAmount),
      gstAmount: bigIntToMoney(gstAmount),
      lineTotal,
    };
  });

  const deliveryCharges = normalizeMoney(input.deliveryCharges ?? 0);
  const packingCharges = normalizeMoney(input.packingCharges ?? 0);
  const otherCharges = normalizeMoney(input.otherCharges ?? 0);
  const beforeRoundOff = addScaled(addScaled(addScaled(lineGrandTotal, deliveryCharges, 2), packingCharges, 2), otherCharges, 2);
  const roundOffAmount = input.roundOffEnabled === false ? "0.00" : calculateRoundOff(beforeRoundOff);
  const grandTotal = addScaled(beforeRoundOff, roundOffAmount, 2);
  const paidAmount = normalizeMoney(input.paidAmount ?? 0);

  return {
    lines,
    subtotal,
    itemDiscountTotal,
    invoiceDiscountTotal,
    deliveryCharges,
    packingCharges,
    otherCharges,
    taxableAmount,
    cgstTotal,
    sgstTotal,
    igstTotal,
    cessTotal,
    gstTotal,
    roundOffAmount,
    grandTotal,
    paidAmount,
    dueAmount: calculateDueAmount(grandTotal, paidAmount),
    paymentStatus: calculatePaymentStatus({
      grandTotal,
      paidAmount,
      dueDate: input.dueDate,
    }),
  };
};

export const prorateMoney = (totalAmount: string | number, totalQuantity: string | number, partialQuantity: string | number) => {
  const totalAmountScaled = moneyToBigInt(totalAmount);
  const totalQuantityScaled = quantityToBigInt(totalQuantity);
  const partialQuantityScaled = quantityToBigInt(partialQuantity);

  if (totalQuantityScaled <= 0n || partialQuantityScaled <= 0n) {
    return "0.00";
  }

  return bigIntToMoney(roundHalfUp(totalAmountScaled * partialQuantityScaled, totalQuantityScaled));
};

export const calculateReturnPreview = (invoice: SalesInvoice, items: ReturnPreviewItem[]): ReturnPreviewTotals => {
  const invoiceItems = invoice.items ?? [];
  let subtotal = "0.00";
  let gstTotal = "0.00";
  let grandTotal = "0.00";

  items.forEach((returnItem) => {
    const source = invoiceItems.find((item) => item.id === returnItem.salesInvoiceItemId);
    if (!source || returnItem.quantity <= 0) {
      return;
    }

    subtotal = addScaled(subtotal, prorateMoney(source.taxableAmount, source.quantity, returnItem.quantity), 2);
    const originalGst = addScaled(addScaled(source.cgstAmount, source.sgstAmount, 2), source.igstAmount, 2);
    gstTotal = addScaled(gstTotal, prorateMoney(originalGst, source.quantity, returnItem.quantity), 2);
    grandTotal = addScaled(grandTotal, prorateMoney(source.lineTotal, source.quantity, returnItem.quantity), 2);
  });

  return { subtotal, gstTotal, grandTotal };
};

export const calculateSalesReturnAdjustment = (
  invoice: Pick<SalesInvoice, "dueAmount">,
  returnGrandTotal: string | number,
) => {
  const normalizedDueAmount = normalizeMoney(invoice.dueAmount);
  const normalizedReturnTotal = normalizeMoney(returnGrandTotal);

  return compareScaled(normalizedReturnTotal, normalizedDueAmount, 2) <= 0
    ? normalizedReturnTotal
    : normalizedDueAmount;
};

export const calculateAvailableSalesReturnRefund = (
  invoice: Pick<SalesInvoice, "dueAmount">,
  returnGrandTotal: string | number,
) =>
  (() => {
    const normalizedReturnTotal = normalizeMoney(returnGrandTotal);
    const adjustedAmount = calculateSalesReturnAdjustment(invoice, normalizedReturnTotal);
    const refundableAmount = subtractScaled(normalizedReturnTotal, adjustedAmount, 2);
    return compareScaled(refundableAmount, "0.00", 2) < 0 ? "0.00" : refundableAmount;
  })();

export const getRemainingReturnableQty = (invoiceItem: SalesInvoiceItem) => {
  const remaining = subtractScaled(invoiceItem.quantity, invoiceItem.returnedQuantity, 3);
  return compareScaled(remaining, "0.000", 3) < 0 ? "0.000" : remaining;
};

export const isBankPaymentMode = (paymentMode: SalesPaymentMode | null | undefined) =>
  paymentMode === "bank" || paymentMode === "upi" || paymentMode === "card" || paymentMode === "cheque";

export const toDateInputValue = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

export const buildSalesItemDefaults = (warehouseId: string | null, type: "gst_invoice" | "pos" = "gst_invoice"): SalesInvoiceItemInput => ({
  productId: "",
  warehouseId,
  batchId: null,
  quantity: 1,
  saleRate: 0,
  mrp: 0,
  priceTaxType: type === "pos" ? "inclusive" : "exclusive",
  discountPercent: 0,
  discountAmount: 0,
  gstRate: 0,
  cessRate: 0,
  remarks: null,
});

export const buildSalesFormDefaults = (
  invoice?: SalesInvoice | null,
  invoiceSettings?: CompanyInvoiceSettings | null,
  invoiceType: "gst_invoice" | "pos" = "gst_invoice",
): SalesFormInput => ({
  invoiceType: invoice?.invoiceType ?? invoiceType,
  invoiceStatus: "draft",
  invoiceDate: toDateInputValue(invoice?.invoiceDate) || new Date().toISOString().slice(0, 10),
  dueDate: toDateInputValue(invoice?.dueDate),
  customerId: invoice?.customer?.id ?? null,
  isWalkIn: invoice?.isWalkIn ?? invoiceType === "pos",
  walkInName: invoice?.walkInName ?? (invoiceType === "pos" ? "Walk-in Customer" : null),
  walkInMobile: invoice?.walkInMobile ?? null,
  placeOfSupply: invoice?.placeOfSupply ?? null,
  warehouseId: invoice?.warehouse?.id ?? "",
  priceTaxType: invoice?.priceTaxType ?? (invoiceType === "pos" ? "inclusive" : "exclusive"),
  items:
    invoice?.items?.map((item) => ({
      productId: item.productId,
      warehouseId: item.warehouse?.id ?? invoice?.warehouse?.id ?? null,
      batchId: item.batch?.id ?? null,
      quantity: Number(item.quantity),
      saleRate: Number(item.saleRate),
      mrp: Number(item.mrp),
      priceTaxType: item.priceTaxType,
      discountPercent: Number(item.discountPercent),
      discountAmount: Number(item.discountAmount),
      gstRate: Number(item.gstRate),
      cessRate: Number(item.cessRate),
      remarks: item.remarks ?? null,
    })) ?? [buildSalesItemDefaults(invoice?.warehouse?.id ?? null, invoiceType)],
  invoiceDiscountTotal: Number(invoice?.invoiceDiscountTotal ?? 0),
  deliveryCharges: Number(invoice?.deliveryCharges ?? 0),
  packingCharges: Number(invoice?.packingCharges ?? 0),
  otherCharges: Number(invoice?.otherCharges ?? 0),
  paidAmount: Number(invoice?.paidAmount ?? 0),
  paymentMode: invoice?.paymentMode ?? null,
  paymentReference: invoice?.paymentReference ?? null,
  bankAccountId: invoice?.bankAccountId ?? null,
  notes: invoice?.notes ?? null,
  termsConditions: invoice?.termsConditions ?? invoiceSettings?.termsAndConditions ?? null,
});

export const createSalesPayload = (values: SalesFormInput): SalesFormInput => ({
  ...values,
  customerId: values.isWalkIn ? null : values.customerId,
  walkInName: values.isWalkIn ? trimToNull(values.walkInName) : null,
  walkInMobile: values.isWalkIn ? trimToNull(values.walkInMobile) : null,
  dueDate: trimToNull(values.dueDate),
  placeOfSupply: trimToNull(values.placeOfSupply),
  paymentReference: trimToNull(values.paymentReference),
  notes: trimToNull(values.notes),
  termsConditions: trimToNull(values.termsConditions),
  items: values.items.map((item) => ({
    ...item,
    remarks: trimToNull(item.remarks),
  })),
});

export const createSalesUpdatePayload = (values: SalesFormInput) => ({
  invoiceDate: values.invoiceDate,
  dueDate: trimToNull(values.dueDate),
  customerId: values.isWalkIn ? null : values.customerId,
  isWalkIn: values.isWalkIn,
  walkInName: values.isWalkIn ? trimToNull(values.walkInName) : null,
  walkInMobile: values.isWalkIn ? trimToNull(values.walkInMobile) : null,
  placeOfSupply: trimToNull(values.placeOfSupply),
  warehouseId: values.warehouseId,
  priceTaxType: values.priceTaxType,
  items: values.items.map((item) => ({
    productId: item.productId,
    warehouseId: item.warehouseId,
    batchId: item.batchId,
    quantity: item.quantity,
    saleRate: item.saleRate,
    mrp: item.mrp,
    priceTaxType: item.priceTaxType,
    discountPercent: item.discountPercent,
    discountAmount: item.discountAmount,
    gstRate: item.gstRate,
    cessRate: item.cessRate,
    remarks: trimToNull(item.remarks),
  })),
  invoiceDiscountTotal: values.invoiceDiscountTotal,
  deliveryCharges: values.deliveryCharges,
  packingCharges: values.packingCharges,
  otherCharges: values.otherCharges,
  paidAmount: values.paidAmount,
  paymentMode: values.paymentMode ?? null,
  paymentReference: trimToNull(values.paymentReference),
  bankAccountId: values.bankAccountId ?? null,
  notes: trimToNull(values.notes),
  termsConditions: trimToNull(values.termsConditions),
});

export const createPaymentPayload = (values: SalesPaymentInput): SalesPaymentInput => ({
  ...values,
  bankAccountId: values.bankAccountId ?? null,
  referenceNumber: trimToNull(values.referenceNumber),
  notes: trimToNull(values.notes),
});

export const createReturnPayload = (values: SalesReturnInput): SalesReturnInput => ({
  ...values,
  warehouseId: values.warehouseId ?? null,
  refundPaymentMode: values.refundAmountPaid > 0 ? values.refundPaymentMode : null,
  refundBankAccountId: values.refundAmountPaid > 0 ? values.refundBankAccountId ?? null : null,
  refundReferenceNumber: trimToNull(values.refundReferenceNumber),
  refundNotes: trimToNull(values.refundNotes),
  reason: values.reason.trim(),
  notes: trimToNull(values.notes),
  items: values.items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      salesInvoiceItemId: item.salesInvoiceItemId,
      quantity: item.quantity,
      remarks: trimToNull(item.remarks),
    })),
});

export const createReturnRefundPayload = (values: SalesReturnRefundInput): SalesReturnRefundInput => ({
  refundDate: values.refundDate,
  amount: values.amount,
  paymentMode: values.paymentMode,
  bankAccountId: values.bankAccountId ?? null,
  referenceNumber: trimToNull(values.referenceNumber),
  notes: trimToNull(values.notes),
});

export const canEditSales = (invoice: Pick<SalesInvoice, "invoiceStatus">) => invoice.invoiceStatus === "draft";
export const canDeleteSales = (invoice: Pick<SalesInvoice, "invoiceStatus">) => invoice.invoiceStatus === "draft";
export const canPostSales = (invoice: Pick<SalesInvoice, "invoiceStatus">) => invoice.invoiceStatus === "draft";
export const canCancelSales = (invoice: Pick<SalesInvoice, "invoiceStatus">) =>
  invoice.invoiceStatus === "posted" || invoice.invoiceStatus === "returned" || invoice.invoiceStatus === "partially_returned";
export const canAddPayment = (invoice: Pick<SalesInvoice, "invoiceStatus" | "dueAmount">) =>
  (invoice.invoiceStatus === "posted" || invoice.invoiceStatus === "returned" || invoice.invoiceStatus === "partially_returned") &&
  compareScaled(invoice.dueAmount, "0.00", 2) > 0;
export const canCreateReturn = (invoice: Pick<SalesInvoice, "invoiceStatus">) =>
  invoice.invoiceStatus === "posted" || invoice.invoiceStatus === "partially_returned";

export const resolveInterState = (
  company: CompanyProfile | null,
  customer: Pick<Customer, "billingState" | "shippingState"> | null,
  placeOfSupply?: string | null,
) => {
  const companyState = company?.state?.trim().toUpperCase();
  const compareState = placeOfSupply?.trim().toUpperCase() ?? customer?.shippingState?.trim().toUpperCase() ?? customer?.billingState?.trim().toUpperCase();
  return Boolean(companyState && compareState && companyState !== compareState);
};

export const hydrateItemFromProduct = (
  product: Product | SalesBarcodeLookupItem,
  warehouseId: string | null,
): SalesInvoiceItemInput & SalesItemMeta => {
  const productType = "companyId" in product ? product.productType : product.productType;
  const priceTaxType = product.priceTaxType;
  const gstRate = Number(product.gstRate ?? 0);
  const cessRate = Number(("cessRate" in product ? product.cessRate : 0) ?? 0);
  const minimumSalePrice = Number(("minimumSalePrice" in product ? product.minimumSalePrice : 0) ?? 0);
  const decimalAllowed = "companyId" in product ? Boolean(product.unit.symbol || product.unit.name || true) : true;

  return {
    productId: product.id,
    warehouseId: productType === "goods" ? warehouseId : null,
    batchId: null,
    quantity: 1,
    saleRate: Number(product.salePrice ?? 0),
    mrp: Number(product.mrp ?? 0),
    priceTaxType,
    discountPercent: "defaultDiscount" in product ? Number(product.defaultDiscount ?? 0) : 0,
    discountAmount: 0,
    gstRate,
    cessRate,
    remarks: null,
    productType,
    decimalAllowed,
    batchTrackingEnabled: "companyId" in product ? product.batchTrackingEnabled : false,
    expiryTrackingEnabled: "companyId" in product ? product.expiryTrackingEnabled : false,
    minimumSalePrice,
  };
};

export const getFriendlySalesFieldErrors = (error: unknown) => {
  if (!(error instanceof Object) || !("isAxiosError" in error)) {
    return [];
  }

  const axiosError = error as AxiosError<ApiErrorShape>;
  const entries = axiosError.response?.data?.errors ?? [];
  return entries
    .map((entry) => {
      const separator = entry.indexOf(":");
      if (separator < 0) {
        return null;
      }

      return {
        field: entry.slice(0, separator).trim().replace(/^body\./, ""),
        message: entry.slice(separator + 1).trim(),
      };
    })
    .filter((value): value is { field: string; message: string } => Boolean(value?.field && value?.message));
};
