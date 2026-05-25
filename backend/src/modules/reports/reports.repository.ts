import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "../../db";
import {
  chartOfAccounts,
  companyFinancialYears,
  customers,
  expenseCategories,
  expenses,
  productBatches,
  productCategories,
  products,
  purchaseInvoiceItems,
  purchaseInvoices,
  reportExports,
  salesInvoiceItems,
  salesInvoices,
  suppliers,
  stockBalances,
  stockMovements,
  warehouses,
  journalEntries,
  journalEntryLines,
  employees
} from "../../db/schema";
import type { ReportExportRecord } from "./reports.types";

type DateRange = {
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
  financialYearId?: string | null | undefined;
};

type ReportFilters = DateRange & {
  customerId?: string | undefined;
  supplierId?: string | undefined;
  productId?: string | undefined;
  categoryId?: string | undefined;
  employeeId?: string | undefined;
  department?: string | undefined;
  paymentMode?: string | undefined;
  gstRate?: number | undefined;
  status?: string | undefined;
  includeDrafts?: boolean | undefined;
  includeCancelled?: boolean | undefined;
};

type PaginatedReportFilters = ReportFilters & {
  page: number;
  limit: number;
};

class ReportsRepository {
  public async findFinancialYear(companyId: string, financialYearId: string) {
    const [row] = await db
      .select({
        id: companyFinancialYears.id,
        startDate: companyFinancialYears.startDate,
        endDate: companyFinancialYears.endDate
      })
      .from(companyFinancialYears)
      .where(and(eq(companyFinancialYears.companyId, companyId), eq(companyFinancialYears.id, financialYearId)))
      .limit(1);

    return row ?? null;
  }

  public async findCustomer(companyId: string, customerId: string) {
    const [row] = await db
      .select({
        id: customers.id,
        name: customers.name,
        customerCode: customers.customerCode,
        openingBalanceAmount: customers.openingBalanceAmount,
        openingBalanceType: customers.openingBalanceType
      })
      .from(customers)
      .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findSupplier(companyId: string, supplierId: string) {
    const [row] = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        supplierCode: suppliers.supplierCode,
        openingBalanceAmount: suppliers.openingBalanceAmount,
        openingBalanceType: suppliers.openingBalanceType
      })
      .from(suppliers)
      .where(and(eq(suppliers.companyId, companyId), eq(suppliers.id, supplierId), isNull(suppliers.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async productExists(companyId: string, productId: string) {
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.companyId, companyId), eq(products.id, productId), isNull(products.deletedAt)))
      .limit(1);

    return Boolean(row);
  }

  public async categoryExists(companyId: string, categoryId: string) {
    const [productCategoryRow, expenseCategoryRow] = await Promise.all([
      db
        .select({ id: productCategories.id })
        .from(productCategories)
        .where(and(eq(productCategories.companyId, companyId), eq(productCategories.id, categoryId), isNull(productCategories.deletedAt)))
        .limit(1),
      db
        .select({ id: expenseCategories.id })
        .from(expenseCategories)
        .where(and(eq(expenseCategories.companyId, companyId), eq(expenseCategories.id, categoryId), isNull(expenseCategories.deletedAt)))
        .limit(1)
    ]);

    return Boolean(productCategoryRow[0] || expenseCategoryRow[0]);
  }

