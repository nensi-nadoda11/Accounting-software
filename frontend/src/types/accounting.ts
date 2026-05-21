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
  "reversal",
] as const;
export const JOURNAL_STATUSES = ["draft", "posted", "cancelled", "reversed"] as const;
export const JOURNAL_PARTY_TYPES = ["customer", "supplier"] as const;
export const ACCOUNTING_EVENT_STATUSES = ["pending", "posted", "failed", "ignored"] as const;
export const FINANCIAL_LOCK_TYPES = ["month", "quarter", "year"] as const;
export const ACCOUNTING_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;

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

export interface DownloadFileResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BalanceAmount {
  amount: string;
  side: AccountNormalBalance;
}

export interface Account {
  id: string;
  companyId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  accountSubtype: string | null;
  parentId: string | null;
  isSystem: boolean;
  systemKey: string | null;
  normalBalance: AccountNormalBalance;
  openingBalance: string;
  openingBalanceType: AccountOpeningBalanceType;
  currentBalance: string;
  currentBalanceSide: AccountNormalBalance;
  status: AccountStatus;
  description: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  children?: Account[];
}

export interface AccountsResponse {
  items: Account[];
  pagination: PaginationMeta;
}

export interface OpeningBalance {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  financialYearId: string | null;
  openingDate: string;
  debit: string;
  credit: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpeningBalanceListResponse {
  items: OpeningBalance[];
  pagination: PaginationMeta;
}

export interface JournalLine {
  id?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  lineNumber?: number;
  description: string | null;
  debit: string;
  credit: string;
  balanceAfter: BalanceAmount | null;
  partyType: JournalPartyType | null;
  partyId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt?: string;
}

export interface JournalEntrySummary {
  id: string;
  journalNumber: string;
  entryDate: string;
  voucherType: JournalVoucherType;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  description: string;
  status: JournalStatus;
  totalDebit: string;
  totalCredit: string;
  postedAt: string | null;
  cancelledAt: string | null;
  reversedFromId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry extends JournalEntrySummary {
  companyId: string;
  financialYearId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  lines: JournalLine[];
}

export interface JournalsResponse {
  items: JournalEntrySummary[];
  pagination: PaginationMeta;
}

export interface JournalDetailResponse {
  journal: JournalEntry;
}

export interface LedgerRow {
  journalId: string;
  journalNumber: string;
  entryDate: string;
  createdAt: string;
  lineNumber: number;
  voucherType: JournalVoucherType;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  description: string | null;
  debit: string;
  credit: string;
  runningBalance: BalanceAmount;
}

export interface LedgerResponse {
  label: string;
  openingBalance: BalanceAmount;
  rows: LedgerRow[];
  closingBalance: BalanceAmount;
  pagination: PaginationMeta;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: AccountNormalBalance;
  openingBalance: BalanceAmount;
  periodDebit: string;
  periodCredit: string;
  closingBalance: BalanceAmount;
  debit: string;
  credit: string;
}

export interface TrialBalanceResponse {
  dateFrom: string;
  dateTo: string;
  items: TrialBalanceRow[];
  totals: {
    debit: string;
    credit: string;
    isBalanced: boolean;
    imbalance: string;
  };
}

export interface ProfitLossRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: Extract<AccountType, "income" | "expense">;
  amount: string;
}

export interface ProfitLossReport {
  dateFrom: string;
  dateTo: string;
  items: ProfitLossRow[];
  totals: {
    totalIncome: string;
    totalExpense: string;
    netProfitLoss: string;
  };
}

export interface BalanceSheetRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: string;
  side: AccountNormalBalance;
}

export interface BalanceSheetReport {
  asOfDate: string;
  financialYearId: string | null;
  assets: BalanceSheetRow[];
  liabilities: BalanceSheetRow[];
  equity: BalanceSheetRow[];
  totals: {
    assets: string;
    liabilities: string;
    equity: string;
    currentProfitLoss: string;
    rightSide: string;
    isBalanced: boolean;
    imbalance: string;
  };
}

export interface AccountingEvent {
  id: string;
  companyId: string;
  eventType: string;
  referenceType: string;
  referenceId: string;
  payload: Record<string, unknown>;
  status: AccountingEventStatus;
  errorMessage: string | null;
  journalEntryId: string | null;
  createdAt: string;
  postedAt: string | null;
}

