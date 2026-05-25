import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  AccountingReport,
  CustomerAgingRow,
  CustomerOutstandingRow,
  ExpenseReport,
  GstReport,
  IncomeMonthlyResponse,
  IncomeSummaryReport,
  InventoryCurrentStockResponse,
  InventoryExpiryResponse,
  InventoryLowStockRow,
  InventoryValuationReportRow,
  PartyLedgerResponse,
  PayrollReport,
  PurchaseDetailedResponse,
  PurchaseSummaryReport,
  ReportDownload,
  ReportExportRecord,
  ReportFilters,
  ReportFormat,
  ReportType,
  ReportsExportsListResponse,
  ReportsOverviewResponse,
  SalesDetailedResponse,
  SalesSummaryReport,
  SalesTopCustomerRow,
  SalesTopProductRow,
  SupplierAgingRow,
  SupplierOutstandingRow,
} from "../types/report";

const getFileNameFromDisposition = (contentDisposition: string | undefined, fallback: string) => {
  if (!contentDisposition) {
    return fallback;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
};

const extractDownload = async (request: Promise<AxiosResponse<Blob>>, fallbackFileName: string): Promise<ReportDownload> => {
  const response = await request;
  return {
    blob: response.data,
    fileName: getFileNameFromDisposition(response.headers["content-disposition"], fallbackFileName),
    contentType:
      typeof response.headers["content-type"] === "string"
        ? response.headers["content-type"]
        : "application/octet-stream",
  };
};

const toBaseParams = (filters: Partial<ReportFilters>) => ({
  dateFrom: filters.dateFrom || undefined,
  dateTo: filters.dateTo || undefined,
  financialYearId: filters.financialYearId || undefined,
  customerId: filters.customerId || undefined,
  supplierId: filters.supplierId || undefined,
  productId: filters.productId || undefined,
  categoryId: filters.categoryId || undefined,
  employeeId: filters.employeeId || undefined,
  department: filters.department || undefined,
  paymentMode: filters.paymentMode || undefined,
  gstRate: filters.gstRate ? Number(filters.gstRate) : undefined,
  status: filters.status || undefined,
});

export const reportsApi = {
  getOverview: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<ReportsOverviewResponse>>("/reports/overview", { params: toBaseParams(filters) })).data,

  listExports: async (limit = 10) =>
    (await client.get<ApiResponse<ReportsExportsListResponse>>("/reports/exports", { params: { limit } })).data,

  getSalesSummary: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<SalesSummaryReport>>("/reports/sales/summary", { params: toBaseParams(filters) })).data,

  getSalesDetailed: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<SalesDetailedResponse>>("/reports/sales/detailed", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getSalesTopCustomers: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: SalesTopCustomerRow[] }>>("/reports/sales/top-customers", {
        params: { ...toBaseParams(filters), limit: filters.limit },
      })
    ).data,

  getSalesTopProducts: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: SalesTopProductRow[] }>>("/reports/sales/top-products", {
        params: { ...toBaseParams(filters), limit: filters.limit },
      })
    ).data,

  getPurchasesSummary: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<PurchaseSummaryReport>>("/reports/purchases/summary", { params: toBaseParams(filters) })).data,

  getPurchasesDetailed: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<PurchaseDetailedResponse>>("/reports/purchases/detailed", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getCustomersLedger: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<PartyLedgerResponse>>("/reports/customers/ledger", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getCustomersOutstanding: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: CustomerOutstandingRow[] }>>("/reports/customers/outstanding", {
        params: toBaseParams(filters),
      })
    ).data,

  getCustomersAging: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: CustomerAgingRow[] }>>("/reports/customers/aging", {
        params: toBaseParams(filters),
      })
    ).data,

  getSuppliersLedger: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<PartyLedgerResponse>>("/reports/suppliers/ledger", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getSuppliersOutstanding: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: SupplierOutstandingRow[] }>>("/reports/suppliers/outstanding", {
        params: toBaseParams(filters),
      })
    ).data,

  getSuppliersAging: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: SupplierAgingRow[] }>>("/reports/suppliers/aging", {
        params: toBaseParams(filters),
      })
    ).data,

  getInventoryCurrentStock: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<InventoryCurrentStockResponse>>("/reports/inventory/current-stock", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getInventoryValuation: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: InventoryValuationReportRow[] }>>("/reports/inventory/valuation", {
        params: toBaseParams(filters),
      })
    ).data,

  getInventoryExpiry: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<InventoryExpiryResponse>>("/reports/inventory/expiry", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getInventoryMovement: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: Array<Record<string, unknown>>; pagination: InventoryCurrentStockResponse["pagination"] }>>("/reports/inventory/movement", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getInventoryLowStock: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: InventoryLowStockRow[] }>>("/reports/inventory/low-stock", {
        params: toBaseParams(filters),
      })
    ).data,

  getExpenseCategoryWise: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<ExpenseReport["categoryWise"]>>("/reports/expenses/category-wise", { params: toBaseParams(filters) })).data,

  getExpenseMonthly: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<ExpenseReport["monthly"]>>("/reports/expenses/monthly", { params: toBaseParams(filters) })).data,

  getExpensePaymentMode: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<ExpenseReport["paymentMode"]>>("/reports/expenses/payment-mode", { params: toBaseParams(filters) })).data,

  getIncomeSummary: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<IncomeSummaryReport>>("/reports/income/summary", { params: toBaseParams(filters) })).data,

  getIncomeMonthly: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<IncomeMonthlyResponse>>("/reports/income/monthly", { params: toBaseParams(filters) })).data,

  getPayrollMonthly: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: PayrollReport["monthly"] }>>("/reports/payroll/monthly", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getPayrollEmployee: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: PayrollReport["employee"] }>>("/reports/payroll/employee", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getPayrollDepartment: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<{ items: PayrollReport["department"] }>>("/reports/payroll/department", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getGstSummary: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<GstReport["summary"]>>("/reports/gst/summary", { params: toBaseParams(filters) })).data,

  getGstHsn: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<{ items: GstReport["hsn"] }>>("/reports/gst/hsn", { params: toBaseParams(filters) })).data,

  getTrialBalance: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<AccountingReport["trialBalance"]>>("/reports/accounting/trial-balance", { params: toBaseParams(filters) })).data,

  getProfitLoss: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<AccountingReport["profitLoss"]>>("/reports/accounting/profit-loss", { params: toBaseParams(filters) })).data,

  getBalanceSheet: async (filters: Partial<ReportFilters>) =>
    (await client.get<ApiResponse<AccountingReport["balanceSheet"]>>("/reports/accounting/balance-sheet", { params: toBaseParams(filters) })).data,

  getCashBook: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<AccountingReport["cashBook"]>>("/reports/accounting/cash-book", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  getBankBook: async (filters: Partial<ReportFilters>) =>
    (
      await client.get<ApiResponse<AccountingReport["bankBook"]>>("/reports/accounting/bank-book", {
        params: { ...toBaseParams(filters), page: filters.page, limit: filters.limit },
      })
    ).data,

  exportReport: async (reportType: ReportType, format: ReportFormat, filters: Partial<ReportFilters>, payload?: Record<string, unknown>) =>
    extractDownload(
      client.get("/reports/export", {
        responseType: "blob",
        params: {
          ...toBaseParams(filters),
          page: filters.page,
          limit: filters.limit,
          reportType,
          format,
          filters: payload ? JSON.stringify(payload) : undefined,
        },
      }),
      `${reportType.replaceAll(".", "-")}.${format}`,
    ),

  toExportPayload: (filters: Partial<ReportFilters>) =>
    Object.fromEntries(Object.entries(toBaseParams(filters)).filter(([, value]) => value !== undefined)) as Record<string, unknown>,

  flattenRecentExports: (response: ApiResponse<ReportsExportsListResponse>) => response.data.items as ReportExportRecord[],
};
