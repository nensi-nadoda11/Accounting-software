import type {
  ExpenseCategoryStatus,
  ExpenseChequeStatus,
  ExpenseGstRate,
  ExpensePaymentMode,
  ExpensePriceTaxType,
  ExpenseStatus,
  RecurringExpenseCreateStatus,
  RecurringExpenseFrequency,
  RecurringExpenseStatus,
} from "../../types/expense";

export const EXPENSE_TABS = [
  { id: "expenses", label: "Expenses" },
  { id: "categories", label: "Categories" },
  { id: "recurring", label: "Recurring" },
  { id: "reports", label: "Reports" },
] as const;

export const REPORT_TABS = [
  { id: "category-wise", label: "Category Wise" },
  { id: "monthly", label: "Monthly" },
  { id: "payment-mode", label: "Payment Mode" },
  { id: "gst", label: "GST" },
] as const;

export const EXPENSE_PAYMENT_MODE_LABELS: Record<ExpensePaymentMode, string> = {
  cash: "Cash",
  bank: "Bank",
  upi: "UPI",
  card: "Card",
  cheque: "Cheque",
  neft: "NEFT",
  rtgs: "RTGS",
  imps: "IMPS",
  other: "Other",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  approved: "Approved",
  cancelled: "Cancelled",
  recurring_generated: "Recurring",
};

export const EXPENSE_CATEGORY_STATUS_LABELS: Record<ExpenseCategoryStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  deleted: "Deleted",
};

export const EXPENSE_CHEQUE_STATUS_LABELS: Record<ExpenseChequeStatus, string> = {
  issued: "Issued",
  deposited: "Deposited",
  cleared: "Cleared",
  bounced: "Bounced",
  cancelled: "Cancelled",
};

export const RECURRING_STATUS_LABELS: Record<RecurringExpenseStatus, string> = {
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const RECURRING_FREQUENCY_LABELS: Record<RecurringExpenseFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const RECURRING_CREATE_STATUS_LABELS: Record<RecurringExpenseCreateStatus, string> = {
  draft: "Draft",
  posted: "Posted",
};

export const PRICE_TAX_TYPE_LABELS: Record<ExpensePriceTaxType, string> = {
  inclusive: "Inclusive",
  exclusive: "Exclusive",
};

export const EXPENSE_PAYMENT_MODE_OPTIONS = Object.entries(EXPENSE_PAYMENT_MODE_LABELS).map(([value, label]) => ({
  value: value as ExpensePaymentMode,
  label,
}));

export const EXPENSE_STATUS_OPTIONS = Object.entries(EXPENSE_STATUS_LABELS).map(([value, label]) => ({
  value: value as ExpenseStatus,
  label,
}));

export const EXPENSE_CATEGORY_STATUS_OPTIONS = Object.entries(EXPENSE_CATEGORY_STATUS_LABELS).map(([value, label]) => ({
  value: value as ExpenseCategoryStatus,
  label,
}));

export const EXPENSE_GST_RATE_OPTIONS = [0, 0.25, 3, 5, 12, 18, 28].map((value) => ({
  value: value as ExpenseGstRate,
  label: `${value}%`,
}));

export const EXPENSE_CHEQUE_STATUS_OPTIONS = Object.entries(EXPENSE_CHEQUE_STATUS_LABELS).map(([value, label]) => ({
  value: value as ExpenseChequeStatus,
  label,
}));

export const EXPENSE_PRICE_TAX_TYPE_OPTIONS = Object.entries(PRICE_TAX_TYPE_LABELS).map(([value, label]) => ({
  value: value as ExpensePriceTaxType,
  label,
}));

export const RECURRING_FREQUENCY_OPTIONS = Object.entries(RECURRING_FREQUENCY_LABELS).map(([value, label]) => ({
  value: value as RecurringExpenseFrequency,
  label,
}));

export const RECURRING_STATUS_OPTIONS = Object.entries(RECURRING_STATUS_LABELS).map(([value, label]) => ({
  value: value as RecurringExpenseStatus,
  label,
}));

export const RECURRING_CREATE_STATUS_OPTIONS = Object.entries(RECURRING_CREATE_STATUS_LABELS).map(([value, label]) => ({
  value: value as RecurringExpenseCreateStatus,
  label,
}));

export const BANK_LINKED_PAYMENT_MODES = new Set<ExpensePaymentMode>(["bank", "upi", "card", "cheque", "neft", "rtgs", "imps"]);
export const REFERENCE_REQUIRED_PAYMENT_MODES = new Set<ExpensePaymentMode>(["bank", "upi", "card", "neft", "rtgs", "imps"]);
export const DEFAULT_EXPENSE_PAGE_SIZE = 20;
