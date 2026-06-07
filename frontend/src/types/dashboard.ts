import type { ApiResponse } from "./api";
import type { Role } from "./auth";

export type DashboardRange = "daily" | "weekly" | "monthly" | "custom";
export type DashboardChartKey = "sales" | "purchases" | "expenses" | "payments";
export type DashboardAlertKind = "low_stock" | "expiry" | "customer_due" | "supplier_due" | "payroll" | "gst" | "notification";
export type DashboardAlertSeverity = "info" | "warning" | "critical";
export type DashboardTaskKind = "draft_invoice" | "pending_payment" | "unpaid_salary" | "gst_pending";

export type DashboardFilters = {
  range: DashboardRange;
  dateFrom?: string;
  dateTo?: string;
};

export type DashboardSummary = {
  todaySales: string;
  monthSales: string;
  totalSales: string;
  todayPurchase: string;
  monthPurchase: string;
  receivable: string;
  payable: string;
  cashBalance: string;
  bankBalance: string;
  totalProducts: number;
  lowStockCount: number;
  expiringCount: number;
  monthlyExpense: string;
  netProfit: string;
  gstPayable: string;
  payrollCost: string;
  pendingSalary: string;
};

export type DashboardChartPoint = {
  label: string;
  startDate: string;
  endDate: string;
  value: number;
};

export type DashboardChartResponse = {
  chart: DashboardChartKey;
  range: DashboardRange;
  items: DashboardChartPoint[];
};

export type DashboardQuickAction = {
  id: string;
  label: string;
  href: string;
  icon: string;
  permission?: string;
};

export type DashboardAlert = {
  id: string;
  kind: DashboardAlertKind;
  severity: DashboardAlertSeverity;
  title: string;
  description: string;
  amount?: string;
  dueDate?: string | null;
  actionUrl?: string | null;
  createdAt?: string | null;
};

export type DashboardTask = {
  id: string;
  kind: DashboardTaskKind;
  title: string;
  count: number;
  amount: string;
  href: string;
};

export type DashboardActivity = {
  id: string;
  action: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
  status: "success" | "failed";
  createdAt: string;
  userName: string;
  description: string;
};

export type DashboardTopProduct = {
  productId: string;
  productName: string;
  sku: string;
  quantity: string;
  salesAmount: string;
};

export type DashboardInventorySnapshot = {
  totalProducts: number;
  trackedProducts: number;
  lowStockCount: number;
  expiringCount: number;
  totalStockQuantity: string;
  stockValue: string;
};

export type DashboardGstSnapshot = {
  taxableSales: string;
  outputGst: string;
  inputGst: string;
  netGstPayable: string;
  unclaimedItc: string;
};

export type DashboardPayrollSnapshot = {
  activeEmployees: number;
  payrollCost: string;
  pendingSalary: string;
  unpaidEmployees: number;
};

export type DashboardAccountingSnapshot = {
  cashBalance: string;
  bankBalance: string;
  receivable: string;
  payable: string;
  monthlyExpense: string;
  netProfit: string;
};

export type DashboardLatestCashVerification = {
  id: string;
  verificationNo: string;
  verificationDate: string;
  differenceAmount: string;
  status: "matched" | "short_cash" | "excess_cash";
  recordStatus: "draft" | "completed" | "approved" | "cancelled";
} | null;

export type DashboardRoleDashboard = {
  role: Role;
  widgets: string[];
  quickActions: DashboardQuickAction[];
  inventorySnapshot: DashboardInventorySnapshot;
  gstSnapshot: DashboardGstSnapshot;
  payrollSnapshot: DashboardPayrollSnapshot;
  accountingSnapshot: DashboardAccountingSnapshot;
  latestCashVerification: DashboardLatestCashVerification;
};

export type DashboardRecentActivitiesResponse = {
  items: DashboardActivity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type DashboardTasksResponse = {
  items: DashboardTask[];
};

export type DashboardAlertsResponse = {
  items: DashboardAlert[];
};

export type DashboardTopProductsResponse = {
  items: DashboardTopProduct[];
};

export type DashboardApiResponse<T> = Promise<ApiResponse<T>>;
