import type { AxiosError } from "axios";

import type { CompanyInvoiceSettings, CompanyProfile } from "../../types/company";
import type { Product, ProductLookupItem } from "../../types/product";
import type { Supplier } from "../../types/supplier";
import type {
  PaymentStatus,
  PurchaseFormInput,
  PurchaseFormItemInput,
  PurchaseInvoice,
  PurchaseInvoiceItem,
  PurchasePaymentInput,
  PurchasePaymentMode,
  PurchasePriceTaxType,
  PurchaseReturnInput,
} from "../../types/purchase";

type ApiErrorShape = {
  message?: string;
  errors?: string[];
};

type CalculationItemInput = {
  quantity: string | number;
  purchaseRate: string | number;
  priceTaxType: PurchasePriceTaxType;
  discountPercent?: string | number | null | undefined;
  discountAmount?: string | number | null | undefined;
  gstRate?: string | number | null | undefined;
  cessRate?: string | number | null | undefined;
  isInterState: boolean;
};

export type PurchasePreviewLine = {
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

export type PurchasePreviewTotals = {
  lines: PurchasePreviewLine[];
  subtotal: string;
  itemDiscountTotal: string;
  invoiceDiscountTotal: string;
  additionalCharges: string;
  freightCharges: string;
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
  purchaseInvoiceItemId: string;
  quantity: number;
};

export type ReturnPreviewTotals = {
  subtotal: string;
  gstTotal: string;
  grandTotal: string;
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
  const subtotalMoney = multiplyQuantityByRate(input.quantity, input.purchaseRate);
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

export const calculatePurchasePreview = (input: {
  items: CalculationItemInput[];
  invoiceDiscountTotal?: string | number | null;
  additionalCharges?: string | number | null;
  freightCharges?: string | number | null;
  paidAmount?: string | number | null;
  dueDate?: string | null;
  roundOffEnabled?: boolean;
}): PurchasePreviewTotals => {
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

  const lines = rawLines.map((line, index): PurchasePreviewLine => {
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

  const additionalCharges = normalizeMoney(input.additionalCharges ?? 0);
  const freightCharges = normalizeMoney(input.freightCharges ?? 0);
  const beforeRoundOff = addScaled(addScaled(lineGrandTotal, additionalCharges, 2), freightCharges, 2);
  const roundOffAmount = input.roundOffEnabled === false ? "0.00" : calculateRoundOff(beforeRoundOff);
  const grandTotal = addScaled(beforeRoundOff, roundOffAmount, 2);
  const paidAmount = normalizeMoney(input.paidAmount ?? 0);

  return {
    lines,
    subtotal,
    itemDiscountTotal,
    invoiceDiscountTotal,
    additionalCharges,
    freightCharges,
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

export const calculateReturnPreview = (invoice: PurchaseInvoice, items: ReturnPreviewItem[]): ReturnPreviewTotals => {
  const invoiceItems = invoice.items ?? [];
  let subtotal = "0.00";
  let gstTotal = "0.00";
  let grandTotal = "0.00";

  items.forEach((returnItem) => {
    const source = invoiceItems.find((item) => item.id === returnItem.purchaseInvoiceItemId);
    if (!source || returnItem.quantity <= 0) {
      return;
    }

    const totalQty = addScaled(source.quantity, source.freeQuantity, 3);
    subtotal = addScaled(subtotal, prorateMoney(source.taxableAmount, totalQty, returnItem.quantity), 2);
    const originalGst = addScaled(addScaled(source.cgstAmount, source.sgstAmount, 2), source.igstAmount, 2);
    gstTotal = addScaled(gstTotal, prorateMoney(originalGst, totalQty, returnItem.quantity), 2);
    grandTotal = addScaled(grandTotal, prorateMoney(source.lineTotal, totalQty, returnItem.quantity), 2);
  });

  return { subtotal, gstTotal, grandTotal };
};

export const getRemainingReturnableQty = (invoiceItem: PurchaseInvoiceItem, returnedItems: PurchaseInvoice["returns"] = []) => {
  const alreadyReturned = returnedItems.reduce((sum, entry) => {
    const match = entry.items?.find((item) => item.purchaseInvoiceItemId === invoiceItem.id);
    return match ? addScaled(sum, match.quantity, 3) : sum;
  }, "0.000");

  const maxReturnQty = addScaled(invoiceItem.quantity, invoiceItem.freeQuantity, 3);
  const remaining = subtractScaled(maxReturnQty, alreadyReturned, 3);
  return compareScaled(remaining, "0.000", 3) < 0 ? "0.000" : remaining;
};

export const isBankPaymentMode = (paymentMode: PurchasePaymentMode | null | undefined) =>
  paymentMode === "bank" || paymentMode === "upi" || paymentMode === "card" || paymentMode === "cheque";

export const isGoodsProduct = (productType: Product["productType"] | ProductLookupItem["type"] | undefined) => productType === "goods";

export const toDateInputValue = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

export const buildPurchaseItemDefaults = (warehouseId?: string | null): PurchaseFormItemInput => ({
  productId: "",
  warehouseId: warehouseId ?? null,
  batchId: null,
  batchNumber: null,
  quantity: 1,
  freeQuantity: 0,
  purchaseRate: 0,
  priceTaxType: "exclusive",
  discountPercent: 0,
  discountAmount: 0,
  gstRate: 0,
  cessRate: 0,
  manufacturingDate: null,
  expiryDate: null,
  remarks: null,
});

export const buildPurchaseFormDefaults = (
  invoice?: PurchaseInvoice | null,
  invoiceSettings?: CompanyInvoiceSettings | null,
): PurchaseFormInput => ({
  supplierId: invoice?.supplier.id ?? "",
  supplierInvoiceNumber: invoice?.supplierInvoiceNumber ?? null,
  invoiceDate: toDateInputValue(invoice?.invoiceDate) || new Date().toISOString().slice(0, 10),
  dueDate: toDateInputValue(invoice?.dueDate),
  warehouseId: invoice?.warehouse?.id ?? null,
  purchaseStatus: "draft",
  items:
    invoice?.items?.map((item) => ({
      productId: item.productId,
      warehouseId: item.warehouse?.id ?? invoice?.warehouse?.id ?? null,
      batchId: item.batch?.id ?? null,
      batchNumber: item.batch?.batchNumber ?? null,
      quantity: Number(item.quantity),
      freeQuantity: Number(item.freeQuantity),
      purchaseRate: Number(item.purchaseRate),
      priceTaxType: item.priceTaxType,
      discountPercent: Number(item.discountPercent),
      discountAmount: Number(item.discountAmount),
      gstRate: Number(item.gstRate),
      cessRate: Number(item.cessRate),
      manufacturingDate: toDateInputValue(item.manufacturingDate),
      expiryDate: toDateInputValue(item.expiryDate),
      remarks: item.remarks ?? null,
    })) ?? [buildPurchaseItemDefaults(invoice?.warehouse?.id ?? null)],
  invoiceDiscountTotal: Number(invoice?.invoiceDiscountTotal ?? 0),
  additionalCharges: Number(invoice?.additionalCharges ?? 0),
  freightCharges: Number(invoice?.freightCharges ?? 0),
  paidAmount: Number(invoice?.paidAmount ?? 0),
  paymentMode: invoice?.paymentMode ?? null,
  paymentReference: invoice?.paymentReference ?? null,
  bankAccountId: invoice?.bankAccountId ?? null,
  notes: invoice?.notes ?? null,
  termsConditions: invoice?.termsConditions ?? invoiceSettings?.termsAndConditions ?? null,
  attachmentUrl: invoice?.attachmentUrl ?? null,
});

export const createPurchasePayload = (values: PurchaseFormInput): PurchaseFormInput => ({
  ...values,
  supplierInvoiceNumber: trimToNull(values.supplierInvoiceNumber),
  dueDate: trimToNull(values.dueDate),
  paymentReference: trimToNull(values.paymentReference),
  notes: trimToNull(values.notes),
  termsConditions: trimToNull(values.termsConditions),
  attachmentUrl: trimToNull(values.attachmentUrl),
  items: values.items.map((item) => ({
    ...item,
    batchNumber: trimToNull(item.batchNumber),
    manufacturingDate: trimToNull(item.manufacturingDate),
    expiryDate: trimToNull(item.expiryDate),
    remarks: trimToNull(item.remarks),
  })),
});

export const createPurchaseUpdatePayload = (values: PurchaseFormInput) => ({
  supplierId: values.supplierId,
  supplierInvoiceNumber: trimToNull(values.supplierInvoiceNumber),
  invoiceDate: values.invoiceDate,
  dueDate: trimToNull(values.dueDate),
  warehouseId: values.warehouseId,
  items: values.items.map((item) => ({
    productId: item.productId,
    warehouseId: item.warehouseId,
    batchId: item.batchId,
    batchNumber: trimToNull(item.batchNumber),
    quantity: item.quantity,
    freeQuantity: item.freeQuantity,
    purchaseRate: item.purchaseRate,
    priceTaxType: item.priceTaxType,
    discountPercent: item.discountPercent,
    discountAmount: item.discountAmount,
    gstRate: item.gstRate,
    cessRate: item.cessRate,
    manufacturingDate: trimToNull(item.manufacturingDate),
    expiryDate: trimToNull(item.expiryDate),
    remarks: trimToNull(item.remarks),
  })),
  invoiceDiscountTotal: values.invoiceDiscountTotal,
  additionalCharges: values.additionalCharges,
  freightCharges: values.freightCharges,
  notes: trimToNull(values.notes),
  termsConditions: trimToNull(values.termsConditions),
  attachmentUrl: trimToNull(values.attachmentUrl),
});

export const createPaymentPayload = (values: PurchasePaymentInput): PurchasePaymentInput => ({
  ...values,
  bankAccountId: values.bankAccountId ?? null,
  referenceNumber: trimToNull(values.referenceNumber),
  notes: trimToNull(values.notes),
});

export const createReturnPayload = (values: PurchaseReturnInput): PurchaseReturnInput => ({
  ...values,
  warehouseId: values.warehouseId ?? null,
  notes: values.notes.trim(),
  items: values.items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      purchaseInvoiceItemId: item.purchaseInvoiceItemId,
      quantity: item.quantity,
      remarks: trimToNull(item.remarks),
    })),
});

export const canEditPurchase = (invoice: Pick<PurchaseInvoice, "purchaseStatus">) => invoice.purchaseStatus === "draft";
export const canDeletePurchase = (invoice: Pick<PurchaseInvoice, "purchaseStatus">) => invoice.purchaseStatus === "draft";
export const canPostPurchase = (invoice: Pick<PurchaseInvoice, "purchaseStatus">) => invoice.purchaseStatus === "draft";
export const canCancelPurchase = (invoice: Pick<PurchaseInvoice, "purchaseStatus">) =>
  invoice.purchaseStatus === "posted" || invoice.purchaseStatus === "returned";
export const canAddPayment = (invoice: Pick<PurchaseInvoice, "purchaseStatus" | "dueAmount">) =>
  (invoice.purchaseStatus === "posted" || invoice.purchaseStatus === "returned") &&
  compareScaled(invoice.dueAmount, "0.00", 2) > 0;
export const canCreateReturn = (invoice: Pick<PurchaseInvoice, "purchaseStatus">) =>
  invoice.purchaseStatus === "posted" || invoice.purchaseStatus === "returned";

export const resolveInterState = (company: CompanyProfile | null, supplier: Supplier | null) => {
  const companyState = company?.state?.trim().toUpperCase();
  const supplierState = supplier?.gstState?.trim().toUpperCase();
  return Boolean(companyState && supplierState && companyState !== supplierState);
};

export const hydrateItemFromProduct = (product: Product, warehouseId: string | null): PurchaseFormItemInput => ({
  productId: product.id,
  warehouseId: product.productType === "goods" ? warehouseId : null,
  batchId: null,
  batchNumber: null,
  quantity: 1,
  freeQuantity: 0,
  purchaseRate: Number(product.purchasePrice ?? 0),
  priceTaxType: product.priceTaxType,
  discountPercent: Number(product.defaultDiscount ?? 0),
  discountAmount: 0,
  gstRate: product.taxType === "taxable" ? Number(product.gstRate ?? 0) : 0,
  cessRate: product.taxType === "taxable" ? Number(product.cessRate ?? 0) : 0,
  manufacturingDate: null,
  expiryDate: null,
  remarks: null,
});

export const getFriendlyPurchaseFieldErrors = (error: unknown) => {
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
