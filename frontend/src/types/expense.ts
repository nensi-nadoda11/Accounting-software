export const EXPENSE_STATUSES = ["draft", "posted", "approved", "cancelled", "recurring_generated"] as const;
export const EXPENSE_PAYMENT_MODES = ["cash", "bank", "upi", "card", "cheque", "neft", "rtgs", "imps", "other"] as const;
export const EXPENSE_PRICE_TAX_TYPES = ["inclusive", "exclusive"] as const;
export const EXPENSE_CATEGORY_STATUSES = ["active", "inactive", "deleted"] as const;
export const EXPENSE_GST_RATES = [0, 0.25, 3, 5, 12, 18, 28] as const;
export const EXPENSE_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const RECURRING_EXPENSE_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "yearly"] as const;
export const RECURRING_EXPENSE_STATUSES = ["active", "paused", "completed", "cancelled"] as const;
export const RECURRING_EXPENSE_CREATE_STATUSES = ["draft", "posted"] as const;
export const EXPENSE_CHEQUE_STATUSES = ["issued", "deposited", "cleared", "bounced", "cancelled"] as const;

export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];
export type ExpensePaymentMode = (typeof EXPENSE_PAYMENT_MODES)[number];
export type ExpensePriceTaxType = (typeof EXPENSE_PRICE_TAX_TYPES)[number];
export type ExpenseCategoryStatus = (typeof EXPENSE_CATEGORY_STATUSES)[number];
export type ExpenseGstRate = (typeof EXPENSE_GST_RATES)[number];
export type ExpenseExportFormat = (typeof EXPENSE_EXPORT_FORMATS)[number];
export type RecurringExpenseFrequency = (typeof RECURRING_EXPENSE_FREQUENCIES)[number];
export type RecurringExpenseStatus = (typeof RECURRING_EXPENSE_STATUSES)[number];
export type RecurringExpenseCreateStatus = (typeof RECURRING_EXPENSE_CREATE_STATUSES)[number];
export type ExpenseChequeStatus = (typeof EXPENSE_CHEQUE_STATUSES)[number];

export interface ExpensePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ExpenseDownloadResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}

export interface ExpenseCategoryAccountRef {
  id: string;
  accountCode: string;
  accountName: string;
}

export interface ExpenseCategory {
  id: string;
  categoryCode: string;
  name: string;
  parentId: string | null;
  defaultAccountId: string | null;
  color: string | null;
  icon: string | null;
  description: string | null;
  status: ExpenseCategoryStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  defaultAccount: ExpenseCategoryAccountRef | null;
}

export interface ExpenseCategoryListResponse {
  items: ExpenseCategory[];
}

export interface ExpenseAttachment {
  id: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

export interface ExpenseSummaryTotals {
  amount: string;
  taxableAmount: string;
  gstAmount: string;
  totalAmount: string;
}

export interface ExpenseListItem {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  description: string;
  payeeName: string | null;
  paymentMode: ExpensePaymentMode;
  status: ExpenseStatus;
  amount: string;
  gstAmount: string;
  totalAmount: string;
  category: {
    id: string;
    name: string;
    categoryCode: string;
  };
  account: ExpenseCategoryAccountRef | null;
}

export interface ExpenseListResponse {
  items: ExpenseListItem[];
  summary: ExpenseSummaryTotals;
  pagination: ExpensePagination;
}

export interface ExpenseBankAccountRef {
  id: string;
  bankName: string;
  accountNumber: string;
  upiId: string | null;
}

export interface Expense {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  categoryId: string;
  expenseAccountId: string | null;
  payeeName: string | null;
  vendorGstNumber: string | null;
  vendorPanNumber: string | null;
  hsnSacCode: string | null;
  description: string;
  amount: string;
  gstApplicable: boolean;
  gstRate: string;
  priceTaxType: ExpensePriceTaxType;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  gstAmount: string;
  totalAmount: string;
  paymentMode: ExpensePaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  chequeNumber: string | null;
  chequeDate: string | null;
  chequeStatus: ExpenseChequeStatus | null;
  status: ExpenseStatus;
  recurringExpenseId: string | null;
  accountingEventCreated: boolean;
  postedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    categoryCode: string;
    name: string;
    status: ExpenseCategoryStatus;
  };
  account: ExpenseCategoryAccountRef | null;
  bankAccount: ExpenseBankAccountRef | null;
  attachments: ExpenseAttachment[];
}

export interface ExpenseDetailResponse {
  expense: Expense;
}

export interface ExpenseFiltersQuery {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  paymentMode?: ExpensePaymentMode | "";
  status?: ExpenseStatus | "";
  gstApplicable?: boolean;
  dateFrom?: string;
  dateTo?: string;
  recurringExpenseId?: string;
}

