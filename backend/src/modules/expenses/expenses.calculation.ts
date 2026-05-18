import {
  addDecimals,
  compareDecimals,
  decimalToScaledBigInt,
  normalizeMoney as normalizeMoneyValue,
  scaledBigIntToDecimal
} from "../inventory/inventory.utils";
import type { ExpensePriceTaxType, RecurringExpenseFrequency } from "./expenses.types";

type GstSplitInput = {
  taxableAmount: string;
  gstAmount: string;
  intraState: boolean;
};

type ExpenseTotalInput = {
  amount: string | number;
  gstApplicable: boolean;
  gstRate: string | number;
  priceTaxType: ExpensePriceTaxType;
  intraState: boolean;
};

const GST_DIVISOR_SCALE = 4;

const divideScaled = (dividend: bigint, divisor: bigint) => {
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

const addMonths = (date: Date, months: number) => {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const originalDay = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDayOfMonth = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(originalDay, lastDayOfMonth));
  return next;
};

const splitHalf = (value: string) => {
  const scaled = decimalToScaledBigInt(value, 2);
  const half = divideScaled(scaled, 2n);
  const otherHalf = scaled - half;

  return {
    first: scaledBigIntToDecimal(half, 2),
    second: scaledBigIntToDecimal(otherHalf, 2)
  };
};

export const normalizeMoney = (value: string | number | null | undefined) => normalizeMoneyValue(value);

export const calculateGSTSplit = ({ gstAmount, intraState }: GstSplitInput) => {
  if (compareDecimals(gstAmount, "0", 2) <= 0) {
    return {
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: "0.00"
    };
  }

  if (!intraState) {
    return {
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: normalizeMoney(gstAmount)
    };
  }

  const half = splitHalf(normalizeMoney(gstAmount));
  return {
    cgstAmount: half.first,
    sgstAmount: half.second,
    igstAmount: "0.00"
  };
};

export const calculateExpenseTaxExclusive = (amount: string | number, gstRate: string | number, intraState: boolean) => {
  const baseAmount = normalizeMoney(amount);
  const rateScaled = decimalToScaledBigInt(gstRate, GST_DIVISOR_SCALE);
  const gstScaled = divideScaled(decimalToScaledBigInt(baseAmount, 2) * rateScaled, 10n ** BigInt(GST_DIVISOR_SCALE + 2));
  const gstAmount = scaledBigIntToDecimal(gstScaled, 2);
  const split = calculateGSTSplit({
    taxableAmount: baseAmount,
    gstAmount,
    intraState
  });

  return {
    taxableAmount: baseAmount,
    ...split,
    gstAmount,
    totalAmount: addDecimals(baseAmount, gstAmount, 2)
  };
};

export const calculateExpenseTaxInclusive = (totalAmount: string | number, gstRate: string | number, intraState: boolean) => {
  const normalizedTotal = normalizeMoney(totalAmount);
  const totalScaled = decimalToScaledBigInt(normalizedTotal, 2);
  const rateScaled = decimalToScaledBigInt(gstRate, GST_DIVISOR_SCALE);
  const divisor = 10n ** BigInt(GST_DIVISOR_SCALE) + rateScaled;
  const baseScaled = divideScaled(totalScaled * 10n ** BigInt(GST_DIVISOR_SCALE), divisor);
  const taxableAmount = scaledBigIntToDecimal(baseScaled, 2);
  const gstAmount = scaledBigIntToDecimal(totalScaled - baseScaled, 2);
  const split = calculateGSTSplit({
    taxableAmount,
    gstAmount,
    intraState
  });

  return {
    taxableAmount,
    ...split,
    gstAmount,
    totalAmount: normalizedTotal
  };
};

export const calculateExpenseTotals = (input: ExpenseTotalInput) => {
  const amount = normalizeMoney(input.amount);
  const gstRate = normalizeMoney(input.gstRate);

  if (!input.gstApplicable || compareDecimals(gstRate, "0", 2) <= 0) {
    return {
      amount,
      gstApplicable: false,
      gstRate: "0.00",
      taxableAmount: amount,
      cgstAmount: "0.00",
      sgstAmount: "0.00",
      igstAmount: "0.00",
      gstAmount: "0.00",
      totalAmount: amount
    };
  }

  const taxResult =
    input.priceTaxType === "inclusive"
      ? calculateExpenseTaxInclusive(amount, gstRate, input.intraState)
      : calculateExpenseTaxExclusive(amount, gstRate, input.intraState);

  return {
    amount,
    gstApplicable: true,
    gstRate,
    ...taxResult
  };
};

export const calculateNextRunDate = (currentRunDate: Date, frequency: RecurringExpenseFrequency) => {
  const date = new Date(Date.UTC(currentRunDate.getUTCFullYear(), currentRunDate.getUTCMonth(), currentRunDate.getUTCDate()));

  switch (frequency) {
    case "daily":
      date.setUTCDate(date.getUTCDate() + 1);
      return date;
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      return date;
    case "monthly":
      return addMonths(date, 1);
    case "quarterly":
      return addMonths(date, 3);
    case "yearly":
      return addMonths(date, 12);
  }
};
