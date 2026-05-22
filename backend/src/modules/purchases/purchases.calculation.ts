import {
  addDecimals,
  compareDecimals,
  decimalToScaledBigInt,
  normalizeMoney,
  normalizeQuantity,
  scaledBigIntToDecimal,
  subtractDecimals
} from "../inventory/inventory.utils";
import type { PurchasePaymentStatus, PurchasePriceTaxType } from "./purchases.types";

type LineCalculationInput = {
  quantity: string | number;
  purchaseRate: string | number;
  priceTaxType: PurchasePriceTaxType;
  discountPercent?: string | number | null | undefined;
  discountAmount?: string | number | null | undefined;
  gstRate?: string | number | null | undefined;
  cessRate?: string | number | null | undefined;
  isInterState: boolean;
};

type CalculatedLine = {
  subtotal: string;
  discountPercentAmount: string;
  discountAmount: string;
  itemDiscountTotal: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  cessAmount: string;
  gstAmount: string;
  lineTotal: string;
};

type InvoiceCalculationInput = {
  items: LineCalculationInput[];
  invoiceDiscountTotal?: string | number | null | undefined;
  additionalCharges?: string | number | null | undefined;
  freightCharges?: string | number | null | undefined;
  roundOffEnabled?: boolean | undefined;
};

const HUNDRED = 100n;
const THOUSAND = 1000n;
const TEN_THOUSAND = 10000n;

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

const moneyToBigInt = (value: string | number | null | undefined) => decimalToScaledBigInt(value, 2);
const quantityToBigInt = (value: string | number | null | undefined) => decimalToScaledBigInt(value, 3);
const percentToBigInt = (value: string | number | null | undefined) => decimalToScaledBigInt(value, 2);

const bigIntToMoney = (value: bigint) => scaledBigIntToDecimal(value, 2);

const multiplyQuantityByRate = (quantity: string | number, rate: string | number) => {
  const quantityScaled = quantityToBigInt(quantity);
  const rateScaled = moneyToBigInt(rate);
  return roundHalfUp(quantityScaled * rateScaled, THOUSAND);
};

const calculatePercentAmount = (baseMoney: bigint, percent: string | number | null | undefined) => {
  const percentScaled = percentToBigInt(percent);
  return roundHalfUp(baseMoney * percentScaled, TEN_THOUSAND);
};

const calculateTaxAmount = (taxableMoney: bigint, rate: string | number | null | undefined) => {
  const rateScaled = percentToBigInt(rate);
  return roundHalfUp(taxableMoney * rateScaled, TEN_THOUSAND);
};

const clampAtZero = (value: bigint) => (value < 0n ? 0n : value);

export const calculateGSTSplit = (gstAmount: string | number | null | undefined, isInterState: boolean) => {
  const gstMoney = moneyToBigInt(gstAmount);
  if (isInterState) {
    return {
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: bigIntToMoney(gstMoney)
    };
  }

  const cgst = roundHalfUp(gstMoney, 2n);
  const sgst = gstMoney - cgst;
  return {
    cgstAmount: bigIntToMoney(cgst),
    sgstAmount: bigIntToMoney(sgst),
    igstAmount: "0.00"
  };
};

const calculateLineValues = (input: LineCalculationInput): CalculatedLine => {
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
    } else {
      taxableMoney = discountedTotal;
    }
  } else {
    gstAmountMoney = calculateTaxAmount(taxableMoney, input.gstRate ?? 0);
    cessAmountMoney = calculateTaxAmount(taxableMoney, input.cessRate ?? 0);
  }

  const split = calculateGSTSplit(bigIntToMoney(gstAmountMoney), input.isInterState);
  const lineTotalMoney =
    input.priceTaxType === "inclusive" ? taxableMoney + gstAmountMoney + cessAmountMoney : discountedTotal + gstAmountMoney + cessAmountMoney;

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
    lineTotal: bigIntToMoney(lineTotalMoney)
  };
};

export const calculateLineTaxExclusive = (input: Omit<LineCalculationInput, "priceTaxType">) =>
  calculateLineValues({ ...input, priceTaxType: "exclusive" });

export const calculateLineTaxInclusive = (input: Omit<LineCalculationInput, "priceTaxType">) =>
  calculateLineValues({ ...input, priceTaxType: "inclusive" });

const allocateInvoiceDiscount = (taxableAmounts: string[], invoiceDiscountTotal: string) => {
  const totalTaxable = moneyToBigInt(taxableAmounts.reduce((sum, amount) => addDecimals(sum, amount, 2), "0.00"));
  const discountTotal = moneyToBigInt(invoiceDiscountTotal);

  if (discountTotal <= 0n || totalTaxable <= 0n) {
    return taxableAmounts.map(() => "0.00");
  }

  let allocated = 0n;
  return taxableAmounts.map((taxableAmount, index) => {
    if (index === taxableAmounts.length - 1) {
      return bigIntToMoney(discountTotal - allocated);
    }

    const taxableMoney = moneyToBigInt(taxableAmount);
    const share = roundHalfUp(discountTotal * taxableMoney, totalTaxable);
    allocated += share;
    return bigIntToMoney(share);
  });
};

