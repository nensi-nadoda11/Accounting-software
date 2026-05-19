import {
  addDecimals,
  compareDecimals,
  decimalToScaledBigInt,
  normalizeMoney as normalizeMoneyValue,
  scaledBigIntToDecimal
} from "../inventory/inventory.utils";
import type { GstTaxComponent } from "./gst.types";

type TaxComponentTotals = {
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  cessAmount: string;
};

export type GstRateSummaryRowInput = TaxComponentTotals & {
  gstRate: string;
  taxableSales: string;
  outputGst: string;
  taxablePurchases: string;
  inputGst: string;
};

export type HsnSummaryRowInput = TaxComponentTotals & {
  hsnSacCode: string | null;
  description: string | null;
  unit: string | null;
  quantity: string;
  taxableValue: string;
  gstRate: string;
};

const zeroTotals = (): TaxComponentTotals => ({
  cgstAmount: "0.00",
  sgstAmount: "0.00",
  igstAmount: "0.00",
  cessAmount: "0.00"
});

const sumComponents = (components: TaxComponentTotals) =>
  [components.cgstAmount, components.sgstAmount, components.igstAmount, components.cessAmount].reduce(
    (total, value) => addDecimals(total, value, 2),
    "0.00"
  );

export const normalizeMoney = (value: string | number | null | undefined) => normalizeMoneyValue(value);

export const calculateOutputTax = (input: {
  salesGst: string;
  salesReturnGst: string;
  outputAdjustments: string;
}) => {
  const total = addDecimals(
    addDecimals(input.salesGst, normalizeMoney(-Number(input.salesReturnGst)), 2),
    input.outputAdjustments,
    2
  );

  return {
    salesGst: normalizeMoney(input.salesGst),
    salesReturnGst: normalizeMoney(input.salesReturnGst),
    outputAdjustments: normalizeMoney(input.outputAdjustments),
    outputGst: normalizeMoney(total)
  };
};

export const calculateInputTax = (input: {
  purchaseGst: string;
  eligibleExpenseGst: string;
  purchaseReturnGst: string;
  itcReversals: string;
  itcClaims: string;
}) => {
  const total = addDecimals(
    addDecimals(input.purchaseGst, input.eligibleExpenseGst, 2),
    addDecimals(
      normalizeMoney(-Number(input.purchaseReturnGst)),
      addDecimals(normalizeMoney(-Number(input.itcReversals)), input.itcClaims, 2),
      2
    ),
    2
  );

  return {
    purchaseGst: normalizeMoney(input.purchaseGst),
    eligibleExpenseGst: normalizeMoney(input.eligibleExpenseGst),
    purchaseReturnGst: normalizeMoney(input.purchaseReturnGst),
    itcReversals: normalizeMoney(input.itcReversals),
    itcClaims: normalizeMoney(input.itcClaims),
    inputGst: normalizeMoney(total)
  };
};

export const calculateNetGstPayable = (input: { outputGst: string; inputGst: string }) => {
  const difference = addDecimals(input.outputGst, normalizeMoney(-Number(input.inputGst)), 2);
  const isPayable = compareDecimals(difference, "0.00", 2) >= 0;

  return {
    outputGst: normalizeMoney(input.outputGst),
    inputGst: normalizeMoney(input.inputGst),
    netGstPayable: isPayable ? normalizeMoney(difference) : "0.00",
    netGstCredit: isPayable ? "0.00" : normalizeMoney(-Number(difference))
  };
};

