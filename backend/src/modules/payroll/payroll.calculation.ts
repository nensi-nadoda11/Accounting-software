import {
  addDecimals,
  compareDecimals,
  decimalToScaledBigInt,
  normalizeMoney as normalizeMoneyValue,
  scaledBigIntToDecimal,
  subtractDecimals
} from "../inventory/inventory.utils";

import type { PayrollItemPaymentStatus, SalaryType } from "./payroll.types";

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

const normalizeUnits = (value: string | number | null | undefined) =>
  scaledBigIntToDecimal(decimalToScaledBigInt(value, 2), 2);

const addUnits = (left: string | number | null | undefined, right: string | number | null | undefined) =>
  scaledBigIntToDecimal(decimalToScaledBigInt(left, 2) + decimalToScaledBigInt(right, 2), 2);

const multiply = (left: string | number | null | undefined, right: string | number | null | undefined, scale = 2) =>
  scaledBigIntToDecimal(roundHalfUp(decimalToScaledBigInt(left, scale) * decimalToScaledBigInt(right, scale), 10n ** BigInt(scale)), scale);

const divide = (left: string | number | null | undefined, right: string | number | null | undefined, scale = 2) => {
  const numerator = decimalToScaledBigInt(left, scale);
  const denominator = decimalToScaledBigInt(right, scale);
  if (denominator === 0n) {
    return scaledBigIntToDecimal(0n, scale);
  }

  return scaledBigIntToDecimal(roundHalfUp(numerator * 10n ** BigInt(scale), denominator), scale);
};

export const STANDARD_HOURS_PER_DAY = "8.00";

export const normalizeMoney = (value: string | number | null | undefined) => normalizeMoneyValue(value);

export const calculateSalaryStructureTotals = (input: {
  basicSalary: string | number;
  hra?: string | number | null;
  conveyanceAllowance?: string | number | null;
  medicalAllowance?: string | number | null;
  otherAllowance?: string | number | null;
  pfDeduction?: string | number | null;
  esicDeduction?: string | number | null;
  professionalTax?: string | number | null;
  tdsDeduction?: string | number | null;
  otherDeduction?: string | number | null;
}) => {
  const grossSalary = [
    input.basicSalary,
    input.hra ?? "0",
    input.conveyanceAllowance ?? "0",
    input.medicalAllowance ?? "0",
    input.otherAllowance ?? "0"
  ].reduce((sum, value) => addDecimals(sum, value, 2), "0.00");
  const totalDeductions = [
    input.pfDeduction ?? "0",
    input.esicDeduction ?? "0",
    input.professionalTax ?? "0",
    input.tdsDeduction ?? "0",
    input.otherDeduction ?? "0"
  ].reduce((sum, value) => addDecimals(sum, value, 2), "0.00");
  const netSalary = subtractDecimals(grossSalary, totalDeductions, 2);

  return {
    grossSalary: normalizeMoney(grossSalary),
    totalDeductions: normalizeMoney(totalDeductions),
    netSalary: normalizeMoney(netSalary)
  };
};

export const calculatePayableDays = (input: {
  presentDays: string | number | null | undefined;
  paidLeaveDays: string | number | null | undefined;
  halfDays: string | number | null | undefined;
}) => {
  const halfContribution = divide(input.halfDays ?? "0", "2", 2);
  return normalizeUnits(addUnits(addUnits(input.presentDays ?? "0", input.paidLeaveDays ?? "0"), halfContribution));
};

