import { format } from "date-fns";

import type {
  Account,
  AccountNormalBalance,
  AccountType,
  BalanceAmount,
  JournalVoucherType,
} from "../../types/accounting";

const titleFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const formatAccountingDate = (value: string | Date | null | undefined, pattern = "dd MMM yyyy") => {
  if (!value) {
    return "-";
  }

  return format(new Date(value), pattern);
};

export const formatAccountingDateTime = (value: string | Date | null | undefined) => {
  if (!value) {
    return "-";
  }

  return titleFormatter.format(new Date(value));
};

export const toDateInputValue = (value: Date) => value.toISOString().slice(0, 10);

export const getTodayInput = () => toDateInputValue(new Date());

export const getMonthStartInput = () => {
  const date = new Date();
  return toDateInputValue(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
};

export const downloadBlobFile = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const accountTypeLabels: Record<AccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
};

export const journalVoucherLabels: Record<JournalVoucherType, string> = {
  journal: "Journal",
  sales: "Sales",
  purchase: "Purchase",
  receipt: "Receipt",
  payment: "Payment",
  contra: "Contra",
  debit_note: "Debit Note",
  credit_note: "Credit Note",
  expense: "Expense",
  payroll: "Payroll",
  opening: "Opening",
  adjustment: "Adjustment",
  reversal: "Reversal",
};

export const normalBalanceLabels: Record<AccountNormalBalance, string> = {
  debit: "Debit",
  credit: "Credit",
};

export const balanceSideTone = (side: AccountNormalBalance) => (side === "debit" ? "info" : "warning");

export const flattenAccounts = (items: Account[], depth = 0): Array<Account & { depth: number }> =>
  items.flatMap((item) => [
    { ...item, depth },
    ...(item.children ? flattenAccounts(item.children, depth + 1) : []),
  ]);

export const compareAccountRows = (left: Account, right: Account) =>
  `${left.accountCode} ${left.accountName}`.localeCompare(`${right.accountCode} ${right.accountName}`);

export const buildAccountOptions = (items: Account[]) =>
  flattenAccounts(items)
    .sort(compareAccountRows)
    .map((item) => ({
      value: item.id,
      label: `${"".padStart(item.depth * 2, " ")}${item.accountCode} - ${item.accountName}`,
    }));

export const formatBalanceLabel = (balance: BalanceAmount) => `${balance.amount} ${normalBalanceLabels[balance.side]}`;
