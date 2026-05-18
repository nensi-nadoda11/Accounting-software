import { addDecimals, compareDecimals, decimalToScaledBigInt, normalizeMoney as baseNormalizeMoney, scaledBigIntToDecimal } from "../inventory/inventory.utils";
import { AppError } from "../../utils/app-error";
import type { AccountNormalBalance, AccountType } from "./accounting.types";
import { DEFAULT_NORMAL_BALANCE_BY_ACCOUNT_TYPE } from "./accounting.types";

type JournalAmountLike = {
  debit: string | number | null | undefined;
  credit: string | number | null | undefined;
};

export const normalizeMoney = (value: string | number | null | undefined) => baseNormalizeMoney(value);

export const sumDebits = (lines: JournalAmountLike[]) =>
  lines.reduce((total, line) => addDecimals(total, line.debit ?? 0, 2), "0.00");

export const sumCredits = (lines: JournalAmountLike[]) =>
  lines.reduce((total, line) => addDecimals(total, line.credit ?? 0, 2), "0.00");

export const assertBalanced = (lines: JournalAmountLike[]) => {
  const totalDebit = sumDebits(lines);
  const totalCredit = sumCredits(lines);

  if (compareDecimals(totalDebit, totalCredit, 2) !== 0) {
    throw new AppError("Total debit must equal total credit", 400, [
      `totalDebit: ${totalDebit}`,
      `totalCredit: ${totalCredit}`
    ]);
  }

  return {
    totalDebit,
    totalCredit
  };
};

export const getDefaultNormalBalance = (accountType: AccountType): AccountNormalBalance =>
  DEFAULT_NORMAL_BALANCE_BY_ACCOUNT_TYPE[accountType];

export const calculateAccountBalanceByNormalSide = (
  normalBalance: AccountNormalBalance,
  debit: string | number | null | undefined,
  credit: string | number | null | undefined
) => {
  const debitValue = decimalToScaledBigInt(debit, 2);
  const creditValue = decimalToScaledBigInt(credit, 2);
  const result = normalBalance === "debit" ? debitValue - creditValue : creditValue - debitValue;
  return scaledBigIntToDecimal(result, 2);
};

export const applyBalanceDelta = (
  currentBalance: string | number | null | undefined,
  normalBalance: AccountNormalBalance,
  debit: string | number | null | undefined,
  credit: string | number | null | undefined
) => {
  const currentValue = decimalToScaledBigInt(currentBalance, 2);
  const deltaValue = decimalToScaledBigInt(calculateAccountBalanceByNormalSide(normalBalance, debit, credit), 2);
  return scaledBigIntToDecimal(currentValue + deltaValue, 2);
};

export const splitBalanceBySide = (balance: string | number | null | undefined, normalBalance: AccountNormalBalance) => {
  const value = decimalToScaledBigInt(balance, 2);
  const absolute = value < 0n ? value * -1n : value;
  const side =
    value === 0n
      ? normalBalance
      : value > 0n
        ? normalBalance
        : normalBalance === "debit"
          ? "credit"
          : "debit";

  return {
    amount: scaledBigIntToDecimal(absolute, 2),
    side
  };
};

export const calculateRunningBalance = (
  openingBalance: string,
  normalBalance: AccountNormalBalance,
  rows: Array<JournalAmountLike>
) => {
  let runningBalance = openingBalance;

  return rows.map((row) => {
    runningBalance = applyBalanceDelta(runningBalance, normalBalance, row.debit, row.credit);
    return runningBalance;
  });
};

export const calculateTrialBalance = (
  rows: Array<{
    closingBalance: string;
    normalBalance: AccountNormalBalance;
  }>
) => {
  let totalDebit = "0.00";
  let totalCredit = "0.00";

  const items = rows.map((row) => {
    const split = splitBalanceBySide(row.closingBalance, row.normalBalance);
    const debit = split.side === "debit" ? split.amount : "0.00";
    const credit = split.side === "credit" ? split.amount : "0.00";
    totalDebit = addDecimals(totalDebit, debit, 2);
    totalCredit = addDecimals(totalCredit, credit, 2);

    return {
      ...row,
      debit,
      credit,
      closingSide: split.side,
      closingAmount: split.amount
    };
  });

  return {
    items,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
      isBalanced: compareDecimals(totalDebit, totalCredit, 2) === 0,
      imbalance: scaledBigIntToDecimal(
        decimalToScaledBigInt(totalDebit, 2) - decimalToScaledBigInt(totalCredit, 2),
        2
      )
    }
  };
};

export const calculateProfitLoss = (
  rows: Array<{
    accountType: AccountType;
    balance: string;
  }>
) => {
  let totalIncome = "0.00";
  let totalExpense = "0.00";

  for (const row of rows) {
    if (row.accountType === "income") {
      totalIncome = addDecimals(totalIncome, row.balance, 2);
    }

    if (row.accountType === "expense") {
      totalExpense = addDecimals(totalExpense, row.balance, 2);
    }
  }

  return {
    totalIncome,
    totalExpense,
    netProfitLoss: scaledBigIntToDecimal(
      decimalToScaledBigInt(totalIncome, 2) - decimalToScaledBigInt(totalExpense, 2),
      2
    )
  };
};

export const calculateBalanceSheet = (input: {
  assetTotal: string;
  liabilityTotal: string;
  equityTotal: string;
  currentProfitLoss: string;
}) => {
  const rightSide = addDecimals(addDecimals(input.liabilityTotal, input.equityTotal, 2), input.currentProfitLoss, 2);

  return {
    assets: input.assetTotal,
    liabilities: input.liabilityTotal,
    equity: input.equityTotal,
    currentProfitLoss: input.currentProfitLoss,
    rightSide,
    isBalanced: compareDecimals(input.assetTotal, rightSide, 2) === 0,
    imbalance: scaledBigIntToDecimal(
      decimalToScaledBigInt(input.assetTotal, 2) - decimalToScaledBigInt(rightSide, 2),
      2
    )
  };
};
