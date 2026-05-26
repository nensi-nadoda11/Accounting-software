export const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"] as const;
export const ACCOUNT_NORMAL_BALANCES = ["debit", "credit"] as const;
export const ACCOUNT_OPENING_BALANCE_TYPES = ["debit", "credit", "none"] as const;
export const ACCOUNT_STATUSES = ["active", "inactive", "deleted"] as const;
export const JOURNAL_VOUCHER_TYPES = [
  "journal",
  "sales",
  "purchase",
  "receipt",
  "payment",
  "contra",
  "debit_note",
  "credit_note",
  "expense",
  "payroll",
  "opening",
  "adjustment",
  "reversal"
] as const;
export const JOURNAL_STATUSES = ["draft", "posted", "cancelled", "reversed"] as const;
export const JOURNAL_PARTY_TYPES = ["customer", "supplier"] as const;
export const ACCOUNTING_EVENT_STATUSES = ["pending", "posted", "failed", "ignored"] as const;
export const FINANCIAL_LOCK_TYPES = ["month", "quarter", "year"] as const;
export const ACCOUNTING_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const SYSTEM_ACCOUNT_KEYS = [
  "cash",
  "bank",
  "accounts_receivable",
  "inventory",
  "input_gst",
  "advance_to_supplier",
  "accounts_payable",
  "salary_payable",
  "output_gst",
  "loans",
  "advance_from_customer",
  "sales",
  "service_income",
  "discount_received",
  "purchases",
  "salary_expense",
  "rent_expense",
  "electricity_expense",
  "transport_expense",
  "discount_given",
  "round_off_expense",
  "cogs",
  "capital",
  "drawings",
  "retained_earnings"
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type AccountNormalBalance = (typeof ACCOUNT_NORMAL_BALANCES)[number];
export type AccountOpeningBalanceType = (typeof ACCOUNT_OPENING_BALANCE_TYPES)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type JournalVoucherType = (typeof JOURNAL_VOUCHER_TYPES)[number];
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];
export type JournalPartyType = (typeof JOURNAL_PARTY_TYPES)[number];
export type AccountingEventStatus = (typeof ACCOUNTING_EVENT_STATUSES)[number];
export type FinancialLockType = (typeof FINANCIAL_LOCK_TYPES)[number];
export type AccountingExportFormat = (typeof ACCOUNTING_EXPORT_FORMATS)[number];
export type SystemAccountKey = (typeof SYSTEM_ACCOUNT_KEYS)[number];

export type AccountingActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type AccountingRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export const DEFAULT_NORMAL_BALANCE_BY_ACCOUNT_TYPE: Record<AccountType, AccountNormalBalance> = {
  asset: "debit",
  expense: "debit",
  liability: "credit",
  equity: "credit",
  income: "credit"
};

export const JOURNAL_PREFIX_BY_VOUCHER: Record<JournalVoucherType, string> = {
  journal: "JV",
  sales: "SJ",
  purchase: "PJ",
  receipt: "RV",
  payment: "PV",
  contra: "CV",
  debit_note: "DN",
  credit_note: "CN",
  expense: "EX",
  payroll: "PR",
  opening: "OB",
  adjustment: "AD",
  reversal: "RVS"
};