export const calculateProratedSalary = (input: {
  salaryType: SalaryType;
  workingDays: string | number;
  payableDays: string | number;
  overtimeHours?: string | number | null;
  basicSalary: string | number;
  hra: string | number;
  allowancesTotal: string | number;
  deductionsTotal: string | number;
}) => {
  const workingDays = normalizeUnits(input.workingDays);
  const payableDays = normalizeUnits(input.payableDays);
  const overtimeHours = normalizeUnits(input.overtimeHours ?? "0");
  const workingHours = multiply(workingDays, STANDARD_HOURS_PER_DAY, 2);
  const payableHours = addUnits(multiply(payableDays, STANDARD_HOURS_PER_DAY, 2), overtimeHours);

  const factor =
    input.salaryType === "monthly"
      ? divide(payableDays, workingDays, 4)
      : input.salaryType === "daily"
        ? payableDays
        : payableHours;

  const unitLabel = input.salaryType === "hourly" ? "hour" : "day";
  const basicSalary =
    input.salaryType === "monthly"
      ? multiply(input.basicSalary, factor, 4)
      : multiply(input.basicSalary, factor, 2);
  const hra =
    input.salaryType === "monthly"
      ? multiply(input.hra, factor, 4)
      : multiply(input.hra, factor, 2);
  const allowancesTotal =
    input.salaryType === "monthly"
      ? multiply(input.allowancesTotal, factor, 4)
      : multiply(input.allowancesTotal, factor, 2);
  const deductionsTotal =
    input.salaryType === "monthly"
      ? multiply(input.deductionsTotal, factor, 4)
      : multiply(input.deductionsTotal, factor, 2);
  const grossSalary = calculateGrossSalary(basicSalary, hra, allowancesTotal, "0.00");
  const netSalary = calculateNetSalary(grossSalary, deductionsTotal);
  const perUnitNetSalary =
    input.salaryType === "monthly"
      ? divide(netSalary, workingDays, 2)
      : input.salaryType === "daily"
        ? normalizeMoney(netSalary)
        : normalizeMoney(netSalary);

  return {
    basicSalary: normalizeMoney(basicSalary),
    hra: normalizeMoney(hra),
    allowancesTotal: normalizeMoney(allowancesTotal),
    deductionsTotal: normalizeMoney(deductionsTotal),
    grossSalary: normalizeMoney(grossSalary),
    netSalary: normalizeMoney(netSalary),
    payableDays,
    payableHours,
    workingHours,
    perUnitNetSalary,
    unitLabel
  };
};

export const calculateGrossSalary = (
  basicSalary: string | number | null | undefined,
  hra: string | number | null | undefined,
  allowancesTotal: string | number | null | undefined,
  bonusTotal: string | number | null | undefined
) => normalizeMoney([basicSalary, hra, allowancesTotal, bonusTotal].reduce((sum, value) => addDecimals(sum, value, 2), "0.00"));

export const calculateTotalDeductions = (
  structureDeductions: string | number | null | undefined,
  extraDeductions: string | number | null | undefined
) => normalizeMoney(addDecimals(structureDeductions, extraDeductions, 2));

export const calculateNetSalary = (
  grossSalary: string | number | null | undefined,
  totalDeductions: string | number | null | undefined
) => normalizeMoney(subtractDecimals(grossSalary, totalDeductions, 2));

export const calculatePaymentStatus = (netSalary: string, paidAmount: string): PayrollItemPaymentStatus => {
  if (compareDecimals(paidAmount, "0.00", 2) <= 0) {
    return "unpaid";
  }

  if (compareDecimals(paidAmount, netSalary, 2) >= 0) {
    return "paid";
  }

  return "partial";
};

export const calculatePayrollRunTotals = (
  items: Array<{
    grossSalary: string;
    deductionsTotal: string;
    bonusTotal: string;
    netSalary: string;
    paidAmount: string;
  }>
) =>
  items.reduce(
    (accumulator, item) => ({
      totalEmployees: accumulator.totalEmployees + 1,
      grossTotal: normalizeMoney(addDecimals(accumulator.grossTotal, item.grossSalary, 2)),
      deductionTotal: normalizeMoney(addDecimals(accumulator.deductionTotal, item.deductionsTotal, 2)),
      bonusTotal: normalizeMoney(addDecimals(accumulator.bonusTotal, item.bonusTotal, 2)),
      netPayableTotal: normalizeMoney(addDecimals(accumulator.netPayableTotal, item.netSalary, 2)),
      paidTotal: normalizeMoney(addDecimals(accumulator.paidTotal, item.paidAmount, 2))
    }),
    {
      totalEmployees: 0,
      grossTotal: "0.00",
      deductionTotal: "0.00",
      bonusTotal: "0.00",
      netPayableTotal: "0.00",
      paidTotal: "0.00"
    }
  );
