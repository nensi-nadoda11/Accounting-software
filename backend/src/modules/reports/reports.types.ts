export const REPORT_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export type ReportExportFormat = (typeof REPORT_EXPORT_FORMATS)[number];

export const REPORT_TYPES = [
  "sales.summary",
  "sales.detailed",
  "sales.top-customers",
  "sales.top-products",
  "purchases.summary",
  "purchases.detailed",
  "customers.ledger",
  "customers.outstanding",
  "customers.aging",
  "suppliers.ledger",
  "suppliers.outstanding",
  "suppliers.aging",
  "inventory.current-stock",
  "inventory.valuation",
  "inventory.expiry",
  "inventory.movement",
  "inventory.low-stock",
  "expenses.category-wise",
  "expenses.monthly",
  "expenses.payment-mode",
  "income.summary",
  "income.monthly",
  "payroll.monthly",
  "payroll.employee",
  "payroll.department",
  "gst.summary",
  "gst.hsn",
  "accounting.trial-balance",
  "accounting.profit-loss",
  "accounting.balance-sheet",
  "accounting.cash-book",
  "accounting.bank-book"
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportsActor = {
  id: string;
  companyId: string;
  role: string;
};

export type ReportsRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type ReportFilePayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export type ReportColumn = {
  key: string;
  label: string;
  type?: "string" | "number" | "date" | "datetime";
};

export type ReportExportDataset = {
  title: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null | undefined>>;
};

export type ReportPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ReportQueryBase = {
  dateFrom?: Date;
  dateTo?: Date;
  financialYearId?: string | null;
  customerId?: string;
  supplierId?: string;
  productId?: string;
  categoryId?: string;
  employeeId?: string;
  department?: string;
  paymentMode?: string;
  gstRate?: number;
  status?: string;
  includeDrafts?: boolean;
  includeCancelled?: boolean;
  page?: number;
  limit?: number;
};

export type PaginatedReportQuery = ReportQueryBase & {
  page: number;
  limit: number;
};

export type ExportReportQuery = ReportQueryBase & {
  reportType: ReportType;
  format: ReportExportFormat;
  filters?: Record<string, unknown>;
};

export type ReportOverviewCard = {
  id: string;
  label: string;
  value: string;
};

export type ReportExportRecord = {
  id: string;
  reportType: string;
  exportFormat: ReportExportFormat;
  status: "generated" | "failed";
  fileUrl: string | null;
  generatedBy: string | null;
  createdAt: Date;
  filters: Record<string, unknown>;
};
