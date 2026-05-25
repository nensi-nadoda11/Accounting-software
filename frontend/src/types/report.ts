import type {
  BalanceSheetReport,
  LedgerResponse,
  ProfitLossReport,
  TrialBalanceResponse,
} from "./accounting";
import type {
  CategoryWiseExpenseReportResponse,
  MonthlyExpenseReportResponse,
  PaymentModeExpenseReportResponse,
} from "./expense";
import type { GstSummary, HsnSacSummaryRow } from "./gst";
import type { InventoryPagination, StockMovement } from "./inventory";
import type {
  DepartmentPayrollReportItem,
  EmployeePayrollReportItem,
  MonthlyPayrollReportItem,
  PaginationMeta,
} from "./payroll";

export type ReportsTabId =
  | "overview"
  | "sales"
  | "purchases"
  | "customers"
  | "suppliers"
  | "inventory"
  | "expenses"
  | "income"
  | "payroll"
  | "gst"
  | "accounting";

export type ReportFormat = "csv" | "xlsx" | "pdf";

export type ReportType =
  | "sales.summary"
  | "sales.detailed"
  | "sales.top-customers"
  | "sales.top-products"
  | "purchases.summary"
  | "purchases.detailed"
  | "customers.ledger"
  | "customers.outstanding"
  | "customers.aging"
  | "suppliers.ledger"
  | "suppliers.outstanding"
  | "suppliers.aging"
  | "inventory.current-stock"
  | "inventory.valuation"
  | "inventory.expiry"
  | "inventory.movement"
  | "inventory.low-stock"
  | "expenses.category-wise"
  | "expenses.monthly"
  | "expenses.payment-mode"
  | "income.summary"
  | "income.monthly"
  | "payroll.monthly"
  | "payroll.employee"
  | "payroll.department"
  | "gst.summary"
  | "gst.hsn"
  | "accounting.trial-balance"
  | "accounting.profit-loss"
  | "accounting.balance-sheet"
  | "accounting.cash-book"
  | "accounting.bank-book";

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  financialYearId: string;
  customerId: string;
  supplierId: string;
  productId: string;
  categoryId: string;
  employeeId: string;
  department: string;
  paymentMode: string;
  gstRate: string;
  status: string;
  page: number;
  limit: number;
}

export interface ReportExportRecord {
  id: string;
  reportType: string;
  exportFormat: ReportFormat;
  status: "generated" | "failed";
  fileUrl: string | null;
  generatedBy: string | null;
  createdAt: string;
  filters: Record<string, unknown>;
}

export interface ReportOverviewCard {
  id: string;
  label: string;
  value: string;
}

export interface ReportsOverviewResponse {
  summaryCards: ReportOverviewCard[];
  recentExports: ReportExportRecord[];
}

export interface SalesSummaryReport {
  invoiceCount: number;
  grossSales: string;
  taxableSales: string;
  gstAmount: string;
  collectedAmount: string;
  outstandingAmount: string;
  averageInvoiceValue: string;
}

export interface SalesDetailedRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerId: string | null;
  customerName: string;
  invoiceStatus: string;
  paymentStatus: string;
  paymentMode: string | null;
  taxableAmount: string;
  gstTotal: string;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
}

export interface SalesTopCustomerRow {
  customerId: string | null;
  customerName: string;
  invoiceCount: number;
  totalSales: string;
  collectedAmount: string;
  outstandingAmount: string;
}

export interface SalesTopProductRow {
  productId: string;
  productName: string;
  sku: string;
  quantitySold: string;
  returnedQuantity: string;
  netSales: string;
  invoiceCount: number;
}

export interface SalesDetailedResponse {
  items: SalesDetailedRow[];
  totals: {
    taxableAmount: string;
    gstTotal: string;
    grandTotal: string;
    paidAmount: string;
    dueAmount: string;
  };
  pagination: PaginationMeta;
}

export interface PurchaseSummaryReport {
  invoiceCount: number;
  grossPurchases: string;
  taxablePurchases: string;
  gstAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  averageInvoiceValue: string;
}

export interface PurchaseDetailedRow {
  id: string;
  purchaseNumber: string;
  invoiceDate: string;
  supplierId: string;
  supplierName: string;
  purchaseStatus: string;
  paymentStatus: string;
  paymentMode: string | null;
  taxableAmount: string;
  gstTotal: string;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
}