export interface AccountingEventsResponse {
  items: AccountingEvent[];
  pagination: PaginationMeta;
}

export interface PostPendingEventsResult {
  total: number;
  posted: number;
  failed: number;
  ignored: number;
}

export interface PeriodLock {
  id: string;
  companyId: string;
  financialYearId: string | null;
  periodStart: string;
  periodEnd: string;
  lockType: FinancialLockType;
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: string;
  reason: string | null;
  createdAt: string;
}

export interface PeriodLocksResponse {
  items: PeriodLock[];
}

export interface ListAccountsQuery {
  page: number;
  limit: number;
  search?: string;
  type?: AccountType | "";
  status?: AccountStatus | "";
  parentId?: string;
  hierarchy?: boolean;
}

export interface CreateAccountInput {
  accountCode?: string | null;
  accountName: string;
  accountType: AccountType;
  accountSubtype?: string | null;
  parentId?: string | null;
  openingBalance?: number;
  openingBalanceType?: AccountOpeningBalanceType;
  description?: string | null;
}

export interface UpdateAccountInput {
  accountName?: string;
  accountSubtype?: string | null;
  parentId?: string | null;
  status?: Extract<AccountStatus, "active" | "inactive">;
  description?: string | null;
}

export interface ListOpeningBalancesQuery {
  page: number;
  limit: number;
  accountId?: string;
  financialYearId?: string;
  dateFrom?: string;
  dateTo?: string;
  isLocked?: boolean;
}

export interface OpeningBalanceEntryInput {
  accountId: string;
  debit?: number;
  credit?: number;
  description?: string | null;
}

export interface CreateOpeningBalancesInput {
  openingDate: string;
  financialYearId?: string | null;
  description?: string | null;
  entries: OpeningBalanceEntryInput[];
}

export interface UpdateOpeningBalanceInput {
  openingDate?: string;
  debit?: number;
  credit?: number;
  description?: string | null;
}

export interface CreateJournalLineInput {
  accountId: string;
  description?: string | null;
  debit?: number;
  credit?: number;
  partyType?: JournalPartyType | null;
  partyId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}

export interface CreateJournalInput {
  financialYearId?: string | null;
  journalNumber?: string | null;
  entryDate: string;
  voucherType: JournalVoucherType;
  referenceType?: string | null;
  referenceId?: string | null;
  referenceNumber?: string | null;
  description: string;
  status?: "draft" | "posted";
  lines: CreateJournalLineInput[];
}

export interface UpdateJournalInput {
  financialYearId?: string | null;
  entryDate?: string;
  voucherType?: JournalVoucherType;
  referenceType?: string | null;
  referenceId?: string | null;
  referenceNumber?: string | null;
  description?: string;
  lines?: CreateJournalLineInput[];
}

export interface ListJournalsQuery {
  page: number;
  limit: number;
  search?: string;
  voucherType?: JournalVoucherType | "";
  status?: JournalStatus | "";
  referenceType?: string;
  financialYearId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PostJournalInput {
  entryDate?: string;
}

export interface CancelOrReverseJournalInput {
  reason: string;
  reversalDate?: string | null;
}

export interface LedgerQuery {
  page: number;
  limit: number;
  dateFrom: string;
  dateTo: string;
}

export interface BookQuery extends LedgerQuery {
  bankAccountId?: string;
}

export interface TrialBalanceQuery {
  financialYearId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type ProfitLossQuery = TrialBalanceQuery;

export interface BalanceSheetQuery {
  asOfDate?: string;
  financialYearId?: string;
}

export interface ListAccountingEventsQuery {
  page: number;
  limit: number;
  status?: AccountingEventStatus | "";
  eventType?: string;
  referenceType?: string;
}

export interface ListFinancialPeriodLocksQuery {
  financialYearId?: string;
  isLocked?: boolean;
}

export interface CreateFinancialPeriodLockInput {
  financialYearId?: string | null;
  periodStart: string;
  periodEnd: string;
  lockType: FinancialLockType;
  reason?: string | null;
}
