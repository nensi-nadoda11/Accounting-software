import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "../../db";
import {
  accountingEvents,
  customers,
  productBatches,
  products,
  salesInvoiceItems,
  salesInvoiceSendLogs,
  salesInvoices,
  salesPayments,
  salesReturnItems,
  salesReturns,
  stockBalances,
  warehouses
} from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type SalesListFilters = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  invoiceStatus?: typeof salesInvoices.$inferSelect.invoiceStatus | undefined;
  paymentStatus?: typeof salesInvoices.$inferSelect.paymentStatus | undefined;
  customerId?: string | undefined;
  warehouseId?: string | undefined;
  invoiceType?: typeof salesInvoices.$inferSelect.invoiceType | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
};

type SalesReturnListFilters = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  customerId?: string | undefined;
  salesInvoiceId?: string | undefined;
  warehouseId?: string | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
};

class SalesRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private buildInvoiceConditions(filters: Omit<SalesListFilters, "page" | "limit">) {
    const conditions: SQL[] = [eq(salesInvoices.companyId, filters.companyId), isNull(salesInvoices.deletedAt)];

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(salesInvoices.invoiceNumber, searchPattern),
          ilike(salesInvoices.customerNameSnapshot, searchPattern),
          ilike(salesInvoices.walkInMobile, searchPattern),
          ilike(salesInvoices.walkInName, searchPattern)
        )!
      );
    }

    if (filters.invoiceStatus) {
      conditions.push(eq(salesInvoices.invoiceStatus, filters.invoiceStatus));
    }

    if (filters.paymentStatus) {
      conditions.push(eq(salesInvoices.paymentStatus, filters.paymentStatus));
    }

    if (filters.customerId) {
      conditions.push(eq(salesInvoices.customerId, filters.customerId));
    }

    if (filters.warehouseId) {
      conditions.push(eq(salesInvoices.warehouseId, filters.warehouseId));
    }

    if (filters.invoiceType) {
      conditions.push(eq(salesInvoices.invoiceType, filters.invoiceType));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${salesInvoices.invoiceDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${salesInvoices.invoiceDate} <= ${filters.dateTo}`);
    }

    return conditions;
  }

  private buildReturnConditions(filters: Omit<SalesReturnListFilters, "page" | "limit">) {
    const conditions: SQL[] = [eq(salesReturns.companyId, filters.companyId)];

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(salesReturns.returnNumber, searchPattern),
          ilike(salesInvoices.invoiceNumber, searchPattern),
          ilike(salesInvoices.customerNameSnapshot, searchPattern),
          ilike(salesInvoices.walkInName, searchPattern)
        )!
      );
    }

    if (filters.customerId) {
      conditions.push(eq(salesReturns.customerId, filters.customerId));
    }

    if (filters.salesInvoiceId) {
      conditions.push(eq(salesReturns.salesInvoiceId, filters.salesInvoiceId));
    }

    if (filters.warehouseId) {
      conditions.push(eq(salesReturns.warehouseId, filters.warehouseId));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${salesReturns.returnDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${salesReturns.returnDate} <= ${filters.dateTo}`);
    }

    return conditions;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findLatestInvoiceNumber(
    companyId: string,
    invoiceType: typeof salesInvoices.$inferSelect.invoiceType,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .select({ invoiceNumber: salesInvoices.invoiceNumber })
      .from(salesInvoices)
      .where(and(eq(salesInvoices.companyId, companyId), eq(salesInvoices.invoiceType, invoiceType)))
      .orderBy(desc(salesInvoices.invoiceNumber))
      .limit(1);

    return row?.invoiceNumber ?? null;
  }

  public async findLatestReturnNumber(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ returnNumber: salesReturns.returnNumber })
      .from(salesReturns)
      .where(eq(salesReturns.companyId, companyId))
      .orderBy(desc(salesReturns.returnNumber))
      .limit(1);

    return row?.returnNumber ?? null;
  }

  public async findInvoiceById(companyId: string, invoiceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(salesInvoices)
      .where(and(eq(salesInvoices.companyId, companyId), eq(salesInvoices.id, invoiceId), isNull(salesInvoices.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findInvoiceByNumber(companyId: string, invoiceNumber: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(salesInvoices.companyId, companyId),
      eq(salesInvoices.invoiceNumber, invoiceNumber),
      isNull(salesInvoices.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(salesInvoices.id, excludeId));
    }

    const [row] = await this.getExecutor(executor).select().from(salesInvoices).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async createInvoice(data: typeof salesInvoices.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(salesInvoices).values(data).returning();
    return row ?? null;
  }

  public async updateInvoice(
    companyId: string,
    invoiceId: string,
    data: Partial<typeof salesInvoices.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(salesInvoices)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(salesInvoices.companyId, companyId), eq(salesInvoices.id, invoiceId), isNull(salesInvoices.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async softDeleteInvoice(companyId: string, invoiceId: string, actorId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(salesInvoices)
      .set({
        updatedBy: actorId,
        updatedAt: new Date(),
        deletedAt: new Date()
      })
      .where(and(eq(salesInvoices.companyId, companyId), eq(salesInvoices.id, invoiceId), isNull(salesInvoices.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async createInvoiceItems(data: Array<typeof salesInvoiceItems.$inferInsert>, executor?: DbExecutor) {
    if (data.length === 0) {
      return [];
    }

    return this.getExecutor(executor).insert(salesInvoiceItems).values(data).returning();
  }

  public async deleteInvoiceItems(companyId: string, invoiceId: string, executor?: DbExecutor) {
    await this
      .getExecutor(executor)
      .delete(salesInvoiceItems)
      .where(and(eq(salesInvoiceItems.companyId, companyId), eq(salesInvoiceItems.salesInvoiceId, invoiceId)));
  }

  public async listInvoiceItems(companyId: string, invoiceId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        item: salesInvoiceItems,
        product: products,
        batchNumber: productBatches.batchNumber,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(salesInvoiceItems)
      .innerJoin(products, eq(salesInvoiceItems.productId, products.id))
      .leftJoin(productBatches, eq(salesInvoiceItems.batchId, productBatches.id))
      .leftJoin(warehouses, eq(salesInvoiceItems.warehouseId, warehouses.id))
      .where(and(eq(salesInvoiceItems.companyId, companyId), eq(salesInvoiceItems.salesInvoiceId, invoiceId)))
      .orderBy(asc(salesInvoiceItems.lineNumber), asc(salesInvoiceItems.createdAt));
  }

  public async findInvoiceItemById(companyId: string, invoiceItemId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        item: salesInvoiceItems,
        product: products,
        batchNumber: productBatches.batchNumber,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(salesInvoiceItems)
      .innerJoin(products, eq(salesInvoiceItems.productId, products.id))
      .leftJoin(productBatches, eq(salesInvoiceItems.batchId, productBatches.id))
      .leftJoin(warehouses, eq(salesInvoiceItems.warehouseId, warehouses.id))
      .where(and(eq(salesInvoiceItems.companyId, companyId), eq(salesInvoiceItems.id, invoiceItemId)))
      .limit(1);

    return row ?? null;
  }

  public async updateInvoiceItemReturnedQuantity(
    companyId: string,
    invoiceItemId: string,
    returnedQuantity: string,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(salesInvoiceItems)
      .set({
        returnedQuantity
      })
      .where(and(eq(salesInvoiceItems.companyId, companyId), eq(salesInvoiceItems.id, invoiceItemId)))
      .returning();

    return row ?? null;
  }

  public async createPayment(data: typeof salesPayments.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(salesPayments).values(data).returning();
    return row ?? null;
  }

  public async listPayments(companyId: string, invoiceId: string, page?: number, limit?: number, executor?: DbExecutor) {
    const query = this
      .getExecutor(executor)
      .select()
      .from(salesPayments)
      .where(and(eq(salesPayments.companyId, companyId), eq(salesPayments.salesInvoiceId, invoiceId)))
      .orderBy(desc(salesPayments.paymentDate), desc(salesPayments.createdAt));

    if (page && limit) {
      return query.limit(limit).offset((page - 1) * limit);
    }

    return query;
  }

  public async countPayments(companyId: string, invoiceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ value: count() })
      .from(salesPayments)
      .where(and(eq(salesPayments.companyId, companyId), eq(salesPayments.salesInvoiceId, invoiceId)));

    return row?.value ?? 0;
  }

  public async getPaymentTotals(companyId: string, invoiceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        totalAmount: sql<string>`coalesce(sum(${salesPayments.amount}), 0)`,
        paymentCount: count()
      })
      .from(salesPayments)
      .where(and(eq(salesPayments.companyId, companyId), eq(salesPayments.salesInvoiceId, invoiceId)));

    return {
      totalAmount: row?.totalAmount ?? "0.00",
      paymentCount: row?.paymentCount ?? 0
    };
  }

  public async createReturn(data: typeof salesReturns.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(salesReturns).values(data).returning();
    return row ?? null;
  }

  public async createReturnItems(data: Array<typeof salesReturnItems.$inferInsert>, executor?: DbExecutor) {
    if (data.length === 0) {
      return [];
    }

    return this.getExecutor(executor).insert(salesReturnItems).values(data).returning();
  }

  public async listReturnItems(companyId: string, returnId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        item: salesReturnItems,
        invoiceItem: salesInvoiceItems,
        product: products
      })
      .from(salesReturnItems)
      .innerJoin(salesInvoiceItems, eq(salesReturnItems.salesInvoiceItemId, salesInvoiceItems.id))
      .innerJoin(products, eq(salesReturnItems.productId, products.id))
      .where(and(eq(salesReturnItems.companyId, companyId), eq(salesReturnItems.salesReturnId, returnId)));
  }

  public async getReturnedQuantityByInvoiceItem(companyId: string, invoiceItemId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        quantity: sql<string>`coalesce(sum(${salesReturnItems.quantity}), 0)`
      })
      .from(salesReturnItems)
      .where(and(eq(salesReturnItems.companyId, companyId), eq(salesReturnItems.salesInvoiceItemId, invoiceItemId)));

    return row?.quantity ?? "0.000";
  }

  public async countReturns(companyId: string, invoiceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ value: count() })
      .from(salesReturns)
      .where(and(eq(salesReturns.companyId, companyId), eq(salesReturns.salesInvoiceId, invoiceId)));

    return row?.value ?? 0;
  }

  public async getReturnTotals(companyId: string, invoiceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        grandTotal: sql<string>`coalesce(sum(${salesReturns.grandTotal}), 0)`,
        returnCount: count()
      })
      .from(salesReturns)
      .where(and(eq(salesReturns.companyId, companyId), eq(salesReturns.salesInvoiceId, invoiceId)));

    return {
      grandTotal: row?.grandTotal ?? "0.00",
      returnCount: row?.returnCount ?? 0
    };
  }

  public async createSendLog(data: typeof salesInvoiceSendLogs.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(salesInvoiceSendLogs).values(data).returning();
    return row ?? null;
  }

  public async listSendLogs(companyId: string, invoiceId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(salesInvoiceSendLogs)
      .where(and(eq(salesInvoiceSendLogs.companyId, companyId), eq(salesInvoiceSendLogs.salesInvoiceId, invoiceId)))
      .orderBy(desc(salesInvoiceSendLogs.createdAt));
  }

  public async createAccountingEvent(data: typeof accountingEvents.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(accountingEvents).values(data).returning();
    return row ?? null;
  }

  public async findInvoiceDetail(companyId: string, invoiceId: string) {
    const [row] = await db
      .select({
        invoice: salesInvoices,
        customer: customers,
        warehouse: warehouses
      })
      .from(salesInvoices)
      .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
      .innerJoin(warehouses, eq(salesInvoices.warehouseId, warehouses.id))
      .where(and(eq(salesInvoices.companyId, companyId), eq(salesInvoices.id, invoiceId), isNull(salesInvoices.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findReturnDetail(companyId: string, returnId: string) {
    const [row] = await db
      .select({
        salesReturn: salesReturns,
        invoice: salesInvoices,
        customer: customers,
        warehouse: warehouses
      })
      .from(salesReturns)
      .innerJoin(salesInvoices, eq(salesReturns.salesInvoiceId, salesInvoices.id))
      .leftJoin(customers, eq(salesReturns.customerId, customers.id))
      .innerJoin(warehouses, eq(salesReturns.warehouseId, warehouses.id))
      .where(and(eq(salesReturns.companyId, companyId), eq(salesReturns.id, returnId)))
      .limit(1);

    return row ?? null;
  }

  public async listInvoices(filters: SalesListFilters) {
    const whereClause = and(...this.buildInvoiceConditions(filters));

    const rows = await db
      .select({
        invoice: salesInvoices,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(salesInvoices)
      .innerJoin(warehouses, eq(salesInvoices.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(salesInvoices.invoiceDate), desc(salesInvoices.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(salesInvoices)
      .innerJoin(warehouses, eq(salesInvoices.warehouseId, warehouses.id))
      .where(whereClause);

    const [summaryRow] = await db
      .select({
        grandTotal: sql<string>`coalesce(sum(${salesInvoices.grandTotal}), 0)`,
        paidAmount: sql<string>`coalesce(sum(${salesInvoices.paidAmount}), 0)`,
        dueAmount: sql<string>`coalesce(sum(${salesInvoices.dueAmount}), 0)`
      })
      .from(salesInvoices)
      .innerJoin(warehouses, eq(salesInvoices.warehouseId, warehouses.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0,
      summary: {
        grandTotal: summaryRow?.grandTotal ?? "0.00",
        paidAmount: summaryRow?.paidAmount ?? "0.00",
        dueAmount: summaryRow?.dueAmount ?? "0.00"
      }
    };
  }

  public async listInvoicesForExport(filters: Omit<SalesListFilters, "page" | "limit">) {
    const whereClause = and(...this.buildInvoiceConditions(filters));
    return db
      .select({
        invoice: salesInvoices,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(salesInvoices)
      .innerJoin(warehouses, eq(salesInvoices.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(salesInvoices.invoiceDate), desc(salesInvoices.createdAt));
  }

  public async listReturns(filters: SalesReturnListFilters) {
    const whereClause = and(...this.buildReturnConditions(filters));

    const rows = await db
      .select({
        salesReturn: salesReturns,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerNameSnapshot: salesInvoices.customerNameSnapshot,
        walkInName: salesInvoices.walkInName,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(salesReturns)
      .innerJoin(salesInvoices, eq(salesReturns.salesInvoiceId, salesInvoices.id))
      .innerJoin(warehouses, eq(salesReturns.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(salesReturns.returnDate), desc(salesReturns.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(salesReturns)
      .innerJoin(salesInvoices, eq(salesReturns.salesInvoiceId, salesInvoices.id))
      .innerJoin(warehouses, eq(salesReturns.warehouseId, warehouses.id))
      .where(whereClause);

    const [summaryRow] = await db
      .select({
        grandTotal: sql<string>`coalesce(sum(${salesReturns.grandTotal}), 0)`
      })
      .from(salesReturns)
      .innerJoin(salesInvoices, eq(salesReturns.salesInvoiceId, salesInvoices.id))
      .innerJoin(warehouses, eq(salesReturns.warehouseId, warehouses.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0,
      summary: {
        grandTotal: summaryRow?.grandTotal ?? "0.00"
      }
    };
  }

  public async listReturnsForExport(filters: Omit<SalesReturnListFilters, "page" | "limit">) {
    const whereClause = and(...this.buildReturnConditions(filters));
    return db
      .select({
        salesReturn: salesReturns,
        invoiceNumber: salesInvoices.invoiceNumber,
        customerNameSnapshot: salesInvoices.customerNameSnapshot,
        walkInName: salesInvoices.walkInName,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(salesReturns)
      .innerJoin(salesInvoices, eq(salesReturns.salesInvoiceId, salesInvoices.id))
      .innerJoin(warehouses, eq(salesReturns.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(salesReturns.returnDate), desc(salesReturns.createdAt));
  }

  public async barcodeLookup(companyId: string, query: string, warehouseId?: string) {
    const exactRows = await db
      .select({
        product: products,
        unitName: sql<string | null>`null`,
        totalStock: sql<string>`coalesce(sum(${stockBalances.availableQuantity}), 0)`,
        warehouseCount: sql<number>`count(distinct ${stockBalances.warehouseId})`
      })
      .from(products)
      .leftJoin(
        stockBalances,
        and(
          eq(stockBalances.companyId, companyId),
          eq(stockBalances.productId, products.id),
          warehouseId ? eq(stockBalances.warehouseId, warehouseId) : sql`true`
        )
      )
      .where(
        and(
          eq(products.companyId, companyId),
          isNull(products.deletedAt),
          or(eq(products.barcode, query), eq(products.sku, query), eq(products.productCode, query))
        )
      )
      .groupBy(products.id)
      .orderBy(desc(products.updatedAt))
      .limit(10);

    if (exactRows.length > 0) {
      return exactRows;
    }

    const pattern = `%${query}%`;
    return db
      .select({
        product: products,
        unitName: sql<string | null>`null`,
        totalStock: sql<string>`coalesce(sum(${stockBalances.availableQuantity}), 0)`,
        warehouseCount: sql<number>`count(distinct ${stockBalances.warehouseId})`
      })
      .from(products)
      .leftJoin(
        stockBalances,
        and(
          eq(stockBalances.companyId, companyId),
          eq(stockBalances.productId, products.id),
          warehouseId ? eq(stockBalances.warehouseId, warehouseId) : sql`true`
        )
      )
      .where(
        and(
          eq(products.companyId, companyId),
          isNull(products.deletedAt),
          or(
            ilike(products.name, pattern),
            ilike(products.barcode, pattern),
            ilike(products.sku, pattern),
            ilike(products.productCode, pattern)
          )
        )
      )
      .groupBy(products.id)
      .orderBy(asc(products.name))
      .limit(10);
  }

  public async listInvoiceNumbersByIds(companyId: string, invoiceIds: string[]) {
    if (invoiceIds.length === 0) {
      return new Map<string, string>();
    }

    const rows = await db
      .select({
        id: salesInvoices.id,
        invoiceNumber: salesInvoices.invoiceNumber
      })
      .from(salesInvoices)
      .where(and(eq(salesInvoices.companyId, companyId), inArray(salesInvoices.id, invoiceIds)));

    return rows.reduce<Map<string, string>>((map, row) => {
      map.set(row.id, row.invoiceNumber);
      return map;
    }, new Map());
  }
}

export const salesRepository = new SalesRepository();