export interface PurchaseDetailedResponse {
  items: PurchaseDetailedRow[];
  totals: {
    taxableAmount: string;
    gstTotal: string;
    grandTotal: string;
    paidAmount: string;
    dueAmount: string;
  };
  pagination: PaginationMeta;
}

export interface PartyLedgerRow {
  date: string;
  transactionType: string;
  referenceNo: string | null;
  description: string;
  debit: string;
  credit: string;
  paymentMode: string | null;
  remarks: string | null;
}

export interface PartyLedgerResponse {
  customer?: { id: string; name: string; customerCode: string };
  supplier?: { id: string; name: string; supplierCode: string };
  items: PartyLedgerRow[];
  pagination: PaginationMeta;
}

export interface CustomerOutstandingRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  mobile: string;
  status: string;
  outstandingAmount: string;
  overdueAmount: string;
  invoiceCount: number;
}

export interface CustomerAgingRow {
  customerId: string;
  customerCode: string;
  customerName: string;
  bucket0To30: string;
  bucket31To60: string;
  bucket61To90: string;
  bucketAbove90: string;
  totalOutstanding: string;
}

export interface SupplierOutstandingRow {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  mobile: string;
  status: string;
  outstandingAmount: string;
  overdueAmount: string;
  invoiceCount: number;
}

export interface SupplierAgingRow {
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  bucket0To30: string;
  bucket31To60: string;
  bucket61To90: string;
  bucketAbove90: string;
  totalOutstanding: string;
}

export interface InventoryCurrentStockRow {
  balance: {
    availableQuantity: string;
    reservedQuantity: string;
    damagedQuantity: string;
    expiredQuantity: string;
    averageCost: string;
    stockValue: string;
    updatedAt: string;
  };
  product: {
    id: string;
    productCode: string;
    name: string;
    sku: string;
    minimumStockLevel: string;
    reorderLevel: string;
  };
  categoryName: string | null;
  unitName: string | null;
  unitSymbol: string | null;
  warehouseName: string;
  warehouseCode: string;
  batchNumber: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  batchStatus: string | null;
}

export interface InventoryCurrentStockResponse {
  items: InventoryCurrentStockRow[];
  pagination: InventoryPagination;
}

export interface InventoryExpiryRow {
  batchId: string;
  batchNumber: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseName: string;
  expiryDate: string;
  availableQuantity: string;
  stockValue: string;
  batchStatus: string;
}

export interface InventoryExpiryResponse {
  items: InventoryExpiryRow[];
  pagination: InventoryPagination;
}

export interface InventoryLowStockRow {
  productId: string;
  productCode: string;
  productName: string;
  sku: string;
  categoryName: string | null;
  minimumStockLevel: string;
  reorderLevel: string;
  availableQuantity: string;
  stockValue: string;
}

export interface InventoryValuationReportRow {
  productId: string;
  productCode: string;
  productName: string;
  sku: string | null;
  categoryName: string | null;
  unitName: string | null;
  unitSymbol: string | null;
  totalQuantity: string;
  totalValue: string;
}

export interface IncomeSummaryReport {
  accountCount: number;
  totalCredits: string;
  totalDebits: string;
  netIncome: string;
}

export interface IncomeMonthlyRow {
  month: string;
  totalCredits: string;
  totalDebits: string;
  netIncome: string;
}

export interface IncomeMonthlyResponse {
  items: IncomeMonthlyRow[];
}

export interface PayrollReport {
  monthly: MonthlyPayrollReportItem[];
  employee: EmployeePayrollReportItem[];
  department: DepartmentPayrollReportItem[];
}

export interface GstReport {
  summary: GstSummary;
  hsn: HsnSacSummaryRow[];
}

export interface AccountingReport {
  trialBalance: TrialBalanceResponse;
  profitLoss: ProfitLossReport;
  balanceSheet: BalanceSheetReport;
  cashBook: LedgerResponse;
  bankBook: LedgerResponse;
}

export type ReportDownload = {
  blob: Blob;
  fileName: string;
  contentType: string;
};

export interface ReportsExportsListResponse {
  items: ReportExportRecord[];
}

export interface InventoryReport {
  currentStock: InventoryCurrentStockResponse;
  valuation: InventoryValuationReportRow[];
  expiry: InventoryExpiryResponse;
  movement: StockMovement[];
  lowStock: InventoryLowStockRow[];
}

export interface ExpenseReport {
  categoryWise: CategoryWiseExpenseReportResponse;
  monthly: MonthlyExpenseReportResponse;
  paymentMode: PaymentModeExpenseReportResponse;
}