  public async employeeExists(companyId: string, employeeId: string) {
    const [row] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.companyId, companyId), eq(employees.id, employeeId), isNull(employees.deletedAt)))
      .limit(1);

    return Boolean(row);
  }

  public async createReportExport(data: typeof reportExports.$inferInsert) {
    const [row] = await db.insert(reportExports).values(data).returning();
    return row ?? null;
  }

  public async listRecentExports(companyId: string, limit: number): Promise<ReportExportRecord[]> {
    const rows = await db
      .select({
        id: reportExports.id,
        reportType: reportExports.reportType,
        exportFormat: reportExports.exportFormat,
        status: reportExports.status,
        fileUrl: reportExports.fileUrl,
        generatedBy: reportExports.generatedBy,
        createdAt: reportExports.createdAt,
        filters: reportExports.filters
      })
      .from(reportExports)
      .where(eq(reportExports.companyId, companyId))
      .orderBy(desc(reportExports.createdAt))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      filters: row.filters ?? {}
    }));
  }

  private applyResolvedDateRange(conditions: SQL[], column: SQL | { _: { name: string } }, dateFrom?: Date, dateTo?: Date) {
    if (dateFrom) {
      conditions.push(sql`${column} >= ${dateFrom}`);
    }

    if (dateTo) {
      conditions.push(sql`${column} <= ${dateTo}`);
    }
  }

  private getSalesStatuses(filters: ReportFilters) {
    if (filters.status) {
      return [filters.status] as Array<typeof salesInvoices.$inferSelect.invoiceStatus>;
    }

    const statuses: Array<typeof salesInvoices.$inferSelect.invoiceStatus> = ["posted", "partially_returned", "returned"];

    if (filters.includeDrafts) {
      statuses.push("draft");
    }

    if (filters.includeCancelled) {
      statuses.push("cancelled");
    }

    return statuses;
  }

  private getPurchaseStatuses(filters: ReportFilters) {
    if (filters.status) {
      return [filters.status] as Array<typeof purchaseInvoices.$inferSelect.purchaseStatus>;
    }

    const statuses: Array<typeof purchaseInvoices.$inferSelect.purchaseStatus> = ["posted", "returned"];

    if (filters.includeDrafts) {
      statuses.push("draft");
    }

    if (filters.includeCancelled) {
      statuses.push("cancelled");
    }

    return statuses;
  }

  private buildSalesConditions(companyId: string, filters: ReportFilters) {
    const conditions: SQL[] = [
      eq(salesInvoices.companyId, companyId),
      isNull(salesInvoices.deletedAt),
      inArray(salesInvoices.invoiceStatus, this.getSalesStatuses(filters))
    ];

    this.applyResolvedDateRange(conditions, salesInvoices.invoiceDate, filters.dateFrom, filters.dateTo);

    if (filters.customerId) {
      conditions.push(eq(salesInvoices.customerId, filters.customerId));
    }

    if (filters.paymentMode) {
      conditions.push(sql`${salesInvoices.paymentMode} = ${filters.paymentMode}`);
    }

    return conditions;
  }

  private buildPurchaseConditions(companyId: string, filters: ReportFilters) {
    const conditions: SQL[] = [
      eq(purchaseInvoices.companyId, companyId),
      isNull(purchaseInvoices.deletedAt),
      inArray(purchaseInvoices.purchaseStatus, this.getPurchaseStatuses(filters))
    ];

    this.applyResolvedDateRange(conditions, purchaseInvoices.invoiceDate, filters.dateFrom, filters.dateTo);

    if (filters.supplierId) {
      conditions.push(eq(purchaseInvoices.supplierId, filters.supplierId));
    }

    if (filters.paymentMode) {
      conditions.push(sql`${purchaseInvoices.paymentMode} = ${filters.paymentMode}`);
    }

    return conditions;
  }

  public async getSalesSummary(companyId: string, filters: ReportFilters) {
    const conditions = this.buildSalesConditions(companyId, filters);
    const whereClause = and(...conditions);

    const [row] = await db
      .select({
        invoiceCount: count(salesInvoices.id),
        grossSales: sql<string>`coalesce(sum(${salesInvoices.grandTotal}), 0)`,
        taxableSales: sql<string>`coalesce(sum(${salesInvoices.taxableAmount}), 0)`,
        gstAmount: sql<string>`coalesce(sum(${salesInvoices.gstTotal}), 0)`,
        collectedAmount: sql<string>`coalesce(sum(${salesInvoices.paidAmount}), 0)`,
        outstandingAmount: sql<string>`coalesce(sum(${salesInvoices.dueAmount}), 0)`,
        averageInvoiceValue: sql<string>`coalesce(avg(${salesInvoices.grandTotal}), 0)`
      })
      .from(salesInvoices)
      .where(whereClause);

    return row;
  }

  public async getSalesDetailed(companyId: string, filters: PaginatedReportFilters) {
    const conditions = this.buildSalesConditions(companyId, filters);
    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: salesInvoices.id,
        invoiceNumber: salesInvoices.invoiceNumber,
        invoiceDate: salesInvoices.invoiceDate,
        customerId: salesInvoices.customerId,
        customerName: salesInvoices.customerNameSnapshot,
        invoiceStatus: salesInvoices.invoiceStatus,
        paymentStatus: salesInvoices.paymentStatus,
        paymentMode: salesInvoices.paymentMode,
        taxableAmount: salesInvoices.taxableAmount,
        gstTotal: salesInvoices.gstTotal,
        grandTotal: salesInvoices.grandTotal,
        paidAmount: salesInvoices.paidAmount,
        dueAmount: salesInvoices.dueAmount
      })
      .from(salesInvoices)
      .where(whereClause)
      .orderBy(desc(salesInvoices.invoiceDate), desc(salesInvoices.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRows, totalsRows] = await Promise.all([
      db.select({ value: count() }).from(salesInvoices).where(whereClause),
      db
        .select({
          taxableAmount: sql<string>`coalesce(sum(${salesInvoices.taxableAmount}), 0)`,
          gstTotal: sql<string>`coalesce(sum(${salesInvoices.gstTotal}), 0)`,
          grandTotal: sql<string>`coalesce(sum(${salesInvoices.grandTotal}), 0)`,
          paidAmount: sql<string>`coalesce(sum(${salesInvoices.paidAmount}), 0)`,
          dueAmount: sql<string>`coalesce(sum(${salesInvoices.dueAmount}), 0)`
        })
        .from(salesInvoices)
        .where(whereClause)
    ]);

    const totalRow = totalRows[0];
    const totalsRow = totalsRows[0];

    return {
      items: rows,
      total: totalRow?.value ?? 0,
      totals: totalsRow
    };
  }

  public async getSalesTopCustomers(companyId: string, filters: ReportFilters, limit: number) {
    const conditions = this.buildSalesConditions(companyId, filters);
    const whereClause = and(...conditions);

    return db
      .select({
        customerId: salesInvoices.customerId,
        customerName: salesInvoices.customerNameSnapshot,
        invoiceCount: count(salesInvoices.id),
        totalSales: sql<string>`coalesce(sum(${salesInvoices.grandTotal}), 0)`,
        collectedAmount: sql<string>`coalesce(sum(${salesInvoices.paidAmount}), 0)`,
        outstandingAmount: sql<string>`coalesce(sum(${salesInvoices.dueAmount}), 0)`
      })
      .from(salesInvoices)
      .where(whereClause)
      .groupBy(salesInvoices.customerId, salesInvoices.customerNameSnapshot)
      .orderBy(desc(sql`coalesce(sum(${salesInvoices.grandTotal}), 0)`), asc(salesInvoices.customerNameSnapshot))
      .limit(limit);
  }

  public async getSalesTopProducts(companyId: string, filters: ReportFilters, limit: number) {
    const conditions = this.buildSalesConditions(companyId, filters);
    const itemConditions: SQL[] = [eq(salesInvoiceItems.companyId, companyId)];

    if (filters.productId) {
      itemConditions.push(eq(salesInvoiceItems.productId, filters.productId));
    }

    if (filters.gstRate !== undefined) {
      itemConditions.push(eq(salesInvoiceItems.gstRate, filters.gstRate.toFixed(2)));
    }

    const whereClause = and(...conditions, ...itemConditions);

    return db
      .select({
        productId: salesInvoiceItems.productId,
        productName: salesInvoiceItems.productNameSnapshot,
        sku: salesInvoiceItems.skuSnapshot,
        quantitySold: sql<string>`coalesce(sum(${salesInvoiceItems.quantity}), 0)`,
        returnedQuantity: sql<string>`coalesce(sum(${salesInvoiceItems.returnedQuantity}), 0)`,
        netSales: sql<string>`coalesce(sum(${salesInvoiceItems.lineTotal}), 0)`,
        invoiceCount: sql<number>`count(distinct ${salesInvoiceItems.salesInvoiceId})`
      })
      .from(salesInvoiceItems)
      .innerJoin(salesInvoices, eq(salesInvoiceItems.salesInvoiceId, salesInvoices.id))
      .where(whereClause)
      .groupBy(salesInvoiceItems.productId, salesInvoiceItems.productNameSnapshot, salesInvoiceItems.skuSnapshot)
      .orderBy(desc(sql`coalesce(sum(${salesInvoiceItems.lineTotal}), 0)`), asc(salesInvoiceItems.productNameSnapshot))
      .limit(limit);
  }

  public async getPurchasesSummary(companyId: string, filters: ReportFilters) {
    const conditions = this.buildPurchaseConditions(companyId, filters);
    const whereClause = and(...conditions);

    const [row] = await db
      .select({
        invoiceCount: count(purchaseInvoices.id),
        grossPurchases: sql<string>`coalesce(sum(${purchaseInvoices.grandTotal}), 0)`,
        taxablePurchases: sql<string>`coalesce(sum(${purchaseInvoices.taxableAmount}), 0)`,
        gstAmount: sql<string>`coalesce(sum(${purchaseInvoices.gstTotal}), 0)`,
        paidAmount: sql<string>`coalesce(sum(${purchaseInvoices.paidAmount}), 0)`,
        outstandingAmount: sql<string>`coalesce(sum(${purchaseInvoices.dueAmount}), 0)`,
        averageInvoiceValue: sql<string>`coalesce(avg(${purchaseInvoices.grandTotal}), 0)`
      })
      .from(purchaseInvoices)
      .where(whereClause);

    return row;
  }

  public async getPurchasesDetailed(companyId: string, filters: PaginatedReportFilters) {
    const conditions = this.buildPurchaseConditions(companyId, filters);
    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: purchaseInvoices.id,
        purchaseNumber: purchaseInvoices.purchaseNumber,
        invoiceDate: purchaseInvoices.invoiceDate,
        supplierId: purchaseInvoices.supplierId,
        supplierName: suppliers.name,
        purchaseStatus: purchaseInvoices.purchaseStatus,
        paymentStatus: purchaseInvoices.paymentStatus,
        paymentMode: purchaseInvoices.paymentMode,
        taxableAmount: purchaseInvoices.taxableAmount,
        gstTotal: purchaseInvoices.gstTotal,
        grandTotal: purchaseInvoices.grandTotal,
        paidAmount: purchaseInvoices.paidAmount,
        dueAmount: purchaseInvoices.dueAmount
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .where(whereClause)
      .orderBy(desc(purchaseInvoices.invoiceDate), desc(purchaseInvoices.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRows, totalsRows] = await Promise.all([
      db.select({ value: count() }).from(purchaseInvoices).where(whereClause),
      db
        .select({
          taxableAmount: sql<string>`coalesce(sum(${purchaseInvoices.taxableAmount}), 0)`,
          gstTotal: sql<string>`coalesce(sum(${purchaseInvoices.gstTotal}), 0)`,
          grandTotal: sql<string>`coalesce(sum(${purchaseInvoices.grandTotal}), 0)`,
          paidAmount: sql<string>`coalesce(sum(${purchaseInvoices.paidAmount}), 0)`,
          dueAmount: sql<string>`coalesce(sum(${purchaseInvoices.dueAmount}), 0)`
        })
        .from(purchaseInvoices)
        .where(whereClause)
    ]);

    const totalRow = totalRows[0];
    const totalsRow = totalsRows[0];

    return {
      items: rows,
      total: totalRow?.value ?? 0,
      totals: totalsRow
    };
  }

  public async listCustomersOutstanding(companyId: string, filters: ReportFilters) {
    const invoiceConditions = this.buildSalesConditions(companyId, filters);
    const invoiceWhere = and(...invoiceConditions, eq(salesInvoices.customerId, customers.id));

    return db
      .select({
        customerId: customers.id,
        customerCode: customers.customerCode,
        customerName: customers.name,
        mobile: customers.mobile,
        status: customers.status,
        outstandingAmount: sql<string>`
          CASE
            WHEN ${customers.openingBalanceType} = 'debit' THEN ${customers.openingBalanceAmount}
            WHEN ${customers.openingBalanceType} = 'credit' THEN (${customers.openingBalanceAmount} * -1)
            ELSE 0
          END + coalesce((
            select sum(${salesInvoices.dueAmount})
            from ${salesInvoices}
            where ${invoiceWhere}
          ), 0)
        `,
        overdueAmount: sql<string>`
          coalesce((
            select sum(${salesInvoices.dueAmount})
            from ${salesInvoices}
            where ${invoiceWhere}
              and ${salesInvoices.dueDate} is not null
              and ${salesInvoices.dueDate} < current_date
              and ${salesInvoices.dueAmount} > 0
          ), 0)
        `,
        invoiceCount: sql<number>`
          coalesce((
            select count(*)
            from ${salesInvoices}
            where ${invoiceWhere}
          ), 0)
        `
      })
      .from(customers)
      .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
      .orderBy(desc(sql`
        CASE
          WHEN ${customers.openingBalanceType} = 'debit' THEN ${customers.openingBalanceAmount}
          WHEN ${customers.openingBalanceType} = 'credit' THEN (${customers.openingBalanceAmount} * -1)
          ELSE 0
        END + coalesce((
          select sum(${salesInvoices.dueAmount})
          from ${salesInvoices}
          where ${invoiceWhere}
        ), 0)
      `), asc(customers.name));
  }

  public async listCustomersAging(companyId: string, filters: ReportFilters) {
    const conditions = this.buildSalesConditions(companyId, filters);
    conditions.push(sql`${salesInvoices.dueAmount} > 0`);
    const asOfDate = filters.dateTo ?? new Date();

    return db
      .select({
        customerId: customers.id,
        customerCode: customers.customerCode,
        customerName: customers.name,
        bucket0To30: sql<string>`coalesce(sum(case when ${asOfDate}::date - coalesce(${salesInvoices.dueDate}, ${salesInvoices.invoiceDate}) between 0 and 30 then ${salesInvoices.dueAmount} else 0 end), 0)`,
        bucket31To60: sql<string>`coalesce(sum(case when ${asOfDate}::date - coalesce(${salesInvoices.dueDate}, ${salesInvoices.invoiceDate}) between 31 and 60 then ${salesInvoices.dueAmount} else 0 end), 0)`,
        bucket61To90: sql<string>`coalesce(sum(case when ${asOfDate}::date - coalesce(${salesInvoices.dueDate}, ${salesInvoices.invoiceDate}) between 61 and 90 then ${salesInvoices.dueAmount} else 0 end), 0)`,
        bucketAbove90: sql<string>`coalesce(sum(case when ${asOfDate}::date - coalesce(${salesInvoices.dueDate}, ${salesInvoices.invoiceDate}) > 90 then ${salesInvoices.dueAmount} else 0 end), 0)`,
        totalOutstanding: sql<string>`coalesce(sum(${salesInvoices.dueAmount}), 0)`
      })
      .from(salesInvoices)
      .innerJoin(customers, eq(salesInvoices.customerId, customers.id))
      .where(and(...conditions))
      .groupBy(customers.id, customers.customerCode, customers.name)
      .orderBy(desc(sql`coalesce(sum(${salesInvoices.dueAmount}), 0)`), asc(customers.name));
  }

  public async listSuppliersOutstanding(companyId: string, filters: ReportFilters) {
    const invoiceConditions = this.buildPurchaseConditions(companyId, filters);
    const invoiceWhere = and(...invoiceConditions, eq(purchaseInvoices.supplierId, suppliers.id));

    return db
      .select({
        supplierId: suppliers.id,
        supplierCode: suppliers.supplierCode,
        supplierName: suppliers.name,
        mobile: suppliers.mobile,
        status: suppliers.status,
        outstandingAmount: sql<string>`
          CASE
            WHEN ${suppliers.openingBalanceType} = 'credit' THEN ${suppliers.openingBalanceAmount}
            WHEN ${suppliers.openingBalanceType} = 'debit' THEN (${suppliers.openingBalanceAmount} * -1)
            ELSE 0
          END + coalesce((
            select sum(${purchaseInvoices.dueAmount})
            from ${purchaseInvoices}
            where ${invoiceWhere}
          ), 0)
        `,
        overdueAmount: sql<string>`
          coalesce((
            select sum(${purchaseInvoices.dueAmount})
            from ${purchaseInvoices}
            where ${invoiceWhere}
              and ${purchaseInvoices.dueDate} is not null
              and ${purchaseInvoices.dueDate} < current_date
              and ${purchaseInvoices.dueAmount} > 0
          ), 0)
        `,
        invoiceCount: sql<number>`
          coalesce((
            select count(*)
            from ${purchaseInvoices}
            where ${invoiceWhere}
          ), 0)
        `
      })
      .from(suppliers)
      .where(and(eq(suppliers.companyId, companyId), isNull(suppliers.deletedAt)))
      .orderBy(desc(sql`
        CASE
          WHEN ${suppliers.openingBalanceType} = 'credit' THEN ${suppliers.openingBalanceAmount}
          WHEN ${suppliers.openingBalanceType} = 'debit' THEN (${suppliers.openingBalanceAmount} * -1)
          ELSE 0
        END + coalesce((
          select sum(${purchaseInvoices.dueAmount})
          from ${purchaseInvoices}
          where ${invoiceWhere}
        ), 0)
      `), asc(suppliers.name));
  }

  public async listSuppliersAging(companyId: string, filters: ReportFilters) {
    const conditions = this.buildPurchaseConditions(companyId, filters);
    conditions.push(sql`${purchaseInvoices.dueAmount} > 0`);
    const asOfDate = filters.dateTo ?? new Date();

    return db
      .select({
        supplierId: suppliers.id,
        supplierCode: suppliers.supplierCode,
        supplierName: suppliers.name,
        bucket0To30: sql<string>`coalesce(sum(case when ${asOfDate}::date - coalesce(${purchaseInvoices.dueDate}, ${purchaseInvoices.invoiceDate}) between 0 and 30 then ${purchaseInvoices.dueAmount} else 0 end), 0)`,
        bucket31To60: sql<string>`coalesce(sum(case when ${asOfDate}::date - coalesce(${purchaseInvoices.dueDate}, ${purchaseInvoices.invoiceDate}) between 31 and 60 then ${purchaseInvoices.dueAmount} else 0 end), 0)`,
        bucket61To90: sql<string>`coalesce(sum(case when ${asOfDate}::date - coalesce(${purchaseInvoices.dueDate}, ${purchaseInvoices.invoiceDate}) between 61 and 90 then ${purchaseInvoices.dueAmount} else 0 end), 0)`,
        bucketAbove90: sql<string>`coalesce(sum(case when ${asOfDate}::date - coalesce(${purchaseInvoices.dueDate}, ${purchaseInvoices.invoiceDate}) > 90 then ${purchaseInvoices.dueAmount} else 0 end), 0)`,
        totalOutstanding: sql<string>`coalesce(sum(${purchaseInvoices.dueAmount}), 0)`
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .where(and(...conditions))
      .groupBy(suppliers.id, suppliers.supplierCode, suppliers.name)
      .orderBy(desc(sql`coalesce(sum(${purchaseInvoices.dueAmount}), 0)`), asc(suppliers.name));
  }

  public async getIncomeSummary(companyId: string, filters: ReportFilters) {
    const conditions: SQL[] = [
      eq(journalEntries.companyId, companyId),
      eq(journalEntries.status, "posted"),
      eq(chartOfAccounts.accountType, "income")
    ];

    this.applyResolvedDateRange(conditions, journalEntries.entryDate, filters.dateFrom, filters.dateTo);

    const [row] = await db
      .select({
        accountCount: sql<number>`count(distinct ${chartOfAccounts.id})`,
        totalCredits: sql<string>`coalesce(sum(${journalEntryLines.credit}), 0)`,
        totalDebits: sql<string>`coalesce(sum(${journalEntryLines.debit}), 0)`,
        netIncome: sql<string>`coalesce(sum(${journalEntryLines.credit} - ${journalEntryLines.debit}), 0)`
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(and(...conditions));

    return row;
  }

  public async getIncomeMonthly(companyId: string, filters: ReportFilters) {
    const conditions: SQL[] = [
      eq(journalEntries.companyId, companyId),
      eq(journalEntries.status, "posted"),
      eq(chartOfAccounts.accountType, "income")
    ];

    this.applyResolvedDateRange(conditions, journalEntries.entryDate, filters.dateFrom, filters.dateTo);

    return db
      .select({
        month: sql<string>`to_char(${journalEntries.entryDate}, 'YYYY-MM')`,
        totalCredits: sql<string>`coalesce(sum(${journalEntryLines.credit}), 0)`,
        totalDebits: sql<string>`coalesce(sum(${journalEntryLines.debit}), 0)`,
        netIncome: sql<string>`coalesce(sum(${journalEntryLines.credit} - ${journalEntryLines.debit}), 0)`
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(and(...conditions))
      .groupBy(sql`to_char(${journalEntries.entryDate}, 'YYYY-MM')`)
      .orderBy(asc(sql`to_char(${journalEntries.entryDate}, 'YYYY-MM')`));
  }

  public async listInventoryExpiry(companyId: string, filters: PaginatedReportFilters) {
    const conditions: SQL[] = [
      eq(productBatches.companyId, companyId),
      isNull(productBatches.deletedAt),
      isNull(products.deletedAt),
      sql`${productBatches.expiryDate} is not null`
    ];

    if (filters.productId) {
      conditions.push(eq(productBatches.productId, filters.productId));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${productBatches.expiryDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${productBatches.expiryDate} <= ${filters.dateTo}`);
    }

    const whereClause = and(...conditions);

    const rows = await db
      .select({
        batchId: productBatches.id,
        batchNumber: productBatches.batchNumber,
        productId: productBatches.productId,
        productName: products.name,
        sku: products.sku,
        warehouseName: warehouses.name,
        expiryDate: productBatches.expiryDate,
        availableQuantity: sql<string>`coalesce(${stockBalances.availableQuantity}, 0)`,
        stockValue: sql<string>`coalesce(${stockBalances.stockValue}, 0)`,
        batchStatus: productBatches.status
      })
      .from(productBatches)
      .innerJoin(products, eq(productBatches.productId, products.id))
      .innerJoin(warehouses, eq(productBatches.warehouseId, warehouses.id))
      .leftJoin(
        stockBalances,
        and(eq(stockBalances.companyId, companyId), eq(stockBalances.batchId, productBatches.id))
      )
      .where(whereClause)
      .orderBy(asc(productBatches.expiryDate), asc(products.name))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(productBatches).innerJoin(products, eq(productBatches.productId, products.id)).where(whereClause);

    return {
      items: rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listInventoryLowStock(companyId: string, filters: ReportFilters) {
    const conditions: SQL[] = [
      eq(products.companyId, companyId),
      isNull(products.deletedAt),
      eq(products.stockTrackingEnabled, true)
    ];

    if (filters.productId) {
      conditions.push(eq(products.id, filters.productId));
    }

    if (filters.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }

    return db
      .select({
        productId: products.id,
        productCode: products.productCode,
        productName: products.name,
        sku: products.sku,
        categoryName: productCategories.name,
        minimumStockLevel: products.minimumStockLevel,
        reorderLevel: products.reorderLevel,
        availableQuantity: sql<string>`coalesce(sum(${stockBalances.availableQuantity}), 0)`,
        stockValue: sql<string>`coalesce(sum(${stockBalances.stockValue}), 0)`
      })
      .from(products)
      .innerJoin(productCategories, eq(products.categoryId, productCategories.id))
      .leftJoin(
        stockBalances,
        and(eq(stockBalances.companyId, companyId), eq(stockBalances.productId, products.id))
      )
      .where(and(...conditions))
      .groupBy(
        products.id,
        products.productCode,
        products.name,
        products.sku,
        productCategories.name,
        products.minimumStockLevel,
        products.reorderLevel
      )
      .having(sql`coalesce(sum(${stockBalances.availableQuantity}), 0) <= ${products.reorderLevel}`)
      .orderBy(asc(sql`coalesce(sum(${stockBalances.availableQuantity}), 0)`), asc(products.name));
  }
}

export const reportsRepository = new ReportsRepository();
