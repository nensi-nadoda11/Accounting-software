export const DASHBOARD_RANGE_TYPES = ["daily", "weekly", "monthly", "custom"] as const;
export const DASHBOARD_CHART_KEYS = ["sales", "purchases", "expenses", "payments"] as const;
export const DASHBOARD_ROLE_KEYS = ["admin", "accountant", "staff", "auditor"] as const;

export type DashboardRangeType = (typeof DASHBOARD_RANGE_TYPES)[number];
export type DashboardChartKey = (typeof DASHBOARD_CHART_KEYS)[number];
export type DashboardRoleKey = (typeof DASHBOARD_ROLE_KEYS)[number];

export type DashboardActor = {
  id: string;
  companyId: string;
  role: DashboardRoleKey;
  permissions: Set<string> | undefined;
};

export type DashboardRequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
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

export type DashboardQuickAction = {
  id: string;
  label: string;
  href: string;
  icon: string;
  permission?: string;
};

export type DashboardAlert = {
  id: string;
  kind: "low_stock" | "expiry" | "customer_due" | "supplier_due" | "payroll" | "gst" | "notification";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  amount?: string;
  dueDate?: string | null;
  actionUrl?: string | null;
  createdAt?: string | null;
};

export type DashboardTask = {
  id: string;
  kind: "draft_invoice" | "pending_payment" | "unpaid_salary" | "gst_pending";
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

export type DashboardRoleDashboard = {
  role: DashboardRoleKey;
  widgets: string[];
  quickActions: DashboardQuickAction[];
  inventorySnapshot: DashboardInventorySnapshot;
  gstSnapshot: DashboardGstSnapshot;
  payrollSnapshot: DashboardPayrollSnapshot;
  accountingSnapshot: DashboardAccountingSnapshot;
};
