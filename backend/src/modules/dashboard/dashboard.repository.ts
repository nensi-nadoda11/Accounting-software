import { and, asc, count, desc, eq, gte, inArray, isNull, lte, ne, sql } from "drizzle-orm";

import { db } from "../../db";
import {
  auditLogs,
  chartOfAccounts,
  expenses,
  gstItcStatus,
  gstMonthlySummaries,
  inventoryAlerts,
  notifications,
  payments,
  payrollItems,
  payrollRuns,
  products,
  purchaseInvoiceItems,
  purchaseInvoices,
  salesInvoiceItems,
  salesInvoices,
  stockBalances
} from "../../db/schema";
import type { DashboardChartKey } from "./dashboard.types";

type PeriodBounds = {
  start: Date;
  end: Date;
};

type ChartBounds = PeriodBounds & {
  bucket: "day" | "week" | "month";
};

const postedSalesStatuses = ["posted", "partially_returned", "returned"] as const;
const postedPurchaseStatuses = ["posted", "returned"] as const;
const payrollActiveStatuses = ["generated", "paid"] as const;
const chartBucketLiterals = {
  day: "'day'",
  week: "'week'",
  month: "'month'"
} as const;

export class DashboardRepository {
  public async getSummary(companyId: string, today: PeriodBounds, month: PeriodBounds) {
    const salesTotals = await db
      .select({
        todaySales: sql<string>`coalesce(sum(case when ${salesInvoices.invoiceDate} between ${today.start} and ${today.end} then ${salesInvoices.grandTotal} else 0 end), 0)`,
        monthSales: sql<string>`coalesce(sum(case when ${salesInvoices.invoiceDate} between ${month.start} and ${month.end} then ${salesInvoices.grandTotal} else 0 end), 0)`,
        totalSales: sql<string>`coalesce(sum(${salesInvoices.grandTotal}), 0)`,
        receivable: sql<string>`coalesce(sum(${salesInvoices.dueAmount}), 0)`
      })
      .from(salesInvoices)
      .where(
        and(
          eq(salesInvoices.companyId, companyId),
          isNull(salesInvoices.deletedAt),
          inArray(salesInvoices.invoiceStatus, postedSalesStatuses)
        )
      );

    const purchaseTotals = await db
      .select({
        todayPurchase: sql<string>`coalesce(sum(case when ${purchaseInvoices.invoiceDate} between ${today.start} and ${today.end} then ${purchaseInvoices.grandTotal} else 0 end), 0)`,
        monthPurchase: sql<string>`coalesce(sum(case when ${purchaseInvoices.invoiceDate} between ${month.start} and ${month.end} then ${purchaseInvoices.grandTotal} else 0 end), 0)`,
        payable: sql<string>`coalesce(sum(${purchaseInvoices.dueAmount}), 0)`
      })
      .from(purchaseInvoices)
      .where(
        and(
          eq(purchaseInvoices.companyId, companyId),
          isNull(purchaseInvoices.deletedAt),
          inArray(purchaseInvoices.purchaseStatus, postedPurchaseStatuses)
        )
      );

    const productTotals = await db
      .select({
        totalProducts: sql<number>`count(distinct ${products.id})`,
        lowStockCount: sql<number>`count(distinct case when ${products.stockTrackingEnabled} = true and ${stockBalances.availableQuantity} <= ${products.minimumStockLevel} then ${products.id} end)`,
        expiringCount: sql<number>`count(distinct case when ${inventoryAlerts.alertType} = 'expiring_soon' and ${inventoryAlerts.resolvedAt} is null then ${products.id} end)`
      })
      .from(products)
      .leftJoin(
        stockBalances,
        and(eq(stockBalances.companyId, companyId), eq(stockBalances.productId, products.id))
      )
      .leftJoin(
        inventoryAlerts,
        and(
          eq(inventoryAlerts.companyId, companyId),
          eq(inventoryAlerts.productId, products.id),
          ne(inventoryAlerts.alertType, "low_stock")
        )
      )
      .where(and(eq(products.companyId, companyId), isNull(products.deletedAt), eq(products.status, "active")));

    const expenseTotals = await db
      .select({
        monthlyExpense: sql<string>`coalesce(sum(case when ${expenses.expenseDate} between ${month.start} and ${month.end} then ${expenses.totalAmount} else 0 end), 0)`
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.companyId, companyId),
          isNull(expenses.deletedAt),
          inArray(expenses.status, ["posted", "approved"])
        )
      );

