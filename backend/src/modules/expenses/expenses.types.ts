export const EXPENSE_CATEGORY_STATUSES = ["active", "inactive", "deleted"] as const;
export const EXPENSE_STATUSES = ["draft", "posted", "approved", "cancelled", "recurring_generated"] as const;
export const EXPENSE_GST_RATES = ["0", "0.25", "3", "5", "12", "18", "28"] as const;
export const EXPENSE_PAYMENT_MODES = ["cash", "bank", "upi", "card", "cheque", "neft", "rtgs", "imps", "other"] as const;
export const EXPENSE_PRICE_TAX_TYPES = ["inclusive", "exclusive"] as const;
export const EXPENSE_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const RECURRING_EXPENSE_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
export const RECURRING_EXPENSE_STATUSES = ["active", "paused", "completed", "cancelled"] as const;
export const RECURRING_EXPENSE_CREATE_STATUSES = ["draft", "posted"] as const;

export type ExpenseCategoryStatus = (typeof EXPENSE_CATEGORY_STATUSES)[number];
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
export type ExpensePaymentMode = (typeof EXPENSE_PAYMENT_MODES)[number];
export type ExpensePriceTaxType = (typeof EXPENSE_PRICE_TAX_TYPES)[number];
export type ExpenseExportFormat = (typeof EXPENSE_EXPORT_FORMATS)[number];
export type RecurringExpenseFrequency = (typeof RECURRING_EXPENSE_FREQUENCIES)[number];
export type RecurringExpenseStatus = (typeof RECURRING_EXPENSE_STATUSES)[number];
export type RecurringExpenseCreateStatus = (typeof RECURRING_EXPENSE_CREATE_STATUSES)[number];

export type ExpenseActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type ExpenseRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type ExpenseMutationPolicy = {
  canPost: boolean;
};

export type ExpenseExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};
