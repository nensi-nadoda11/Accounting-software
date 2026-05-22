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
  productBatches,
  products,
  purchaseInvoiceItems,
  purchaseInvoices,
  purchasePayments,
  purchaseReturnRefunds,
  purchaseReturnItems,
  purchaseReturns,
  suppliers,
  warehouses
} from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type PurchaseListFilters = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  purchaseStatus?: typeof purchaseInvoices.$inferSelect.purchaseStatus | undefined;
  paymentStatus?: typeof purchaseInvoices.$inferSelect.paymentStatus | undefined;
  supplierId?: string | undefined;
  warehouseId?: string | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
};

type PurchaseReturnListFilters = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  supplierId?: string | undefined;
  purchaseInvoiceId?: string | undefined;
  warehouseId?: string | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
};

class PurchasesRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private buildPurchaseConditions(filters: Omit<PurchaseListFilters, "page" | "limit">) {
    const conditions: SQL[] = [eq(purchaseInvoices.companyId, filters.companyId), isNull(purchaseInvoices.deletedAt)];

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(purchaseInvoices.purchaseNumber, searchPattern),
          ilike(purchaseInvoices.supplierInvoiceNumber, searchPattern),
          ilike(suppliers.name, searchPattern)
        )!
      );
    }

    if (filters.purchaseStatus) {
      conditions.push(eq(purchaseInvoices.purchaseStatus, filters.purchaseStatus));
    }

    if (filters.paymentStatus) {
      conditions.push(eq(purchaseInvoices.paymentStatus, filters.paymentStatus));
    }

    if (filters.supplierId) {
      conditions.push(eq(purchaseInvoices.supplierId, filters.supplierId));
    }

    if (filters.warehouseId) {
      conditions.push(eq(purchaseInvoices.warehouseId, filters.warehouseId));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${purchaseInvoices.invoiceDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${purchaseInvoices.invoiceDate} <= ${filters.dateTo}`);
    }

    return conditions;
  }

  private buildPurchaseReturnConditions(filters: Omit<PurchaseReturnListFilters, "page" | "limit">) {
    const conditions: SQL[] = [eq(purchaseReturns.companyId, filters.companyId)];

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(purchaseReturns.returnNumber, searchPattern),
          ilike(purchaseInvoices.purchaseNumber, searchPattern),
          ilike(suppliers.name, searchPattern)
        )!
      );
    }

    if (filters.supplierId) {
      conditions.push(eq(purchaseReturns.supplierId, filters.supplierId));
    }

    if (filters.purchaseInvoiceId) {
      conditions.push(eq(purchaseReturns.purchaseInvoiceId, filters.purchaseInvoiceId));
    }

    if (filters.warehouseId) {
      conditions.push(eq(purchaseReturns.warehouseId, filters.warehouseId));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${purchaseReturns.returnDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${purchaseReturns.returnDate} <= ${filters.dateTo}`);
    }

    return conditions;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findLatestPurchaseNumber(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ purchaseNumber: purchaseInvoices.purchaseNumber })
      .from(purchaseInvoices)
      .where(eq(purchaseInvoices.companyId, companyId))
      .orderBy(desc(purchaseInvoices.purchaseNumber))
      .limit(1);

    return row?.purchaseNumber ?? null;
  }

  public async findLatestReturnNumber(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ returnNumber: purchaseReturns.returnNumber })
      .from(purchaseReturns)
      .where(eq(purchaseReturns.companyId, companyId))
      .orderBy(desc(purchaseReturns.returnNumber))
      .limit(1);

    return row?.returnNumber ?? null;
  }

  public async findPurchaseById(companyId: string, purchaseId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(purchaseInvoices)
      .where(and(eq(purchaseInvoices.companyId, companyId), eq(purchaseInvoices.id, purchaseId), isNull(purchaseInvoices.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findPurchaseByNumber(companyId: string, purchaseNumber: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(purchaseInvoices.companyId, companyId),
      eq(purchaseInvoices.purchaseNumber, purchaseNumber),
      isNull(purchaseInvoices.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(purchaseInvoices.id, excludeId));
    }

    const [row] = await this.getExecutor(executor).select().from(purchaseInvoices).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async findSupplierInvoiceDuplicate(
    companyId: string,
    supplierId: string,
    supplierInvoiceNumber: string,
    excludeId?: string,
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [
      eq(purchaseInvoices.companyId, companyId),
      eq(purchaseInvoices.supplierId, supplierId),
      eq(purchaseInvoices.supplierInvoiceNumber, supplierInvoiceNumber),
      isNull(purchaseInvoices.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(purchaseInvoices.id, excludeId));
    }

    const [row] = await this.getExecutor(executor).select().from(purchaseInvoices).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async createPurchaseInvoice(data: typeof purchaseInvoices.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(purchaseInvoices).values(data).returning();
    return row ?? null;
  }

  public async updatePurchaseInvoice(
    companyId: string,
    purchaseId: string,
    data: Partial<typeof purchaseInvoices.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(purchaseInvoices)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(purchaseInvoices.companyId, companyId), eq(purchaseInvoices.id, purchaseId), isNull(purchaseInvoices.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async softDeletePurchaseInvoice(companyId: string, purchaseId: string, actorId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(purchaseInvoices)
      .set({
        updatedBy: actorId,
        updatedAt: new Date(),
        deletedAt: new Date()
      })
      .where(and(eq(purchaseInvoices.companyId, companyId), eq(purchaseInvoices.id, purchaseId), isNull(purchaseInvoices.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async listPurchaseInvoiceItems(companyId: string, purchaseInvoiceId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        item: purchaseInvoiceItems,
        product: products,
        batchNumber: productBatches.batchNumber,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(purchaseInvoiceItems)
      .innerJoin(products, eq(purchaseInvoiceItems.productId, products.id))
      .leftJoin(productBatches, eq(purchaseInvoiceItems.batchId, productBatches.id))
      .leftJoin(warehouses, eq(purchaseInvoiceItems.warehouseId, warehouses.id))
      .where(
        and(
          eq(purchaseInvoiceItems.companyId, companyId),
          eq(purchaseInvoiceItems.purchaseInvoiceId, purchaseInvoiceId)
        )
      )
      .orderBy(asc(purchaseInvoiceItems.lineNumber), asc(purchaseInvoiceItems.createdAt));
  }

  public async findPurchaseInvoiceItemById(companyId: string, purchaseInvoiceItemId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        item: purchaseInvoiceItems,
        product: products,
        batchNumber: productBatches.batchNumber,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(purchaseInvoiceItems)
      .innerJoin(products, eq(purchaseInvoiceItems.productId, products.id))
      .leftJoin(productBatches, eq(purchaseInvoiceItems.batchId, productBatches.id))
      .leftJoin(warehouses, eq(purchaseInvoiceItems.warehouseId, warehouses.id))
      .where(and(eq(purchaseInvoiceItems.companyId, companyId), eq(purchaseInvoiceItems.id, purchaseInvoiceItemId)))
      .limit(1);

    return row ?? null;
  }

  public async deletePurchaseInvoiceItems(companyId: string, purchaseInvoiceId: string, executor?: DbExecutor) {
    await this
      .getExecutor(executor)
      .delete(purchaseInvoiceItems)
      .where(and(eq(purchaseInvoiceItems.companyId, companyId), eq(purchaseInvoiceItems.purchaseInvoiceId, purchaseInvoiceId)));
  }

  public async createPurchaseInvoiceItems(data: Array<typeof purchaseInvoiceItems.$inferInsert>, executor?: DbExecutor) {
    if (data.length === 0) {
      return [];
    }

    return this.getExecutor(executor).insert(purchaseInvoiceItems).values(data).returning();
  }

  public async listPurchasePayments(
    companyId: string,
    purchaseInvoiceId: string,
    page?: number,
    limit?: number,
    executor?: DbExecutor
  ) {
    const query = this
      .getExecutor(executor)
      .select()
      .from(purchasePayments)
      .where(and(eq(purchasePayments.companyId, companyId), eq(purchasePayments.purchaseInvoiceId, purchaseInvoiceId)))
      .orderBy(desc(purchasePayments.paymentDate), desc(purchasePayments.createdAt));

    if (page && limit) {
      return query.limit(limit).offset((page - 1) * limit);
    }

    return query;
  }

  public async countPurchasePayments(companyId: string, purchaseInvoiceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ value: count() })
      .from(purchasePayments)
      .where(and(eq(purchasePayments.companyId, companyId), eq(purchasePayments.purchaseInvoiceId, purchaseInvoiceId)));

    return row?.value ?? 0;
  }

  public async createPurchasePayment(data: typeof purchasePayments.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(purchasePayments).values(data).returning();
    return row ?? null;
  }

  public async getInvoicePaymentTotals(companyId: string, purchaseInvoiceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        totalAmount: sql<string>`coalesce(sum(${purchasePayments.amount}), 0)`,
        paymentCount: count()
      })
      .from(purchasePayments)
      .where(and(eq(purchasePayments.companyId, companyId), eq(purchasePayments.purchaseInvoiceId, purchaseInvoiceId)));

    return {
      totalAmount: row?.totalAmount ?? "0.00",
      paymentCount: row?.paymentCount ?? 0
    };
  }

  public async createPurchaseReturn(data: typeof purchaseReturns.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(purchaseReturns).values(data).returning();
    return row ?? null;
  }

  public async createPurchaseReturnRefund(data: typeof purchaseReturnRefunds.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(purchaseReturnRefunds).values(data).returning();
    return row ?? null;
  }

  public async listPurchaseReturnRefunds(companyId: string, purchaseReturnId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(purchaseReturnRefunds)
      .where(and(eq(purchaseReturnRefunds.companyId, companyId), eq(purchaseReturnRefunds.purchaseReturnId, purchaseReturnId)))
      .orderBy(desc(purchaseReturnRefunds.refundDate), desc(purchaseReturnRefunds.createdAt));
  }

  public async updatePurchaseReturn(
    companyId: string,
    purchaseReturnId: string,
    data: Partial<typeof purchaseReturns.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(purchaseReturns)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(purchaseReturns.companyId, companyId), eq(purchaseReturns.id, purchaseReturnId)))
      .returning();

    return row ?? null;
  }

  public async createPurchaseReturnItems(data: Array<typeof purchaseReturnItems.$inferInsert>, executor?: DbExecutor) {
    if (data.length === 0) {
      return [];
    }

    return this.getExecutor(executor).insert(purchaseReturnItems).values(data).returning();
  }

  public async listPurchaseReturnItems(companyId: string, purchaseReturnId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        item: purchaseReturnItems,
        invoiceItem: purchaseInvoiceItems,
        product: products
      })
      .from(purchaseReturnItems)
      .innerJoin(purchaseInvoiceItems, eq(purchaseReturnItems.purchaseInvoiceItemId, purchaseInvoiceItems.id))
      .innerJoin(products, eq(purchaseReturnItems.productId, products.id))
      .where(and(eq(purchaseReturnItems.companyId, companyId), eq(purchaseReturnItems.purchaseReturnId, purchaseReturnId)));
  }

  public async findPurchaseReturnById(companyId: string, purchaseReturnId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(purchaseReturns)
      .where(and(eq(purchaseReturns.companyId, companyId), eq(purchaseReturns.id, purchaseReturnId)))
      .limit(1);

    return row ?? null;
  }

  public async getPurchaseReturnRefundTotals(companyId: string, purchaseReturnId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        refundedAmount: sql<string>`coalesce(sum(${purchaseReturnRefunds.amount}), 0)`,
        refundCount: count()
      })
      .from(purchaseReturnRefunds)
      .where(and(eq(purchaseReturnRefunds.companyId, companyId), eq(purchaseReturnRefunds.purchaseReturnId, purchaseReturnId)));

    return {
      refundedAmount: row?.refundedAmount ?? "0.00",
      refundCount: row?.refundCount ?? 0
    };
  }

  public async getInvoiceReturnRefundTotals(companyId: string, purchaseInvoiceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        refundedAmount: sql<string>`coalesce(sum(${purchaseReturnRefunds.amount}), 0)`,
        refundCount: count()
      })
      .from(purchaseReturnRefunds)
      .innerJoin(purchaseReturns, eq(purchaseReturnRefunds.purchaseReturnId, purchaseReturns.id))
      .where(
        and(
          eq(purchaseReturnRefunds.companyId, companyId),
          eq(purchaseReturns.purchaseInvoiceId, purchaseInvoiceId)
        )
      );

    return {
      refundedAmount: row?.refundedAmount ?? "0.00",
      refundCount: row?.refundCount ?? 0
    };
  }

  public async listPurchaseReturnSettlementRows(
    companyId: string,
    purchaseInvoiceIds: string[],
    executor?: DbExecutor
  ) {
    if (!purchaseInvoiceIds.length) {
      return [];
    }

    return this.getExecutor(executor)
      .select({
        purchaseReturnId: purchaseReturns.id,
        purchaseInvoiceId: purchaseReturns.purchaseInvoiceId,
        returnGrandTotal: purchaseReturns.grandTotal,
        returnDate: purchaseReturns.returnDate,
        createdAt: purchaseReturns.createdAt,
        invoiceGrandTotal: purchaseInvoices.grandTotal,
        invoicePaidAmount: purchaseInvoices.paidAmount
      })
      .from(purchaseReturns)
      .innerJoin(purchaseInvoices, eq(purchaseReturns.purchaseInvoiceId, purchaseInvoices.id))
      .where(and(eq(purchaseReturns.companyId, companyId), inArray(purchaseReturns.purchaseInvoiceId, purchaseInvoiceIds)))
      .orderBy(
        asc(purchaseReturns.purchaseInvoiceId),
        asc(purchaseReturns.returnDate),
        asc(purchaseReturns.createdAt),
        asc(purchaseReturns.id)
      );
  }

  public async getInvoiceReturnTotals(companyId: string, purchaseInvoiceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        grandTotal: sql<string>`coalesce(sum(${purchaseReturns.grandTotal}), 0)`,
        returnCount: count()
      })
      .from(purchaseReturns)
      .where(and(eq(purchaseReturns.companyId, companyId), eq(purchaseReturns.purchaseInvoiceId, purchaseInvoiceId)));

    return {
      grandTotal: row?.grandTotal ?? "0.00",
      returnCount: row?.returnCount ?? 0
    };
  }

  public async getReturnedQuantityByInvoiceItem(companyId: string, purchaseInvoiceItemId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        quantity: sql<string>`coalesce(sum(${purchaseReturnItems.quantity}), 0)`
      })
      .from(purchaseReturnItems)
      .where(and(eq(purchaseReturnItems.companyId, companyId), eq(purchaseReturnItems.purchaseInvoiceItemId, purchaseInvoiceItemId)));

    return row?.quantity ?? "0.000";
  }

  public async countPurchaseReturns(companyId: string, purchaseInvoiceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ value: count() })
      .from(purchaseReturns)
      .where(and(eq(purchaseReturns.companyId, companyId), eq(purchaseReturns.purchaseInvoiceId, purchaseInvoiceId)));

    return row?.value ?? 0;
  }

  public async createAccountingEvent(data: typeof accountingEvents.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(accountingEvents).values(data).returning();
    return row ?? null;
  }

  public async findPurchaseDetail(companyId: string, purchaseId: string) {
    const [row] = await db
      .select({
        invoice: purchaseInvoices,
        supplier: suppliers,
        warehouse: warehouses
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .leftJoin(warehouses, eq(purchaseInvoices.warehouseId, warehouses.id))
      .where(and(eq(purchaseInvoices.companyId, companyId), eq(purchaseInvoices.id, purchaseId), isNull(purchaseInvoices.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findPurchaseReturnDetail(companyId: string, purchaseReturnId: string) {
    const [row] = await db
      .select({
        purchaseReturn: purchaseReturns,
        invoice: purchaseInvoices,
        supplier: suppliers,
        warehouse: warehouses,
        refundedAmount: sql<string>`coalesce((
          select sum(${purchaseReturnRefunds.amount})
          from ${purchaseReturnRefunds}
          where ${purchaseReturnRefunds.purchaseReturnId} = ${purchaseReturns.id}
        ), 0)`,
        invoiceRefundedAmount: sql<string>`coalesce((
          select sum(${purchaseReturnRefunds.amount})
          from ${purchaseReturnRefunds}
          inner join ${purchaseReturns} as invoice_returns
            on invoice_returns.id = ${purchaseReturnRefunds.purchaseReturnId}
          where invoice_returns.purchase_invoice_id = ${purchaseReturns.purchaseInvoiceId}
            and invoice_returns.company_id = ${purchaseReturns.companyId}
        ), 0)`
      })
      .from(purchaseReturns)
      .innerJoin(purchaseInvoices, eq(purchaseReturns.purchaseInvoiceId, purchaseInvoices.id))
      .innerJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .leftJoin(warehouses, eq(purchaseReturns.warehouseId, warehouses.id))
      .where(and(eq(purchaseReturns.companyId, companyId), eq(purchaseReturns.id, purchaseReturnId)))
      .limit(1);

    return row ?? null;
  }

  public async listPurchases(filters: PurchaseListFilters) {
    const conditions = this.buildPurchaseConditions(filters);
    const whereClause = and(...conditions);

    const rows = await db
      .select({
        invoice: purchaseInvoices,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .leftJoin(warehouses, eq(purchaseInvoices.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(purchaseInvoices.invoiceDate), desc(purchaseInvoices.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .leftJoin(warehouses, eq(purchaseInvoices.warehouseId, warehouses.id))
      .where(whereClause);

    const [summaryRow] = await db
      .select({
        grandTotal: sql<string>`coalesce(sum(${purchaseInvoices.grandTotal}), 0)`,
        paidAmount: sql<string>`coalesce(sum(${purchaseInvoices.paidAmount}), 0)`,
        dueAmount: sql<string>`coalesce(sum(${purchaseInvoices.dueAmount}), 0)`
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .leftJoin(warehouses, eq(purchaseInvoices.warehouseId, warehouses.id))
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

  public async listPurchasesForExport(filters: Omit<PurchaseListFilters, "page" | "limit">) {
    const whereClause = and(...this.buildPurchaseConditions(filters));
    return db
      .select({
        invoice: purchaseInvoices,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .leftJoin(warehouses, eq(purchaseInvoices.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(purchaseInvoices.invoiceDate), desc(purchaseInvoices.createdAt));
  }

  public async listPurchaseReturns(filters: PurchaseReturnListFilters) {
    const whereClause = and(...this.buildPurchaseReturnConditions(filters));

    const rows = await db
      .select({
        purchaseReturn: purchaseReturns,
        invoicePaidAmount: purchaseInvoices.paidAmount,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode,
        purchaseNumber: purchaseInvoices.purchaseNumber,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        refundedAmount: sql<string>`coalesce((
          select sum(${purchaseReturnRefunds.amount})
          from ${purchaseReturnRefunds}
          where ${purchaseReturnRefunds.purchaseReturnId} = ${purchaseReturns.id}
        ), 0)`,
        invoiceRefundedAmount: sql<string>`coalesce((
          select sum(${purchaseReturnRefunds.amount})
          from ${purchaseReturnRefunds}
          inner join ${purchaseReturns} as invoice_returns
            on invoice_returns.id = ${purchaseReturnRefunds.purchaseReturnId}
          where invoice_returns.purchase_invoice_id = ${purchaseReturns.purchaseInvoiceId}
            and invoice_returns.company_id = ${purchaseReturns.companyId}
        ), 0)`
      })
      .from(purchaseReturns)
      .innerJoin(purchaseInvoices, eq(purchaseReturns.purchaseInvoiceId, purchaseInvoices.id))
      .innerJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .leftJoin(warehouses, eq(purchaseReturns.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(purchaseReturns.returnDate), desc(purchaseReturns.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(purchaseReturns)
      .innerJoin(purchaseInvoices, eq(purchaseReturns.purchaseInvoiceId, purchaseInvoices.id))
      .innerJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .leftJoin(warehouses, eq(purchaseReturns.warehouseId, warehouses.id))
      .where(whereClause);

    const [summaryRow] = await db
      .select({
        grandTotal: sql<string>`coalesce(sum(${purchaseReturns.grandTotal}), 0)`,
        refundedAmount: sql<string>`coalesce(sum((
          select coalesce(sum(${purchaseReturnRefunds.amount}), 0)
          from ${purchaseReturnRefunds}
          where ${purchaseReturnRefunds.purchaseReturnId} = ${purchaseReturns.id}
        )), 0)`
      })
      .from(purchaseReturns)
      .innerJoin(purchaseInvoices, eq(purchaseReturns.purchaseInvoiceId, purchaseInvoices.id))
      .innerJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .leftJoin(warehouses, eq(purchaseReturns.warehouseId, warehouses.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0,
      summary: {
        grandTotal: summaryRow?.grandTotal ?? "0.00",
        refundedAmount: summaryRow?.refundedAmount ?? "0.00"
      }
    };
  }

  public async listPurchaseReturnsForExport(filters: Omit<PurchaseReturnListFilters, "page" | "limit">) {
    const whereClause = and(...this.buildPurchaseReturnConditions(filters));
    return db
      .select({
        purchaseReturn: purchaseReturns,
        invoicePaidAmount: purchaseInvoices.paidAmount,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode,
        purchaseNumber: purchaseInvoices.purchaseNumber,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        refundedAmount: sql<string>`coalesce((
          select sum(${purchaseReturnRefunds.amount})
          from ${purchaseReturnRefunds}
          where ${purchaseReturnRefunds.purchaseReturnId} = ${purchaseReturns.id}
        ), 0)`,
        invoiceRefundedAmount: sql<string>`coalesce((
          select sum(${purchaseReturnRefunds.amount})
          from ${purchaseReturnRefunds}
          inner join ${purchaseReturns} as invoice_returns
            on invoice_returns.id = ${purchaseReturnRefunds.purchaseReturnId}
          where invoice_returns.purchase_invoice_id = ${purchaseReturns.purchaseInvoiceId}
            and invoice_returns.company_id = ${purchaseReturns.companyId}
        ), 0)`
      })
      .from(purchaseReturns)
      .innerJoin(purchaseInvoices, eq(purchaseReturns.purchaseInvoiceId, purchaseInvoices.id))
      .innerJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .leftJoin(warehouses, eq(purchaseReturns.warehouseId, warehouses.id))
      .where(whereClause)
      .orderBy(desc(purchaseReturns.returnDate), desc(purchaseReturns.createdAt));
  }

  public async getPurchaseNumbersByIds(companyId: string, purchaseIds: string[]) {
    if (purchaseIds.length === 0) {
      return new Map<string, string>();
    }

    const rows = await db
      .select({
        id: purchaseInvoices.id,
        purchaseNumber: purchaseInvoices.purchaseNumber
      })
      .from(purchaseInvoices)
      .where(and(eq(purchaseInvoices.companyId, companyId), inArray(purchaseInvoices.id, purchaseIds)));

    return rows.reduce<Map<string, string>>((map, row) => {
      map.set(row.id, row.purchaseNumber);
      return map;
    }, new Map());
  }
}

export const purchasesRepository = new PurchasesRepository();