export const calculateRoundOff = (grandTotalBeforeRoundOff: string | number | null | undefined) => {
  const grandTotalMoney = moneyToBigInt(grandTotalBeforeRoundOff);
  const roundedWhole = roundHalfUp(grandTotalMoney, HUNDRED) * HUNDRED;
  return bigIntToMoney(roundedWhole - grandTotalMoney);
};

export const calculateInvoiceTotals = (input: InvoiceCalculationInput) => {
  const rawLines = input.items.map((item) => calculateLineValues(item));
  const invoiceDiscountTotal = normalizeMoney(input.invoiceDiscountTotal ?? 0);
  const allocatedDiscounts = allocateInvoiceDiscount(
    rawLines.map((line) => line.taxableAmount),
    invoiceDiscountTotal
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

  const lines = rawLines.map((line, index) => {
    const invoiceDiscountShare = allocatedDiscounts[index];
    const netTaxable = subtractDecimals(line.taxableAmount, invoiceDiscountShare, 2);
    const gstAmount = calculateTaxAmount(moneyToBigInt(netTaxable), input.items[index]?.gstRate ?? 0);
    const cessAmount = calculateTaxAmount(moneyToBigInt(netTaxable), input.items[index]?.cessRate ?? 0);
    const split = calculateGSTSplit(bigIntToMoney(gstAmount), input.items[index]!.isInterState);
    const lineTotal =
      input.items[index]!.priceTaxType === "inclusive"
        ? addDecimals(addDecimals(netTaxable, bigIntToMoney(gstAmount), 2), bigIntToMoney(cessAmount), 2)
        : addDecimals(addDecimals(netTaxable, bigIntToMoney(gstAmount), 2), bigIntToMoney(cessAmount), 2);

    subtotal = addDecimals(subtotal, line.subtotal, 2);
    itemDiscountTotal = addDecimals(itemDiscountTotal, line.itemDiscountTotal, 2);
    taxableAmount = addDecimals(taxableAmount, netTaxable, 2);
    cgstTotal = addDecimals(cgstTotal, split.cgstAmount, 2);
    sgstTotal = addDecimals(sgstTotal, split.sgstAmount, 2);
    igstTotal = addDecimals(igstTotal, split.igstAmount, 2);
    cessTotal = addDecimals(cessTotal, bigIntToMoney(cessAmount), 2);
    gstTotal = addDecimals(gstTotal, bigIntToMoney(gstAmount), 2);
    lineGrandTotal = addDecimals(lineGrandTotal, lineTotal, 2);

    return {
      ...line,
      invoiceDiscountShare,
      taxableAmount: netTaxable,
      cgstAmount: split.cgstAmount,
      sgstAmount: split.sgstAmount,
      igstAmount: split.igstAmount,
      cessAmount: bigIntToMoney(cessAmount),
      gstAmount: bigIntToMoney(gstAmount),
      lineTotal
    };
  });

  const additionalCharges = normalizeMoney(input.additionalCharges ?? 0);
  const freightCharges = normalizeMoney(input.freightCharges ?? 0);
  const beforeRoundOff = addDecimals(addDecimals(lineGrandTotal, additionalCharges, 2), freightCharges, 2);
  const roundOffAmount = input.roundOffEnabled === false ? "0.00" : calculateRoundOff(beforeRoundOff);
  const grandTotal = addDecimals(beforeRoundOff, roundOffAmount, 2);

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
    grandTotal
  };
};

export const calculateDueAmount = (grandTotal: string | number, paidAmount: string | number) => {
  const dueAmount = subtractDecimals(normalizeMoney(grandTotal), normalizeMoney(paidAmount), 2);
  return compareDecimals(dueAmount, "0.00", 2) < 0 ? "0.00" : dueAmount;
};

const toDateOnlyKey = (value: Date) => value.toISOString().slice(0, 10);

export const calculatePaymentStatus = (input: {
  grandTotal: string | number;
  paidAmount: string | number;
  dueDate?: Date | null | undefined;
  asOf?: Date | undefined;
}): PurchasePaymentStatus => {
  const grandTotal = normalizeMoney(input.grandTotal);
  const paidAmount = normalizeMoney(input.paidAmount);
  const dueAmount = calculateDueAmount(grandTotal, paidAmount);

  if (compareDecimals(dueAmount, "0.00", 2) <= 0) {
    return "paid";
  }

  if (compareDecimals(paidAmount, "0.00", 2) > 0) {
    return "partial";
  }

  const asOfDate = input.asOf ?? new Date();
  if (input.dueDate && toDateOnlyKey(input.dueDate) < toDateOnlyKey(asOfDate)) {
    return "overdue";
  }

  return "unpaid";
};

export { normalizeMoney, normalizeQuantity };
