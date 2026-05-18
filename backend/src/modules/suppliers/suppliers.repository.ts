import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  ne,
  or,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "../../db";
import { purchaseInvoices, purchasePayments, purchaseReturns, suppliers } from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type ListSuppliersParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null;
  status?: "active" | "inactive" | "blocked" | "deleted";
  supplierType?: "individual" | "business" | "manufacturer" | "distributor" | "wholesaler";
  taxType?: "registered" | "unregistered" | "composition";
  hasOutstanding?: boolean;
  isBlacklisted?: boolean;
  isPreferred?: boolean;
  sortBy: "name" | "createdAt" | "outstandingPayable" | "supplierCode";
  sortOrder: "asc" | "desc";
};

type ExportSuppliersParams = Omit<ListSuppliersParams, "page" | "limit">;

type SupplierTransactionTotals = {
  totalPurchases: string;
  totalPurchaseReturns: string;
  totalPaymentsMade: string;
  debitAdjustments: string;
  creditAdjustments: string;
  overduePayable: string;
  dueInvoicesCount: number;
};

class SuppliersRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private getOutstandingSql() {
    return sql<string>`
      CASE
        WHEN ${suppliers.openingBalanceType} = 'credit' THEN ${suppliers.openingBalanceAmount}
        WHEN ${suppliers.openingBalanceType} = 'debit' THEN (${suppliers.openingBalanceAmount} * -1)
        ELSE 0
      END
    `;
  }

  private buildListConditions(params: Omit<ListSuppliersParams, "page" | "limit" | "sortBy" | "sortOrder">) {
    const conditions: SQL[] = [eq(suppliers.companyId, params.companyId)];
    const outstandingSql = this.getOutstandingSql();

    if (params.status === "deleted") {
      conditions.push(eq(suppliers.status, "deleted"));
    } else {
      conditions.push(isNull(suppliers.deletedAt));

      if (params.status) {
        conditions.push(eq(suppliers.status, params.status));
      }
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(suppliers.name, searchPattern),
          ilike(suppliers.mobile, searchPattern),
          ilike(suppliers.email, searchPattern),
          ilike(suppliers.gstNumber, searchPattern),
          ilike(suppliers.supplierCode, searchPattern),
          ilike(suppliers.businessName, searchPattern)
        )!
      );
    }

    if (params.supplierType) {
      conditions.push(eq(suppliers.supplierType, params.supplierType));
    }

    if (params.taxType) {
      conditions.push(eq(suppliers.taxType, params.taxType));
    }

    if (params.hasOutstanding !== undefined) {
      conditions.push(params.hasOutstanding ? sql`${outstandingSql} <> 0` : sql`${outstandingSql} = 0`);
    }

    if (params.isBlacklisted !== undefined) {
      conditions.push(eq(suppliers.isBlacklisted, params.isBlacklisted));
    }

    if (params.isPreferred !== undefined) {
      conditions.push(eq(suppliers.isPreferred, params.isPreferred));
    }

    return conditions;
  }

  private getListOrderBy(sortBy: ListSuppliersParams["sortBy"], sortOrder: ListSuppliersParams["sortOrder"]) {
    const sortDirection = sortOrder === "asc" ? asc : desc;
    const outstandingSql = this.getOutstandingSql();

    if (sortBy === "name") {
      return [sortDirection(suppliers.name), desc(suppliers.createdAt)] as const;
    }

    if (sortBy === "supplierCode") {
      return [sortDirection(suppliers.supplierCode), desc(suppliers.createdAt)] as const;
    }

    if (sortBy === "outstandingPayable") {
      return [sortDirection(outstandingSql), asc(suppliers.name)] as const;
    }

    return [sortDirection(suppliers.createdAt), asc(suppliers.name)] as const;
  }

  public async acquireSupplierCodeLock(companyId: string, executor?: DbExecutor): Promise<void> {
    await this
      .getExecutor(executor)
      .execute(sql`select pg_advisory_xact_lock(hashtext(${`supplier-code:${companyId}`}))`);
  }

  public async findLatestSupplierCode(companyId: string, executor?: DbExecutor): Promise<string | null> {
    const [row] = await this
      .getExecutor(executor)
      .select({ supplierCode: suppliers.supplierCode })
      .from(suppliers)
      .where(eq(suppliers.companyId, companyId))
      .orderBy(desc(suppliers.supplierCode))
      .limit(1);

    return row?.supplierCode ?? null;
  }

  public async findById(companyId: string, supplierId: string, includeDeleted = false, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(suppliers.companyId, companyId), eq(suppliers.id, supplierId)];

    if (!includeDeleted) {
      conditions.push(isNull(suppliers.deletedAt));
    }

    const [supplier] = await this
      .getExecutor(executor)
      .select()
      .from(suppliers)
      .where(and(...conditions))
      .limit(1);

    return supplier ?? null;
  }

  public async findByMobile(companyId: string, mobile: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(suppliers.companyId, companyId),
      eq(suppliers.mobile, mobile),
      isNull(suppliers.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(suppliers.id, excludeId));
    }

    const [supplier] = await this
      .getExecutor(executor)
      .select()
      .from(suppliers)
      .where(and(...conditions))
      .limit(1);

    return supplier ?? null;
  }

  public async findByEmail(companyId: string, email: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(suppliers.companyId, companyId),
      eq(suppliers.email, email),
      isNull(suppliers.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(suppliers.id, excludeId));
    }

    const [supplier] = await this
      .getExecutor(executor)
      .select()
      .from(suppliers)
      .where(and(...conditions))
      .limit(1);

    return supplier ?? null;
  }

  public async createSupplier(data: typeof suppliers.$inferInsert, executor?: DbExecutor) {
    const [supplier] = await this.getExecutor(executor).insert(suppliers).values(data).returning();
    return supplier ?? null;
  }

  public async updateSupplier(
    companyId: string,
    supplierId: string,
    data: Partial<typeof suppliers.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [supplier] = await this
      .getExecutor(executor)
      .update(suppliers)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(suppliers.companyId, companyId), eq(suppliers.id, supplierId), isNull(suppliers.deletedAt)))
      .returning();

    return supplier ?? null;
  }

  public async softDeleteSupplier(companyId: string, supplierId: string, actorId: string, executor?: DbExecutor) {
    const [supplier] = await this
      .getExecutor(executor)
      .update(suppliers)
      .set({
        status: "deleted",
        updatedBy: actorId,
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(suppliers.companyId, companyId), eq(suppliers.id, supplierId), isNull(suppliers.deletedAt)))
      .returning();

    return supplier ?? null;
  }

  public async listSuppliers(params: ListSuppliersParams) {
    const outstandingPayable = this.getOutstandingSql();
    const conditions = this.buildListConditions(params);
    const whereClause = and(...conditions);
    const orderBy = this.getListOrderBy(params.sortBy, params.sortOrder);

    const rows = await db
      .select({
        id: suppliers.id,
        supplierCode: suppliers.supplierCode,
        name: suppliers.name,
        supplierType: suppliers.supplierType,
        businessName: suppliers.businessName,
        mobile: suppliers.mobile,
        email: suppliers.email,
        gstNumber: suppliers.gstNumber,
        taxType: suppliers.taxType,
        status: suppliers.status,
        isBlacklisted: suppliers.isBlacklisted,
        isPreferred: suppliers.isPreferred,
        openingBalanceAmount: suppliers.openingBalanceAmount,
        openingBalanceType: suppliers.openingBalanceType,
        creditLimit: suppliers.creditLimit,
        creditDays: suppliers.creditDays,
        createdAt: suppliers.createdAt,
        updatedAt: suppliers.updatedAt,
        outstandingPayable
      })
      .from(suppliers)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const [totalRow] = await db.select({ value: count() }).from(suppliers).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listSuppliersForExport(params: ExportSuppliersParams) {
    const conditions = this.buildListConditions(params);
    const whereClause = and(...conditions);
    const orderBy = this.getListOrderBy(params.sortBy, params.sortOrder);

    return db.select().from(suppliers).where(whereClause).orderBy(...orderBy);
  }

  public async getSupplierTransactionTotals(
    companyId: string,
    supplierId: string
  ): Promise<SupplierTransactionTotals> {
    const [purchaseRow] = await db
      .select({
        totalPurchases: sql<string>`coalesce(sum(${purchaseInvoices.grandTotal}), 0)`,
        overduePayable: sql<string>`coalesce(sum(case when ${purchaseInvoices.dueDate} < current_date and ${purchaseInvoices.dueAmount} > 0 then ${purchaseInvoices.dueAmount} else 0 end), 0)`,
        dueInvoicesCount: sql<number>`coalesce(sum(case when ${purchaseInvoices.dueAmount} > 0 then 1 else 0 end), 0)`
      })
      .from(purchaseInvoices)
      .where(
        and(
          eq(purchaseInvoices.companyId, companyId),
          eq(purchaseInvoices.supplierId, supplierId),
          isNull(purchaseInvoices.deletedAt),
          or(eq(purchaseInvoices.purchaseStatus, "posted"), eq(purchaseInvoices.purchaseStatus, "returned"))!
        )
      );

    const [returnRow] = await db
      .select({
        totalPurchaseReturns: sql<string>`coalesce(sum(${purchaseReturns.grandTotal}), 0)`
      })
      .from(purchaseReturns)
      .where(and(eq(purchaseReturns.companyId, companyId), eq(purchaseReturns.supplierId, supplierId)));

    const [paymentRow] = await db
      .select({
        totalPaymentsMade: sql<string>`coalesce(sum(${purchasePayments.amount}), 0)`
      })
      .from(purchasePayments)
      .where(and(eq(purchasePayments.companyId, companyId), eq(purchasePayments.supplierId, supplierId)));

    return {
      totalPurchases: purchaseRow?.totalPurchases ?? "0.00",
      totalPurchaseReturns: returnRow?.totalPurchaseReturns ?? "0.00",
      totalPaymentsMade: paymentRow?.totalPaymentsMade ?? "0.00",
      debitAdjustments: "0.00",
      creditAdjustments: "0.00",
      overduePayable: purchaseRow?.overduePayable ?? "0.00",
      dueInvoicesCount: purchaseRow?.dueInvoicesCount ?? 0
    };
  }

  public async hasLinkedTransactions(companyId: string, supplierId: string): Promise<boolean> {
    const [invoiceRow, returnRow, paymentRow] = await Promise.all([
      db
        .select({ id: purchaseInvoices.id })
        .from(purchaseInvoices)
        .where(and(eq(purchaseInvoices.companyId, companyId), eq(purchaseInvoices.supplierId, supplierId), isNull(purchaseInvoices.deletedAt)))
        .limit(1),
      db
        .select({ id: purchaseReturns.id })
        .from(purchaseReturns)
        .where(and(eq(purchaseReturns.companyId, companyId), eq(purchaseReturns.supplierId, supplierId)))
        .limit(1),
      db
        .select({ id: purchasePayments.id })
        .from(purchasePayments)
        .where(and(eq(purchasePayments.companyId, companyId), eq(purchasePayments.supplierId, supplierId)))
        .limit(1)
    ]);

    return Boolean(invoiceRow[0] || returnRow[0] || paymentRow[0]);
  }

  public async listLedgerTransactions(
    companyId: string,
    supplierId: string,
    filters?: {
      dateFrom?: Date | undefined;
      dateTo?: Date | undefined;
      transactionType?: string | undefined;
    }
  ) {
    const purchaseConditions: SQL[] = [
      eq(purchaseInvoices.companyId, companyId),
      eq(purchaseInvoices.supplierId, supplierId),
      isNull(purchaseInvoices.deletedAt),
      or(eq(purchaseInvoices.purchaseStatus, "posted"), eq(purchaseInvoices.purchaseStatus, "returned"))!
    ];

    if (filters?.dateFrom) {
      purchaseConditions.push(sql`${purchaseInvoices.invoiceDate} >= ${filters.dateFrom}`);
    }

    if (filters?.dateTo) {
      purchaseConditions.push(sql`${purchaseInvoices.invoiceDate} <= ${filters.dateTo}`);
    }

    const returnConditions: SQL[] = [eq(purchaseReturns.companyId, companyId), eq(purchaseReturns.supplierId, supplierId)];
    if (filters?.dateFrom) {
      returnConditions.push(sql`${purchaseReturns.returnDate} >= ${filters.dateFrom}`);
    }

    if (filters?.dateTo) {
      returnConditions.push(sql`${purchaseReturns.returnDate} <= ${filters.dateTo}`);
    }

    const paymentConditions: SQL[] = [eq(purchasePayments.companyId, companyId), eq(purchasePayments.supplierId, supplierId)];
    if (filters?.dateFrom) {
      paymentConditions.push(sql`${purchasePayments.paymentDate} >= ${filters.dateFrom}`);
    }

    if (filters?.dateTo) {
      paymentConditions.push(sql`${purchasePayments.paymentDate} <= ${filters.dateTo}`);
    }

    const [purchaseRows, returnRows, paymentRows] = await Promise.all([
      !filters?.transactionType || filters.transactionType === "purchase"
        ? db
            .select({
              date: purchaseInvoices.invoiceDate,
              transactionType: sql<string>`'purchase'`,
              referenceNo: purchaseInvoices.purchaseNumber,
              description: sql<string>`concat('Purchase invoice ', ${purchaseInvoices.purchaseNumber})`,
              debit: sql<string>`'0.00'`,
              credit: purchaseInvoices.grandTotal,
              paymentMode: sql<string | null>`null`,
              remarks: purchaseInvoices.notes
            })
            .from(purchaseInvoices)
            .where(and(...purchaseConditions))
        : Promise.resolve([]),
      !filters?.transactionType || filters.transactionType === "purchase_return"
        ? db
            .select({
              date: purchaseReturns.returnDate,
              transactionType: sql<string>`'purchase_return'`,
              referenceNo: purchaseReturns.returnNumber,
              description: sql<string>`concat('Purchase return ', ${purchaseReturns.returnNumber})`,
              debit: purchaseReturns.grandTotal,
              credit: sql<string>`'0.00'`,
              paymentMode: sql<string | null>`null`,
              remarks: purchaseReturns.notes
            })
            .from(purchaseReturns)
            .where(and(...returnConditions))
        : Promise.resolve([]),
      !filters?.transactionType || filters.transactionType === "payment"
        ? db
            .select({
              date: purchasePayments.paymentDate,
              transactionType: sql<string>`'payment'`,
              referenceNo: purchasePayments.referenceNumber,
              description: sql<string>`concat('Purchase payment ', ${purchasePayments.paymentMode})`,
              debit: purchasePayments.amount,
              credit: sql<string>`'0.00'`,
              paymentMode: sql<string | null>`${purchasePayments.paymentMode}`,
              remarks: purchasePayments.notes
            })
            .from(purchasePayments)
            .where(and(...paymentConditions))
        : Promise.resolve([])
    ]);

    const rows = [...purchaseRows, ...returnRows, ...paymentRows]
      .map((row) => ({
        ...row,
        date: new Date(row.date)
      }))
      .sort((left, right) => left.date.getTime() - right.date.getTime());

    return {
      rows,
      total: rows.length
    };
  }

  public async listPurchaseHistory(
    companyId: string,
    supplierId: string,
    filters?: {
      dateFrom?: Date | undefined;
      dateTo?: Date | undefined;
      status?: string | null | undefined;
    }
  ) {
    const conditions: SQL[] = [
      eq(purchaseInvoices.companyId, companyId),
      eq(purchaseInvoices.supplierId, supplierId),
      isNull(purchaseInvoices.deletedAt),
      ne(purchaseInvoices.purchaseStatus, "draft")
    ];

    if (filters?.dateFrom) {
      conditions.push(sql`${purchaseInvoices.invoiceDate} >= ${filters.dateFrom}`);
    }

    if (filters?.dateTo) {
      conditions.push(sql`${purchaseInvoices.invoiceDate} <= ${filters.dateTo}`);
    }

    if (filters?.status) {
      conditions.push(eq(purchaseInvoices.purchaseStatus, filters.status as typeof purchaseInvoices.$inferSelect.purchaseStatus));
    }

    const rows = await db
      .select({
        id: purchaseInvoices.id,
        date: purchaseInvoices.invoiceDate,
        referenceNo: purchaseInvoices.purchaseNumber,
        status: purchaseInvoices.purchaseStatus,
        grossAmount: purchaseInvoices.grandTotal,
        returnAmount: sql<string>`coalesce((
          select sum(${purchaseReturns.grandTotal})
          from ${purchaseReturns}
          where ${purchaseReturns.purchaseInvoiceId} = ${purchaseInvoices.id}
        ), 0)`,
        remarks: purchaseInvoices.notes
      })
      .from(purchaseInvoices)
      .where(and(...conditions))
      .orderBy(desc(purchaseInvoices.invoiceDate), desc(purchaseInvoices.createdAt));

    const [purchaseTotals, returnTotals] = await Promise.all([
      db
        .select({
          totalPurchases: sql<string>`coalesce(sum(${purchaseInvoices.grandTotal}), 0)`,
          total: count()
        })
        .from(purchaseInvoices)
        .where(and(...conditions)),
      db
        .select({
          totalPurchaseReturns: sql<string>`coalesce(sum(${purchaseReturns.grandTotal}), 0)`
        })
        .from(purchaseReturns)
        .innerJoin(purchaseInvoices, eq(purchaseReturns.purchaseInvoiceId, purchaseInvoices.id))
        .where(and(eq(purchaseReturns.companyId, companyId), eq(purchaseReturns.supplierId, supplierId)))
    ]);

    return {
      rows,
      total: purchaseTotals[0]?.total ?? 0,
      totalPurchases: purchaseTotals[0]?.totalPurchases ?? "0.00",
      totalPurchaseReturns: returnTotals[0]?.totalPurchaseReturns ?? "0.00"
    };
  }

  public async listPaymentHistory(
    companyId: string,
    supplierId: string,
    filters?: { dateFrom?: Date | undefined; dateTo?: Date | undefined }
  ) {
    const conditions: SQL[] = [eq(purchasePayments.companyId, companyId), eq(purchasePayments.supplierId, supplierId)];

    if (filters?.dateFrom) {
      conditions.push(sql`${purchasePayments.paymentDate} >= ${filters.dateFrom}`);
    }

    if (filters?.dateTo) {
      conditions.push(sql`${purchasePayments.paymentDate} <= ${filters.dateTo}`);
    }

    const rows = await db
      .select({
        id: purchasePayments.id,
        date: purchasePayments.paymentDate,
        referenceNo: purchasePayments.referenceNumber,
        amount: purchasePayments.amount,
        paymentMode: sql<string | null>`${purchasePayments.paymentMode}`,
        remarks: purchasePayments.notes
      })
      .from(purchasePayments)
      .where(and(...conditions))
      .orderBy(desc(purchasePayments.paymentDate), desc(purchasePayments.createdAt));

    const [totalRow] = await db
      .select({
        total: count(),
        totalAmount: sql<string>`coalesce(sum(${purchasePayments.amount}), 0)`
      })
      .from(purchasePayments)
      .where(and(...conditions));

    return {
      rows,
      total: totalRow?.total ?? 0,
      totalAmount: totalRow?.totalAmount ?? "0.00"
    };
  }
}

export const suppliersRepository = new SuppliersRepository();