    const payrollTotals = await db
      .select({
        payrollCost: sql<string>`coalesce(sum(case when ${payrollRuns.periodEnd} between ${month.start} and ${month.end} then ${payrollRuns.netPayableTotal} else 0 end), 0)`,
        pendingSalary: sql<string>`coalesce(sum(${payrollItems.netSalary} - ${payrollItems.paidAmount}), 0)`
      })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
      .where(
        and(
          eq(payrollItems.companyId, companyId),
          inArray(payrollItems.status, payrollActiveStatuses),
          inArray(payrollRuns.status, ["generated", "paid"])
        )
      );

    const accountBalances = await db
      .select({
        cashBalance: sql<string>`coalesce(sum(case when ${chartOfAccounts.systemKey} = 'cash' then ${chartOfAccounts.currentBalance} else 0 end), 0)`,
        bankBalance: sql<string>`coalesce(sum(case when ${chartOfAccounts.systemKey} = 'bank' then ${chartOfAccounts.currentBalance} else 0 end), 0)`,
        netProfit: sql<string>`coalesce(sum(case when ${chartOfAccounts.accountType} = 'income' then ${chartOfAccounts.currentBalance} else 0 end), 0) - coalesce(sum(case when ${chartOfAccounts.accountType} = 'expense' then ${chartOfAccounts.currentBalance} else 0 end), 0)`
      })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.companyId, companyId), isNull(chartOfAccounts.deletedAt), eq(chartOfAccounts.status, "active")));

    const gstTotals = await db
      .select({
        gstPayable: sql<string>`coalesce(sum(${gstMonthlySummaries.netGstPayable}), 0)`
      })
      .from(gstMonthlySummaries)
      .where(and(eq(gstMonthlySummaries.companyId, companyId), gte(gstMonthlySummaries.periodMonth, month.start), lte(gstMonthlySummaries.periodMonth, month.end)));

    return {
      salesTotals: salesTotals[0] ?? null,
      purchaseTotals: purchaseTotals[0] ?? null,
      productTotals: productTotals[0] ?? null,
      expenseTotals: expenseTotals[0] ?? null,
      payrollTotals: payrollTotals[0] ?? null,
      accountBalances: accountBalances[0] ?? null,
      gstTotals: gstTotals[0] ?? null
    };
  }

  public async getChart(companyId: string, chartKey: DashboardChartKey, bounds: ChartBounds) {
    const bucketLiteral = chartBucketLiterals[bounds.bucket];
    const base = sql`date_trunc(${sql.raw(bucketLiteral)}, ${this.getDateColumn(chartKey)})`;
    const valueExpression = this.getChartValueExpression(chartKey);
    const table = this.getChartTable(chartKey);
    const whereClause = this.getChartWhereClause(companyId, chartKey, bounds);

    return db
      .select({
        bucketStart: sql<Date>`${base}`.as("bucket_start"),
        value: sql<string>`coalesce(sum(${valueExpression}), 0)`.as("value")
      })
      .from(table)
      .where(whereClause)
      .groupBy(base)
      .orderBy(asc(base));
  }

  public async getTopProducts(companyId: string, bounds: PeriodBounds, limit: number) {
    return db
      .select({
        productId: products.id,
        productName: products.name,
        sku: products.sku,
        quantity: sql<string>`coalesce(sum(${salesInvoiceItems.quantity}), 0)`,
        salesAmount: sql<string>`coalesce(sum(${salesInvoiceItems.lineTotal}), 0)`
      })
      .from(salesInvoiceItems)
      .innerJoin(products, eq(salesInvoiceItems.productId, products.id))
      .innerJoin(salesInvoices, eq(salesInvoiceItems.salesInvoiceId, salesInvoices.id))
      .where(
        and(
          eq(salesInvoiceItems.companyId, companyId),
          isNull(products.deletedAt),
          isNull(salesInvoices.deletedAt),
          inArray(salesInvoices.invoiceStatus, postedSalesStatuses),
          gte(salesInvoices.invoiceDate, bounds.start),
          lte(salesInvoices.invoiceDate, bounds.end)
        )
      )
      .groupBy(products.id, products.name, products.sku)
      .orderBy(desc(sql`coalesce(sum(${salesInvoiceItems.lineTotal}), 0)`), desc(sql`coalesce(sum(${salesInvoiceItems.quantity}), 0)`))
      .limit(limit);
  }

  public async listRecentActivities(companyId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const whereClause = and(
      eq(auditLogs.companyId, companyId),
      ne(auditLogs.module, "dashboard"),
      sql`${auditLogs.action} not like 'dashboard_%'`
    );

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        module: auditLogs.module,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        status: auditLogs.status,
        createdAt: auditLogs.createdAt,
        userNameSnapshot: auditLogs.userNameSnapshot,
        metadata: auditLogs.metadata
      })
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const totalRows = await db
      .select({ value: count() })
      .from(auditLogs)
      .where(whereClause);

    const totalRow = totalRows[0]?.value ?? 0;

    return { rows, total: totalRow };
  }

  public async getAlertData(companyId: string) {
    const inventoryRows = await db
      .select({
        id: inventoryAlerts.id,
        alertType: inventoryAlerts.alertType,
        severity: inventoryAlerts.severity,
        message: inventoryAlerts.message,
        expiryDate: inventoryAlerts.expiryDate,
        productName: products.name,
        currentQuantity: inventoryAlerts.currentQuantity
      })
      .from(inventoryAlerts)
      .leftJoin(products, eq(inventoryAlerts.productId, products.id))
      .where(and(eq(inventoryAlerts.companyId, companyId), sql`${inventoryAlerts.resolvedAt} is null`))
      .orderBy(desc(inventoryAlerts.createdAt))
      .limit(8);

    const customerDueRows = await db
      .select({
        id: salesInvoices.id,
        invoiceNumber: salesInvoices.invoiceNumber,
        dueDate: salesInvoices.dueDate,
        dueAmount: salesInvoices.dueAmount,
        customerName: salesInvoices.customerNameSnapshot
      })
      .from(salesInvoices)
      .where(
        and(
          eq(salesInvoices.companyId, companyId),
          isNull(salesInvoices.deletedAt),
          inArray(salesInvoices.invoiceStatus, postedSalesStatuses),
          sql`${salesInvoices.dueAmount} > 0`,
          sql`${salesInvoices.dueDate} is not null and ${salesInvoices.dueDate} <= current_date + interval '7 days'`
        )
      )
      .orderBy(asc(salesInvoices.dueDate))
      .limit(5);

    const supplierDueRows = await db
      .select({
        id: purchaseInvoices.id,
        invoiceNumber: purchaseInvoices.purchaseNumber,
        dueDate: purchaseInvoices.dueDate,
        dueAmount: purchaseInvoices.dueAmount
      })
      .from(purchaseInvoices)
      .where(
        and(
          eq(purchaseInvoices.companyId, companyId),
          isNull(purchaseInvoices.deletedAt),
          inArray(purchaseInvoices.purchaseStatus, postedPurchaseStatuses),
          sql`${purchaseInvoices.dueAmount} > 0`,
          sql`${purchaseInvoices.dueDate} is not null and ${purchaseInvoices.dueDate} <= current_date + interval '7 days'`
        )
      )
      .orderBy(asc(purchaseInvoices.dueDate))
      .limit(5);

    const payrollRows = await db
      .select({
        id: payrollItems.id,
        employeeName: payrollItems.employeeNameSnapshot,
        payrollMonth: payrollRuns.payrollMonth,
        amount: sql<string>`${payrollItems.netSalary} - ${payrollItems.paidAmount}`
      })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
      .where(
        and(
          eq(payrollItems.companyId, companyId),
          inArray(payrollItems.paymentStatus, ["unpaid", "partial"]),
          inArray(payrollItems.status, payrollActiveStatuses)
        )
      )
      .orderBy(desc(payrollRuns.periodEnd))
      .limit(5);

    const gstRows = await db
      .select({
        id: gstMonthlySummaries.id,
        periodMonth: gstMonthlySummaries.periodMonth,
        amount: gstMonthlySummaries.netGstPayable
      })
      .from(gstMonthlySummaries)
      .where(and(eq(gstMonthlySummaries.companyId, companyId), sql`${gstMonthlySummaries.netGstPayable} > 0`))
      .orderBy(desc(gstMonthlySummaries.periodMonth))
      .limit(3);

    const notificationRows = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        priority: notifications.priority,
        createdAt: notifications.createdAt,
        actionUrl: notifications.actionUrl
      })
      .from(notifications)
      .where(and(eq(notifications.companyId, companyId), eq(notifications.isRead, false), isNull(notifications.deletedAt)))
      .orderBy(desc(notifications.createdAt))
      .limit(4);

    return { inventoryRows, customerDueRows, supplierDueRows, payrollRows, gstRows, notificationRows };
  }

  public async getPendingTaskData(companyId: string) {
    const draftSales = await db
      .select({
        count: count(),
        amount: sql<string>`coalesce(sum(${salesInvoices.grandTotal}), 0)`
      })
      .from(salesInvoices)
      .where(and(eq(salesInvoices.companyId, companyId), isNull(salesInvoices.deletedAt), eq(salesInvoices.invoiceStatus, "draft")));

    const draftPurchases = await db
      .select({
        count: count(),
        amount: sql<string>`coalesce(sum(${purchaseInvoices.grandTotal}), 0)`
      })
      .from(purchaseInvoices)
      .where(and(eq(purchaseInvoices.companyId, companyId), isNull(purchaseInvoices.deletedAt), eq(purchaseInvoices.purchaseStatus, "draft")));

    const customerPendingPayments = await db
      .select({
        count: count(),
        amount: sql<string>`coalesce(sum(${salesInvoices.dueAmount}), 0)`
      })
      .from(salesInvoices)
      .where(
        and(
          eq(salesInvoices.companyId, companyId),
          isNull(salesInvoices.deletedAt),
          inArray(salesInvoices.invoiceStatus, postedSalesStatuses),
          sql`${salesInvoices.dueAmount} > 0`
        )
      );

    const supplierPendingPayments = await db
      .select({
        count: count(),
        amount: sql<string>`coalesce(sum(${purchaseInvoices.dueAmount}), 0)`
      })
      .from(purchaseInvoices)
      .where(
        and(
          eq(purchaseInvoices.companyId, companyId),
          isNull(purchaseInvoices.deletedAt),
          inArray(purchaseInvoices.purchaseStatus, postedPurchaseStatuses),
          sql`${purchaseInvoices.dueAmount} > 0`
        )
      );

    const unpaidSalary = await db
      .select({
        count: count(),
        amount: sql<string>`coalesce(sum(${payrollItems.netSalary} - ${payrollItems.paidAmount}), 0)`
      })
      .from(payrollItems)
      .where(and(eq(payrollItems.companyId, companyId), inArray(payrollItems.paymentStatus, ["unpaid", "partial"])));

    const gstPending = await db
      .select({
        count: count(),
        amount: sql<string>`coalesce(sum(${gstMonthlySummaries.netGstPayable}), 0)`
      })
      .from(gstMonthlySummaries)
      .where(and(eq(gstMonthlySummaries.companyId, companyId), sql`${gstMonthlySummaries.netGstPayable} > 0`));

    const customerPendingPaymentRow = customerPendingPayments[0] ?? { count: 0, amount: "0.00" };
    const supplierPendingPaymentRow = supplierPendingPayments[0] ?? { count: 0, amount: "0.00" };

    return {
      draftSales: draftSales[0] ?? { count: 0, amount: "0.00" },
      draftPurchases: draftPurchases[0] ?? { count: 0, amount: "0.00" },
      pendingPayments: {
        count: customerPendingPaymentRow.count + supplierPendingPaymentRow.count,
        amount: (
          Number(customerPendingPaymentRow.amount ?? 0) + Number(supplierPendingPaymentRow.amount ?? 0)
        ).toFixed(2)
      },
      unpaidSalary: unpaidSalary[0] ?? { count: 0, amount: "0.00" },
      gstPending: gstPending[0] ?? { count: 0, amount: "0.00" }
    };
  }

  public async getSnapshotData(companyId: string, month: PeriodBounds) {
    const inventory = await db
      .select({
        totalProducts: sql<number>`count(distinct ${products.id})`,
        trackedProducts: sql<number>`count(distinct case when ${products.stockTrackingEnabled} = true then ${products.id} end)`,
        lowStockCount: sql<number>`count(distinct case when ${products.stockTrackingEnabled} = true and ${stockBalances.availableQuantity} <= ${products.minimumStockLevel} then ${products.id} end)`,
        totalStockQuantity: sql<string>`coalesce(sum(${stockBalances.availableQuantity}), 0)`,
        stockValue: sql<string>`coalesce(sum(${stockBalances.stockValue}), 0)`
      })
      .from(products)
      .leftJoin(stockBalances, and(eq(stockBalances.companyId, companyId), eq(stockBalances.productId, products.id)))
      .where(and(eq(products.companyId, companyId), isNull(products.deletedAt), eq(products.status, "active")));

    const gst = await db
      .select({
        taxableSales: sql<string>`coalesce(sum(${gstMonthlySummaries.taxableSales}), 0)`,
        outputGst: sql<string>`coalesce(sum(${gstMonthlySummaries.outputGst}), 0)`,
        inputGst: sql<string>`coalesce(sum(${gstMonthlySummaries.inputGst} + ${gstMonthlySummaries.expenseInputGst}), 0)`,
        netGstPayable: sql<string>`coalesce(sum(${gstMonthlySummaries.netGstPayable}), 0)`
      })
      .from(gstMonthlySummaries)
      .where(and(eq(gstMonthlySummaries.companyId, companyId), gte(gstMonthlySummaries.periodMonth, month.start), lte(gstMonthlySummaries.periodMonth, month.end)));

    const payroll = await db
      .select({
        activeEmployees: sql<number>`coalesce(sum(case when ${payrollItems.status} in ('generated', 'paid') then 1 else 0 end), 0)`,
        pendingSalary: sql<string>`coalesce(sum(${payrollItems.netSalary} - ${payrollItems.paidAmount}), 0)`,
        unpaidEmployees: sql<number>`coalesce(sum(case when ${payrollItems.paymentStatus} in ('unpaid', 'partial') then 1 else 0 end), 0)`,
        payrollCost: sql<string>`coalesce(sum(case when ${payrollRuns.periodEnd} between ${month.start} and ${month.end} then ${payrollRuns.netPayableTotal} else 0 end), 0)`
      })
      .from(payrollItems)
      .innerJoin(payrollRuns, eq(payrollItems.payrollRunId, payrollRuns.id))
      .where(and(eq(payrollItems.companyId, companyId), inArray(payrollItems.status, payrollActiveStatuses)));

    const accounting = await db
      .select({
        cashBalance: sql<string>`coalesce(sum(case when ${chartOfAccounts.systemKey} = 'cash' then ${chartOfAccounts.currentBalance} else 0 end), 0)`,
        bankBalance: sql<string>`coalesce(sum(case when ${chartOfAccounts.systemKey} = 'bank' then ${chartOfAccounts.currentBalance} else 0 end), 0)`,
        receivable: sql<string>`coalesce(sum(case when ${chartOfAccounts.systemKey} = 'accounts_receivable' then ${chartOfAccounts.currentBalance} else 0 end), 0)`,
        payable: sql<string>`coalesce(sum(case when ${chartOfAccounts.systemKey} = 'accounts_payable' then ${chartOfAccounts.currentBalance} else 0 end), 0)`,
        monthlyExpense: sql<string>`coalesce(sum(case when ${chartOfAccounts.accountType} = 'expense' then ${chartOfAccounts.currentBalance} else 0 end), 0)`,
        netProfit: sql<string>`coalesce(sum(case when ${chartOfAccounts.accountType} = 'income' then ${chartOfAccounts.currentBalance} else 0 end), 0) - coalesce(sum(case when ${chartOfAccounts.accountType} = 'expense' then ${chartOfAccounts.currentBalance} else 0 end), 0)`
      })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.companyId, companyId), isNull(chartOfAccounts.deletedAt), eq(chartOfAccounts.status, "active")));

    const itcRow = await db
      .select({
        unclaimedItc: sql<string>`coalesce(sum(${gstItcStatus.totalGstAmount} - ${gstItcStatus.claimedAmount}), 0)`
      })
      .from(gstItcStatus)
      .where(and(eq(gstItcStatus.companyId, companyId), inArray(gstItcStatus.claimStatus, ["unclaimed", "partially_claimed"])));

    const expiryRow = await db
      .select({
        expiringCount: sql<number>`coalesce(sum(case when ${inventoryAlerts.alertType} = 'expiring_soon' and ${inventoryAlerts.resolvedAt} is null then 1 else 0 end), 0)`
      })
      .from(inventoryAlerts)
      .where(eq(inventoryAlerts.companyId, companyId));

    return {
      inventory: inventory[0] ? { ...inventory[0], expiringCount: expiryRow[0]?.expiringCount ?? 0 } : null,
      gst: gst[0] ? { ...gst[0], unclaimedItc: itcRow[0]?.unclaimedItc ?? "0.00" } : null,
      payroll: payroll[0] ?? null,
      accounting: accounting[0] ?? null
    };
  }

  private getChartTable(chartKey: DashboardChartKey) {
    switch (chartKey) {
      case "sales":
        return salesInvoices;
      case "purchases":
        return purchaseInvoices;
      case "expenses":
        return expenses;
      case "payments":
        return payments;
    }
  }

  private getDateColumn(chartKey: DashboardChartKey) {
    switch (chartKey) {
      case "sales":
        return salesInvoices.invoiceDate;
      case "purchases":
        return purchaseInvoices.invoiceDate;
      case "expenses":
        return expenses.expenseDate;
      case "payments":
        return payments.paymentDate;
    }
  }

  private getChartValueExpression(chartKey: DashboardChartKey) {
    switch (chartKey) {
      case "sales":
        return salesInvoices.grandTotal;
      case "purchases":
        return purchaseInvoices.grandTotal;
      case "expenses":
        return expenses.totalAmount;
      case "payments":
        return payments.amount;
    }
  }

  private getChartWhereClause(companyId: string, chartKey: DashboardChartKey, bounds: ChartBounds) {
    switch (chartKey) {
      case "sales":
        return and(
          eq(salesInvoices.companyId, companyId),
          isNull(salesInvoices.deletedAt),
          inArray(salesInvoices.invoiceStatus, postedSalesStatuses),
          gte(salesInvoices.invoiceDate, bounds.start),
          lte(salesInvoices.invoiceDate, bounds.end)
        );
      case "purchases":
        return and(
          eq(purchaseInvoices.companyId, companyId),
          isNull(purchaseInvoices.deletedAt),
          inArray(purchaseInvoices.purchaseStatus, postedPurchaseStatuses),
          gte(purchaseInvoices.invoiceDate, bounds.start),
          lte(purchaseInvoices.invoiceDate, bounds.end)
        );
      case "expenses":
        return and(
          eq(expenses.companyId, companyId),
          isNull(expenses.deletedAt),
          inArray(expenses.status, ["posted", "approved"]),
          gte(expenses.expenseDate, bounds.start),
          lte(expenses.expenseDate, bounds.end)
        );
      case "payments":
        return and(
          eq(payments.companyId, companyId),
          isNull(payments.deletedAt),
          eq(payments.status, "completed"),
          gte(payments.paymentDate, bounds.start),
          lte(payments.paymentDate, bounds.end)
        );
    }
  }
}

export const dashboardRepository = new DashboardRepository();
