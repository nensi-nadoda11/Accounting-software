import { auditLogService } from "../audit-logs/audit-log.service";
import { AppError } from "../../utils/app-error";
import { dashboardRepository } from "./dashboard.repository";
import type {
  DashboardAccountingSnapshot,
  DashboardActor,
  DashboardAlert,
  DashboardChartKey,
  DashboardChartPoint,
  DashboardInventorySnapshot,
  DashboardPayrollSnapshot,
  DashboardQuickAction,
  DashboardRequestContext,
  DashboardRoleDashboard,
  DashboardSummary,
  DashboardTask,
  DashboardTopProduct
} from "./dashboard.types";
import type {
  DashboardDateRangeQuery,
  DashboardRecentActivitiesQuery,
  DashboardTopProductsQuery
} from "./dashboard.validator";

type Bounds = {
  start: Date;
  end: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const clampMoney = (value: string | null | undefined) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return "0.00";
  }

  return parsed.toFixed(2);
};

const clampCount = (value: number | null | undefined) => {
  if (!Number.isFinite(value ?? NaN) || (value ?? 0) < 0) {
    return 0;
  }

  return Number(value);
};

const startOfDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const endOfDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
const startOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const endOfMonth = (date: Date) => endOfDay(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const formatAction = (action: string, entityType: string | null) => {
  const normalized = action.replaceAll("_", " ").trim();
  if (!normalized) {
    return entityType ? `Updated ${entityType}` : "Updated record";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getMonthBounds = (anchor: Date): Bounds => ({
  start: startOfMonth(anchor),
  end: endOfMonth(anchor)
});

const getTodayBounds = (anchor: Date): Bounds => ({
  start: startOfDay(anchor),
  end: endOfDay(anchor)
});

const getRangeBounds = (query: DashboardDateRangeQuery): { range: Bounds; bucket: "day" | "week" | "month" } => {
  const today = startOfDay(new Date());

  switch (query.range) {
    case "daily":
      return { range: { start: addDays(today, -6), end: endOfDay(today) }, bucket: "day" };
    case "weekly":
      return { range: { start: addDays(today, -55), end: endOfDay(today) }, bucket: "week" };
    case "monthly":
      return { range: { start: addDays(today, -330), end: endOfDay(today) }, bucket: "month" };
    case "custom": {
      const start = startOfDay(query.dateFrom!);
      const end = endOfDay(query.dateTo!);
      const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
      const bucket = diffDays <= 31 ? "day" : diffDays <= 120 ? "week" : "month";
      return { range: { start, end }, bucket };
    }
  }
};

export class DashboardService {
  private async logView(
    actor: DashboardActor,
    action: string,
    context: DashboardRequestContext,
    metadata?: Record<string, unknown>
  ) {
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action,
      module: "dashboard",
      entityType: "dashboard",
      entityId: actor.companyId,
      metadata: metadata ?? null,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  private ensureAccess(actor: DashboardActor) {
    if (!actor.permissions?.has("dashboard.view")) {
      throw new AppError("You do not have access to this resource", 403);
    }
  }

  public async getSummary(actor: DashboardActor, context: DashboardRequestContext): Promise<DashboardSummary> {
    this.ensureAccess(actor);

    const today = getTodayBounds(new Date());
    const month = getMonthBounds(new Date());
    const data = await dashboardRepository.getSummary(actor.companyId, today, month);

    await this.logView(actor, "dashboard_summary_viewed", context);

    return {
      todaySales: clampMoney(data.salesTotals?.todaySales),
      monthSales: clampMoney(data.salesTotals?.monthSales),
      totalSales: clampMoney(data.salesTotals?.totalSales),
      todayPurchase: clampMoney(data.purchaseTotals?.todayPurchase),
      monthPurchase: clampMoney(data.purchaseTotals?.monthPurchase),
      receivable: clampMoney(data.salesTotals?.receivable),
      payable: clampMoney(data.purchaseTotals?.payable),
      cashBalance: clampMoney(data.accountBalances?.cashBalance),
      bankBalance: clampMoney(data.accountBalances?.bankBalance),
      totalProducts: clampCount(data.productTotals?.totalProducts),
      lowStockCount: clampCount(data.productTotals?.lowStockCount),
      expiringCount: clampCount(data.productTotals?.expiringCount),
      monthlyExpense: clampMoney(data.expenseTotals?.monthlyExpense),
      netProfit: clampMoney(data.accountBalances?.netProfit),
      gstPayable: clampMoney(data.gstTotals?.gstPayable),
      payrollCost: clampMoney(data.payrollTotals?.payrollCost),
      pendingSalary: clampMoney(data.payrollTotals?.pendingSalary)
    };
  }

  public async getChart(
    actor: DashboardActor,
    chartKey: DashboardChartKey,
    query: DashboardDateRangeQuery,
    context: DashboardRequestContext
  ) {
    this.ensureAccess(actor);

    const { range, bucket } = getRangeBounds(query);
    const rows = await dashboardRepository.getChart(actor.companyId, chartKey, { ...range, bucket });
    const items: DashboardChartPoint[] = rows.map((row) => {
      const startDate = new Date(row.bucketStart);
      const endDate =
        bucket === "day" ? endOfDay(startDate) : bucket === "week" ? endOfDay(addDays(startDate, 6)) : endOfMonth(startDate);

      return {
        label: bucket === "month" ? startDate.toISOString().slice(0, 7) : toIsoDate(startDate),
        startDate: toIsoDate(startDate),
        endDate: toIsoDate(endDate),
        value: Number(clampMoney(row.value))
      };
    });

    await this.logView(actor, "dashboard_chart_viewed", context, { chartKey, range: query.range });

    return {
      chart: chartKey,
      range: query.range,
      items
    };
  }

  public async getTopProducts(
    actor: DashboardActor,
    query: DashboardTopProductsQuery,
    context: DashboardRequestContext
  ): Promise<{ items: DashboardTopProduct[] }> {
    this.ensureAccess(actor);

    const { range } = getRangeBounds(query);
    const rows = await dashboardRepository.getTopProducts(actor.companyId, range, query.limit);

    await this.logView(actor, "dashboard_top_products_viewed", context, { range: query.range, limit: query.limit });

    return {
      items: rows.map((row) => ({
        productId: row.productId,
        productName: row.productName,
        sku: row.sku,
        quantity: clampMoney(row.quantity),
        salesAmount: clampMoney(row.salesAmount)
      }))
    };
  }

  public async getRecentActivities(
    actor: DashboardActor,
    query: DashboardRecentActivitiesQuery,
    context: DashboardRequestContext
  ) {
    this.ensureAccess(actor);

    const data = await dashboardRepository.listRecentActivities(actor.companyId, query.page, query.limit);

    await this.logView(actor, "dashboard_recent_activities_viewed", context, { page: query.page, limit: query.limit });

    return {
      items: data.rows.map((row) => ({
        id: row.id,
        action: row.action,
        module: row.module,
        entityType: row.entityType,
        entityId: row.entityId,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        userName: row.userNameSnapshot ?? "System",
        description: formatAction(row.action, row.entityType)
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total: data.total,
        totalPages: Math.max(1, Math.ceil(data.total / query.limit))
      }
    };
  }

  public async getAlerts(actor: DashboardActor, context: DashboardRequestContext): Promise<{ items: DashboardAlert[] }> {
    this.ensureAccess(actor);

    const data = await dashboardRepository.getAlertData(actor.companyId);

    await this.logView(actor, "dashboard_alerts_viewed", context);

    const items: DashboardAlert[] = [
      ...data.inventoryRows.map((row) => ({
        id: row.id,
        kind: row.alertType === "expiring_soon" || row.alertType === "expired" ? "expiry" : "low_stock",
        severity: row.severity === "critical" ? "critical" : "warning",
        title: row.productName ? `${row.productName}` : "Inventory alert",
        description: row.message,
        dueDate: row.expiryDate ? toIsoDate(new Date(row.expiryDate)) : null
      }) satisfies DashboardAlert),
      ...data.customerDueRows.map((row) => ({
        id: row.id,
        kind: "customer_due",
        severity: "warning",
        title: `${row.customerName} due`,
        description: `Invoice ${row.invoiceNumber} is due`,
        amount: clampMoney(row.dueAmount),
        dueDate: row.dueDate ? toIsoDate(new Date(row.dueDate)) : null,
        actionUrl: "/app/sales/payments"
      }) satisfies DashboardAlert),
      ...data.supplierDueRows.map((row) => ({
        id: row.id,
        kind: "supplier_due",
        severity: "warning",
        title: `Supplier due ${row.invoiceNumber}`,
        description: "Supplier payment is approaching due date",
        amount: clampMoney(row.dueAmount),
        dueDate: row.dueDate ? toIsoDate(new Date(row.dueDate)) : null,
        actionUrl: "/app/purchases/payments"
      }) satisfies DashboardAlert),
      ...data.payrollRows.map((row) => ({
        id: row.id,
        kind: "payroll",
        severity: "critical",
        title: `${row.employeeName} salary pending`,
        description: `Payroll month ${row.payrollMonth}`,
        amount: clampMoney(row.amount),
        actionUrl: "/app/hr-payroll/payroll"
      }) satisfies DashboardAlert),
      ...data.gstRows.map((row) => ({
        id: row.id,
        kind: "gst",
        severity: "critical",
        title: `GST payable for ${toIsoDate(new Date(row.periodMonth)).slice(0, 7)}`,
        description: "GST liability is pending",
        amount: clampMoney(row.amount),
        actionUrl: "/app/accounting/gst"
      }) satisfies DashboardAlert),
      ...data.notificationRows.map((row) => ({
        id: row.id,
        kind: "notification",
        severity: row.priority === "critical" ? "critical" : row.priority === "warning" ? "warning" : "info",
        title: row.title,
        description: row.message,
        createdAt: row.createdAt.toISOString(),
        actionUrl: row.actionUrl
      }) satisfies DashboardAlert)
    ];

    return { items: items.slice(0, 12) };
  }

  public async getPendingTasks(actor: DashboardActor, context: DashboardRequestContext): Promise<{ items: DashboardTask[] }> {
    this.ensureAccess(actor);

    const data = await dashboardRepository.getPendingTaskData(actor.companyId);

    await this.logView(actor, "dashboard_pending_tasks_viewed", context);

    return {
      items: [
        {
          id: "draft-sales",
          kind: "draft_invoice",
          title: "Draft sales invoices",
          count: clampCount(data.draftSales.count),
          amount: clampMoney(data.draftSales.amount),
          href: "/app/sales/invoices"
        },
        {
          id: "draft-purchases",
          kind: "draft_invoice",
          title: "Draft purchase invoices",
          count: clampCount(data.draftPurchases.count),
          amount: clampMoney(data.draftPurchases.amount),
          href: "/app/purchases/invoices"
        },
        {
          id: "pending-payments",
          kind: "pending_payment",
          title: "Pending collections and dues",
          count: clampCount(data.pendingPayments.count),
          amount: clampMoney(data.pendingPayments.amount),
          href: "/app/accounting/payments"
        },
        {
          id: "unpaid-salary",
          kind: "unpaid_salary",
          title: "Unpaid salary",
          count: clampCount(data.unpaidSalary.count),
          amount: clampMoney(data.unpaidSalary.amount),
          href: "/app/hr-payroll/payroll"
        },
        {
          id: "gst-pending",
          kind: "gst_pending",
          title: "GST payable",
          count: clampCount(data.gstPending.count),
          amount: clampMoney(data.gstPending.amount),
          href: "/app/accounting/gst"
        }
      ]
    };
  }

  public async getRoleDashboard(actor: DashboardActor, context: DashboardRequestContext): Promise<DashboardRoleDashboard> {
    this.ensureAccess(actor);

    const month = getMonthBounds(new Date());
    const data = await dashboardRepository.getSnapshotData(actor.companyId, month);

    await this.logView(actor, "dashboard_role_viewed", context, { role: actor.role });

    const inventorySnapshot: DashboardInventorySnapshot = {
      totalProducts: clampCount(data.inventory?.totalProducts),
      trackedProducts: clampCount(data.inventory?.trackedProducts),
      lowStockCount: clampCount(data.inventory?.lowStockCount),
      expiringCount: clampCount(data.inventory?.expiringCount),
      totalStockQuantity: clampMoney(data.inventory?.totalStockQuantity),
      stockValue: clampMoney(data.inventory?.stockValue)
    };

    const gstSnapshot = {
      taxableSales: clampMoney(data.gst?.taxableSales),
      outputGst: clampMoney(data.gst?.outputGst),
      inputGst: clampMoney(data.gst?.inputGst),
      netGstPayable: clampMoney(data.gst?.netGstPayable),
      unclaimedItc: clampMoney(data.gst?.unclaimedItc)
    };

    const payrollSnapshot: DashboardPayrollSnapshot = {
      activeEmployees: clampCount(data.payroll?.activeEmployees),
      payrollCost: clampMoney(data.payroll?.payrollCost),
      pendingSalary: clampMoney(data.payroll?.pendingSalary),
      unpaidEmployees: clampCount(data.payroll?.unpaidEmployees)
    };

    const accountingSnapshot: DashboardAccountingSnapshot = {
      cashBalance: clampMoney(data.accounting?.cashBalance),
      bankBalance: clampMoney(data.accounting?.bankBalance),
      receivable: clampMoney(data.accounting?.receivable),
      payable: clampMoney(data.accounting?.payable),
      monthlyExpense: clampMoney(data.accounting?.monthlyExpense),
      netProfit: clampMoney(data.accounting?.netProfit)
    };

    return {
      role: actor.role,
      widgets: this.getRoleWidgets(actor.role),
      quickActions: this.getRoleActions(actor.role),
      inventorySnapshot,
      gstSnapshot,
      payrollSnapshot,
      accountingSnapshot
    };
  }

  private getRoleWidgets(role: DashboardActor["role"]) {
    const widgetMap: Record<DashboardActor["role"], string[]> = {
      admin: ["summary", "charts", "alerts", "recent-activities", "pending-tasks", "top-products", "inventory", "gst", "payroll", "accounting"],
      accountant: ["summary", "charts", "alerts", "recent-activities", "pending-tasks", "gst", "payroll", "accounting", "top-products"],
      staff: ["summary", "charts", "alerts", "pending-tasks", "top-products", "inventory"],
      auditor: ["summary", "charts", "recent-activities", "gst", "payroll", "accounting"]
    };

    return widgetMap[role];
  }

  private getRoleActions(role: DashboardActor["role"]): DashboardQuickAction[] {
    const all: DashboardQuickAction[] = [
      { id: "new-sale", label: "New Sale", href: "/app/sales/invoices", icon: "receipt-text", permission: "sales.create" },
      { id: "new-purchase", label: "New Purchase", href: "/app/purchases/new", icon: "shopping-cart", permission: "purchase.create" },
      { id: "add-expense", label: "Add Expense", href: "/app/accounting/expenses", icon: "wallet", permission: "expense.create" },
      { id: "receive-payment", label: "Receive Payment", href: "/app/accounting/payments", icon: "hand-coins", permission: "payment.receive" },
      { id: "pay-supplier", label: "Pay Supplier", href: "/app/purchases/payments", icon: "landmark", permission: "payment.pay" },
      { id: "add-customer", label: "Add Customer", href: "/app/sales/customers", icon: "user-plus", permission: "customer.create" },
      { id: "add-product", label: "Add Product", href: "/app/inventory/products", icon: "package-plus", permission: "product.create" }
    ];

    if (role === "auditor") {
      return [];
    }

    if (role === "staff") {
      return all.filter((item) => ["new-sale", "new-purchase", "add-customer", "add-product"].includes(item.id));
    }

    if (role === "accountant") {
      return all.filter((item) => ["add-expense", "receive-payment", "pay-supplier", "new-sale"].includes(item.id));
    }

    return all;
  }
}

export const dashboardService = new DashboardService();