export const calculateTaxRateSummary = (rows: GstRateSummaryRowInput[]) => {
  const grouped = new Map<string, GstRateSummaryRowInput>();

  for (const row of rows) {
    const key = normalizeMoney(row.gstRate);
    const current =
      grouped.get(key) ??
      ({
        gstRate: key,
        taxableSales: "0.00",
        outputGst: "0.00",
        taxablePurchases: "0.00",
        inputGst: "0.00",
        ...zeroTotals()
      } satisfies GstRateSummaryRowInput);

    current.taxableSales = addDecimals(current.taxableSales, row.taxableSales, 2);
    current.outputGst = addDecimals(current.outputGst, row.outputGst, 2);
    current.taxablePurchases = addDecimals(current.taxablePurchases, row.taxablePurchases, 2);
    current.inputGst = addDecimals(current.inputGst, row.inputGst, 2);
    current.cgstAmount = addDecimals(current.cgstAmount, row.cgstAmount, 2);
    current.sgstAmount = addDecimals(current.sgstAmount, row.sgstAmount, 2);
    current.igstAmount = addDecimals(current.igstAmount, row.igstAmount, 2);
    current.cessAmount = addDecimals(current.cessAmount, row.cessAmount, 2);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .sort((left, right) => Number(left.gstRate) - Number(right.gstRate))
    .map((row) => ({
      ...row,
      netGst: normalizeMoney(Number(row.outputGst) - Number(row.inputGst))
    }));
};

export const calculateHsnSummary = (rows: HsnSummaryRowInput[]) => {
  const grouped = new Map<string, HsnSummaryRowInput>();

  for (const row of rows) {
    const code = row.hsnSacCode?.trim() || "UNSPECIFIED";
    const rate = normalizeMoney(row.gstRate);
    const key = `${code}:${rate}:${row.unit ?? ""}:${row.description ?? ""}`;
    const current =
      grouped.get(key) ??
      ({
        hsnSacCode: row.hsnSacCode,
        description: row.description,
        unit: row.unit,
        quantity: "0.000",
        taxableValue: "0.00",
        gstRate: rate,
        ...zeroTotals()
      } satisfies HsnSummaryRowInput);

    current.quantity = scaledBigIntToDecimal(
      decimalToScaledBigInt(current.quantity, 3) + decimalToScaledBigInt(row.quantity, 3),
      3
    );
    current.taxableValue = addDecimals(current.taxableValue, row.taxableValue, 2);
    current.cgstAmount = addDecimals(current.cgstAmount, row.cgstAmount, 2);
    current.sgstAmount = addDecimals(current.sgstAmount, row.sgstAmount, 2);
    current.igstAmount = addDecimals(current.igstAmount, row.igstAmount, 2);
    current.cessAmount = addDecimals(current.cessAmount, row.cessAmount, 2);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    totalTax: sumComponents(row)
  }));
};

export const validateGstSplit = (input: {
  taxableAmount: string;
  gstRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  cessAmount?: string;
  expectedComponent?: GstTaxComponent | null;
}) => {
  const errors: string[] = [];
  const cessAmount = input.cessAmount ?? "0.00";
  const cgstPositive = compareDecimals(input.cgstAmount, "0.00", 2) > 0;
  const sgstPositive = compareDecimals(input.sgstAmount, "0.00", 2) > 0;
  const igstPositive = compareDecimals(input.igstAmount, "0.00", 2) > 0;
  const totalTax = sumComponents({
    cgstAmount: input.cgstAmount,
    sgstAmount: input.sgstAmount,
    igstAmount: input.igstAmount,
    cessAmount
  });

  if (igstPositive && (cgstPositive || sgstPositive)) {
    errors.push("IGST cannot be combined with CGST or SGST");
  }

  if (cgstPositive !== sgstPositive) {
    errors.push("CGST and SGST must be equal for intra-state tax");
  }

  if (input.expectedComponent === "cgst" && !cgstPositive) {
    errors.push("CGST amount is required for the selected component");
  }

  if (input.expectedComponent === "sgst" && !sgstPositive) {
    errors.push("SGST amount is required for the selected component");
  }

  if (input.expectedComponent === "igst" && !igstPositive) {
    errors.push("IGST amount is required for the selected component");
  }

  if (input.expectedComponent === "cess" && compareDecimals(cessAmount, "0.00", 2) <= 0) {
    errors.push("Cess amount is required for the selected component");
  }

  return {
    isValid: errors.length === 0,
    totalTax,
    errors
  };
};