export interface ExpenseCategoryFiltersQuery {
  search?: string;
  status?: ExpenseCategoryStatus | "";
  parentId?: string;
}

export interface ExpenseReportFiltersQuery {
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  paymentMode?: ExpensePaymentMode | "";
  includeDrafts?: boolean;
}

export interface ExpenseFormInput {
  expenseDate: string;
  categoryId: string;
  expenseAccountId: string | null;
  payeeName: string | null;
  vendorGstNumber: string | null;
  vendorPanNumber: string | null;
  hsnSacCode: string | null;
  description: string;
  amount: number;
  gstApplicable: boolean;
  gstRate: ExpenseGstRate;
  priceTaxType: ExpensePriceTaxType;
  paymentMode: ExpensePaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  chequeNumber: string | null;
  chequeDate: string | null;
  chequeStatus: ExpenseChequeStatus | null;
  notes: string | null;
  status?: Extract<ExpenseStatus, "draft" | "posted">;
}

export type UpdateExpenseInput = Partial<ExpenseFormInput>;

export interface CancelExpenseInput {
  cancellationReason: string;
}

export interface CreateExpenseCategoryInput {
  name: string;
  parentId: string | null;
  defaultAccountId: string | null;
  color: string | null;
  icon: string | null;
  description: string | null;
  status?: Extract<ExpenseCategoryStatus, "active" | "inactive">;
}

export type UpdateExpenseCategoryInput = Partial<CreateExpenseCategoryInput>;

export interface RecurringExpense {
  id: string;
  templateName: string;
  categoryId: string;
  expenseAccountId: string | null;
  payeeName: string | null;
  description: string;
  amount: string;
  gstApplicable: boolean;
  gstRate: string;
  priceTaxType: ExpensePriceTaxType;
  paymentMode: ExpensePaymentMode;
  bankAccountId: string | null;
  frequency: RecurringExpenseFrequency;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  autoCreateEnabled: boolean;
  createAsStatus: RecurringExpenseCreateStatus;
  reminderDaysBefore: number;
  lastRunAt: string | null;
  status: RecurringExpenseStatus;
  categoryName: string | null;
  accountName: string | null;
}

export interface RecurringExpenseListResponse {
  items: RecurringExpense[];
  pagination: ExpensePagination;
}

export interface RecurringExpenseFiltersQuery {
  page: number;
  limit: number;
  search?: string;
  status?: RecurringExpenseStatus | "";
  frequency?: RecurringExpenseFrequency | "";
  dateFrom?: string;
  dateTo?: string;
}

export interface RecurringExpenseFormInput {
  templateName: string;
  categoryId: string;
  expenseAccountId: string | null;
  payeeName: string | null;
  description: string;
  amount: number;
  gstApplicable: boolean;
  gstRate: ExpenseGstRate;
  priceTaxType: ExpensePriceTaxType;
  paymentMode: ExpensePaymentMode;
  bankAccountId: string | null;
  frequency: RecurringExpenseFrequency;
  startDate: string;
  endDate: string | null;
  nextRunDate: string;
  autoCreateEnabled: boolean;
  createAsStatus: RecurringExpenseCreateStatus;
  reminderDaysBefore: number;
  status?: RecurringExpenseStatus;
}

export type UpdateRecurringExpenseInput = Partial<RecurringExpenseFormInput>;

export interface CategoryWiseExpenseReportRow {
  categoryId: string;
  categoryName: string;
  expenseCount: number;
  taxableAmount: string;
  gstAmount: string;
  totalAmount: string;
}

export interface MonthlyExpenseReportRow {
  month: string;
  expenseCount: number;
  taxableAmount: string;
  gstAmount: string;
  totalAmount: string;
}

export interface PaymentModeExpenseReportRow {
  paymentMode: ExpensePaymentMode;
  expenseCount: number;
  totalAmount: string;
}

export interface GstExpenseReportRow {
  gstApplicable: boolean;
  gstRate: string;
  expenseCount: number;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  gstAmount: string;
  totalAmount: string;
}

export interface CategoryWiseExpenseReportResponse {
  items: CategoryWiseExpenseReportRow[];
}

export interface MonthlyExpenseReportResponse {
  items: MonthlyExpenseReportRow[];
}

export interface PaymentModeExpenseReportResponse {
  items: PaymentModeExpenseReportRow[];
}

export interface GstExpenseReportResponse {
  items: GstExpenseReportRow[];
}

export interface ExpenseAttachmentUploadResponse {
  attachments: ExpenseAttachment[];
}
