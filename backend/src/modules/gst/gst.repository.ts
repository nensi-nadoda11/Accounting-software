import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "../../db";
import {
  expenses,
  gstAdjustments,
  gstItcStatus,
  gstMonthlySummaries,
  gstReportExports,
  purchaseInvoiceItems,
  purchaseInvoices,
  purchaseReturnItems,
  purchaseReturns,
  salesInvoiceItems,
  salesInvoices,
  salesReturnItems,
  salesReturns,
  suppliers
} from "../../db/schema";
import type { HsnSummaryRowInput } from "./gst.calculation";
import type {
  GstAdjustmentsQuery,
  GstHsnSummaryQuery,
  GstItcQuery,
  GstOutputTaxQuery,
  GstPurchasesQuery,
  GstSalesQuery,
  GstTaxSummaryQuery
} from "./gst.validator";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type DateRange = {
  dateFrom: Date;
  dateTo: Date;
};

type MonthlyTotalsRow = {
  month: string;
  taxableAmount: string;
  totalGstAmount: string;
};

const SALES_REPORT_STATUSES = ["posted", "returned", "partially_returned"] as const;
const PURCHASE_REPORT_STATUSES = ["posted", "returned"] as const;

export class GstRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findLatestAdjustmentNumber(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ adjustmentNumber: gstAdjustments.adjustmentNumber })
      .from(gstAdjustments)
      .where(eq(gstAdjustments.companyId, companyId))
      .orderBy(desc(gstAdjustments.adjustmentNumber))
      .limit(1);

    return row?.adjustmentNumber ?? null;
  }

  private buildSalesConditions(filters: GstSalesQuery & { companyId: string }): SQL[] {
    const conditions: SQL[] = [
      eq(salesInvoices.companyId, filters.companyId),
      isNull(salesInvoices.deletedAt),
      inArray(salesInvoices.invoiceStatus, SALES_REPORT_STATUSES),
      gte(salesInvoices.invoiceDate, filters.dateFrom),
      lte(salesInvoices.invoiceDate, filters.dateTo)
    ];

    if (filters.customerId) {
      conditions.push(eq(salesInvoices.customerId, filters.customerId));
    }

    if (filters.state) {
      conditions.push(ilike(salesInvoices.placeOfSupply, `%${filters.state}%`));
    }

    if (filters.invoiceType) {
      conditions.push(eq(salesInvoices.invoiceType, filters.invoiceType));
    }

    if (filters.partyType === "b2b") {
      conditions.push(sql`${salesInvoices.customerGstSnapshot} is not null and ${salesInvoices.customerGstSnapshot} <> ''`);
    }

    if (filters.partyType === "b2c") {
      conditions.push(sql`(${salesInvoices.customerGstSnapshot} is null or ${salesInvoices.customerGstSnapshot} = '')`);
    }

    return conditions;
  }

  private buildPurchasesConditions(filters: GstPurchasesQuery & { companyId: string }): SQL[] {
    const conditions: SQL[] = [
      eq(purchaseInvoices.companyId, filters.companyId),
      isNull(purchaseInvoices.deletedAt),
      inArray(purchaseInvoices.purchaseStatus, PURCHASE_REPORT_STATUSES),
      gte(purchaseInvoices.invoiceDate, filters.dateFrom),
      lte(purchaseInvoices.invoiceDate, filters.dateTo)
    ];

    if (filters.supplierId) {
      conditions.push(eq(purchaseInvoices.supplierId, filters.supplierId));
    }

    if (filters.state) {
      conditions.push(
        sql`coalesce(${suppliers.gstState}, ${suppliers.billingState}, ${suppliers.shippingState}, '') ilike ${`%${filters.state}%`}`
      );
    }

    if (filters.eligibilityStatus) {
      conditions.push(eq(gstItcStatus.eligibilityStatus, filters.eligibilityStatus));
    }

    if (filters.claimStatus) {
      conditions.push(eq(gstItcStatus.claimStatus, filters.claimStatus));
    }

    return conditions;
  }

  public async listPurchaseItcCandidates(companyId: string, range: DateRange, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        sourceId: purchaseInvoices.id,
        sourceNumber: purchaseInvoices.purchaseNumber,
        supplierGstin: suppliers.gstNumber,
        invoiceDate: purchaseInvoices.invoiceDate,
        taxableAmount: purchaseInvoices.taxableAmount,
        cgstAmount: purchaseInvoices.cgstTotal,
        sgstAmount: purchaseInvoices.sgstTotal,
        igstAmount: purchaseInvoices.igstTotal,
        cessAmount: purchaseInvoices.cessTotal,
        totalGstAmount: purchaseInvoices.gstTotal
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .where(
        and(
          eq(purchaseInvoices.companyId, companyId),
          isNull(purchaseInvoices.deletedAt),
          inArray(purchaseInvoices.purchaseStatus, PURCHASE_REPORT_STATUSES),
          gte(purchaseInvoices.invoiceDate, range.dateFrom),
          lte(purchaseInvoices.invoiceDate, range.dateTo),
          sql`${purchaseInvoices.gstTotal} > 0`
        )
      );
  }

  public async listExpenseItcCandidates(companyId: string, range: DateRange, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        sourceId: expenses.id,
        sourceNumber: expenses.expenseNumber,
        supplierGstin: expenses.vendorGstNumber,
        invoiceDate: expenses.expenseDate,
        taxableAmount: expenses.taxableAmount,
        cgstAmount: expenses.cgstAmount,
        sgstAmount: expenses.sgstAmount,
        igstAmount: expenses.igstAmount,
        cessAmount: sql<string>`0`,
        totalGstAmount: expenses.gstAmount
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.companyId, companyId),
          isNull(expenses.deletedAt),
          eq(expenses.status, "posted"),
          eq(expenses.gstApplicable, true),
          gte(expenses.expenseDate, range.dateFrom),
          lte(expenses.expenseDate, range.dateTo),
          sql`${expenses.gstAmount} > 0`
        )
      );
  }

  public async upsertItcStatuses(
    entries: Array<typeof gstItcStatus.$inferInsert>,
    executor?: DbExecutor
  ) {
    if (entries.length === 0) {
      return [];
    }

    return this
      .getExecutor(executor)
      .insert(gstItcStatus)
      .values(entries)
      .onConflictDoUpdate({
        target: [gstItcStatus.companyId, gstItcStatus.sourceType, gstItcStatus.sourceId],
        set: {
          sourceNumber: sql`excluded.source_number`,
          supplierGstin: sql`excluded.supplier_gstin`,
          invoiceDate: sql`excluded.invoice_date`,
          taxableAmount: sql`excluded.taxable_amount`,
          cgstAmount: sql`excluded.cgst_amount`,
          sgstAmount: sql`excluded.sgst_amount`,
          igstAmount: sql`excluded.igst_amount`,
          cessAmount: sql`excluded.cess_amount`,
          totalGstAmount: sql`excluded.total_gst_amount`,
          updatedAt: new Date()
        }
      })
      .returning();
  }

  public async createAdjustment(data: typeof gstAdjustments.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(gstAdjustments).values(data).returning();
    return row ?? null;
  }

  public async findAdjustmentById(companyId: string, adjustmentId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(gstAdjustments)
      .where(and(eq(gstAdjustments.companyId, companyId), eq(gstAdjustments.id, adjustmentId)))
      .limit(1);

    return row ?? null;
  }

  public async updateAdjustment(
    companyId: string,
    adjustmentId: string,
    data: Partial<typeof gstAdjustments.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(gstAdjustments)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(gstAdjustments.companyId, companyId), eq(gstAdjustments.id, adjustmentId)))
      .returning();

    return row ?? null;
  }

  public async createAdjustmentItcStatus(data: typeof gstItcStatus.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(gstItcStatus).values(data).returning();
    return row ?? null;
  }

  public async listSales(filters: GstSalesQuery & { companyId: string }) {
    const conditions = [...this.buildSalesConditions(filters), eq(salesInvoiceItems.companyId, filters.companyId)];
    if (filters.gstRate !== undefined) {
      conditions.push(eq(salesInvoiceItems.gstRate, String(filters.gstRate)));
    }
    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: salesInvoices.id,
        invoiceDate: salesInvoices.invoiceDate,
        invoiceNumber: salesInvoices.invoiceNumber,
        invoiceType: salesInvoices.invoiceType,
        customerName: salesInvoices.customerNameSnapshot,
        gstin: salesInvoices.customerGstSnapshot,
        placeOfSupply: salesInvoices.placeOfSupply,
        taxableAmount: sql<string>`coalesce(sum(${salesInvoiceItems.taxableAmount}), 0)`,
        cgstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.cgstAmount}), 0)`,
        sgstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.sgstAmount}), 0)`,
        igstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.igstAmount}), 0)`,
        cessAmount: sql<string>`coalesce(sum(${salesInvoiceItems.cessAmount}), 0)`,
        totalGst: sql<string>`coalesce(sum(${salesInvoiceItems.cgstAmount} + ${salesInvoiceItems.sgstAmount} + ${salesInvoiceItems.igstAmount} + ${salesInvoiceItems.cessAmount}), 0)`,
        invoiceTotal:
          filters.gstRate === undefined
            ? salesInvoices.grandTotal
            : sql<string>`coalesce(sum(${salesInvoiceItems.lineTotal}), 0)`
      })
      .from(salesInvoices)
      .innerJoin(salesInvoiceItems, eq(salesInvoiceItems.salesInvoiceId, salesInvoices.id))
      .where(whereClause)
      .groupBy(
        salesInvoices.id,
        salesInvoices.invoiceDate,
        salesInvoices.invoiceNumber,
        salesInvoices.invoiceType,
        salesInvoices.customerNameSnapshot,
        salesInvoices.customerGstSnapshot,
        salesInvoices.placeOfSupply,
        salesInvoices.grandTotal,
        salesInvoices.createdAt
      )
      .orderBy(desc(salesInvoices.invoiceDate), desc(salesInvoices.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db
      .select({ value: sql<number>`count(distinct ${salesInvoices.id})` })
      .from(salesInvoices)
      .innerJoin(salesInvoiceItems, eq(salesInvoiceItems.salesInvoiceId, salesInvoices.id))
      .where(whereClause);

    return {
      rows,
      total: Number(totalRow?.value ?? 0)
    };
  }

  public async listPurchases(filters: GstPurchasesQuery & { companyId: string }) {
    const conditions = [...this.buildPurchasesConditions(filters), eq(purchaseInvoiceItems.companyId, filters.companyId)];
    if (filters.gstRate !== undefined) {
      conditions.push(eq(purchaseInvoiceItems.gstRate, String(filters.gstRate)));
    }
    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: purchaseInvoices.id,
        purchaseDate: purchaseInvoices.invoiceDate,
        purchaseNumber: purchaseInvoices.purchaseNumber,
        supplierName: suppliers.name,
        gstin: suppliers.gstNumber,
        supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
        taxableAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.taxableAmount}), 0)`,
        cgstAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.cgstAmount}), 0)`,
        sgstAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.sgstAmount}), 0)`,
        igstAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.igstAmount}), 0)`,
        cessAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.cessAmount}), 0)`,
        totalGst: sql<string>`coalesce(sum(${purchaseInvoiceItems.cgstAmount} + ${purchaseInvoiceItems.sgstAmount} + ${purchaseInvoiceItems.igstAmount} + ${purchaseInvoiceItems.cessAmount}), 0)`,
        invoiceTotal:
          filters.gstRate === undefined
            ? purchaseInvoices.grandTotal
            : sql<string>`coalesce(sum(${purchaseInvoiceItems.lineTotal}), 0)`,
        eligibilityStatus: gstItcStatus.eligibilityStatus,
        claimStatus: gstItcStatus.claimStatus,
        claimedAmount: gstItcStatus.claimedAmount
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .innerJoin(purchaseInvoiceItems, eq(purchaseInvoiceItems.purchaseInvoiceId, purchaseInvoices.id))
      .leftJoin(
        gstItcStatus,
        and(
          eq(gstItcStatus.companyId, purchaseInvoices.companyId),
          eq(gstItcStatus.sourceType, "purchase"),
          eq(gstItcStatus.sourceId, purchaseInvoices.id)
        )
      )
      .where(whereClause)
      .groupBy(
        purchaseInvoices.id,
        purchaseInvoices.invoiceDate,
        purchaseInvoices.purchaseNumber,
        purchaseInvoices.supplierInvoiceNumber,
        purchaseInvoices.grandTotal,
        purchaseInvoices.createdAt,
        suppliers.name,
        suppliers.gstNumber,
        gstItcStatus.eligibilityStatus,
        gstItcStatus.claimStatus,
        gstItcStatus.claimedAmount
      )
      .orderBy(desc(purchaseInvoices.invoiceDate), desc(purchaseInvoices.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db
      .select({ value: sql<number>`count(distinct ${purchaseInvoices.id})` })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .innerJoin(purchaseInvoiceItems, eq(purchaseInvoiceItems.purchaseInvoiceId, purchaseInvoices.id))
      .leftJoin(
        gstItcStatus,
        and(
          eq(gstItcStatus.companyId, purchaseInvoices.companyId),
          eq(gstItcStatus.sourceType, "purchase"),
          eq(gstItcStatus.sourceId, purchaseInvoices.id)
        )
      )
      .where(whereClause);

    return {
      rows,
      total: Number(totalRow?.value ?? 0)
    };
  }

  public async listItc(filters: GstItcQuery & { companyId: string }) {
    const conditions: SQL[] = [
      eq(gstItcStatus.companyId, filters.companyId),
      gte(gstItcStatus.invoiceDate, filters.dateFrom),
      lte(gstItcStatus.invoiceDate, filters.dateTo)
    ];

    if (filters.sourceType) {
      conditions.push(eq(gstItcStatus.sourceType, filters.sourceType));
    }

    if (filters.eligibilityStatus) {
      conditions.push(eq(gstItcStatus.eligibilityStatus, filters.eligibilityStatus));
    }

    if (filters.claimStatus) {
      conditions.push(eq(gstItcStatus.claimStatus, filters.claimStatus));
    }

    if (filters.supplier) {
      conditions.push(
        sql`(
          coalesce(${suppliers.name}, '') ilike ${`%${filters.supplier}%`}
          or coalesce(${gstItcStatus.supplierGstin}, '') ilike ${`%${filters.supplier}%`}
          or coalesce(${expenses.payeeName}, '') ilike ${`%${filters.supplier}%`}
        )`
      );
    }

    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: gstItcStatus.id,
        sourceType: gstItcStatus.sourceType,
        sourceId: gstItcStatus.sourceId,
        sourceNumber: gstItcStatus.sourceNumber,
        supplierGstin: gstItcStatus.supplierGstin,
        invoiceDate: gstItcStatus.invoiceDate,
        taxableAmount: gstItcStatus.taxableAmount,
        cgstAmount: gstItcStatus.cgstAmount,
        sgstAmount: gstItcStatus.sgstAmount,
        igstAmount: gstItcStatus.igstAmount,
        cessAmount: gstItcStatus.cessAmount,
        totalGstAmount: gstItcStatus.totalGstAmount,
        eligibilityStatus: gstItcStatus.eligibilityStatus,
        claimStatus: gstItcStatus.claimStatus,
        claimedAmount: gstItcStatus.claimedAmount,
        notes: gstItcStatus.notes,
        supplierName: suppliers.name,
        payeeName: expenses.payeeName,
        adjustmentReason: gstAdjustments.reason,
        createdAt: gstItcStatus.createdAt,
        updatedAt: gstItcStatus.updatedAt
      })
      .from(gstItcStatus)
      .leftJoin(
        purchaseInvoices,
        and(
          eq(gstItcStatus.sourceType, "purchase"),
          eq(purchaseInvoices.companyId, gstItcStatus.companyId),
          eq(purchaseInvoices.id, gstItcStatus.sourceId)
        )
      )
      .leftJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .leftJoin(
        expenses,
        and(eq(gstItcStatus.sourceType, "expense"), eq(expenses.companyId, gstItcStatus.companyId), eq(expenses.id, gstItcStatus.sourceId))
      )
      .leftJoin(
        gstAdjustments,
        and(
          eq(gstItcStatus.sourceType, "adjustment"),
          eq(gstAdjustments.companyId, gstItcStatus.companyId),
          eq(gstAdjustments.id, gstItcStatus.sourceId),
          eq(gstAdjustments.status, "active")
        )
      )
      .where(whereClause)
      .orderBy(desc(gstItcStatus.invoiceDate), desc(gstItcStatus.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(gstItcStatus).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findItcStatusById(companyId: string, id: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(gstItcStatus)
      .where(and(eq(gstItcStatus.companyId, companyId), eq(gstItcStatus.id, id)))
      .limit(1);

    return row ?? null;
  }

  public async updateItcStatus(
    companyId: string,
    id: string,
    data: Partial<typeof gstItcStatus.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(gstItcStatus)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(gstItcStatus.companyId, companyId), eq(gstItcStatus.id, id)))
      .returning();

    return row ?? null;
  }

  public async listAdjustments(filters: GstAdjustmentsQuery & { companyId: string }) {
    const conditions: SQL[] = [eq(gstAdjustments.companyId, filters.companyId)];

    if (filters.dateFrom) {
      conditions.push(gte(gstAdjustments.adjustmentDate, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(gstAdjustments.adjustmentDate, filters.dateTo));
    }

    if (filters.adjustmentType) {
      conditions.push(eq(gstAdjustments.adjustmentType, filters.adjustmentType));
    }

    if (filters.taxComponent) {
      conditions.push(eq(gstAdjustments.taxComponent, filters.taxComponent));
    }

    if (filters.status) {
      conditions.push(eq(gstAdjustments.status, filters.status));
    }

    const whereClause = and(...conditions);

    const rows = await db
      .select()
      .from(gstAdjustments)
      .where(whereClause)
      .orderBy(desc(gstAdjustments.adjustmentDate), desc(gstAdjustments.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(gstAdjustments).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async createReportExport(data: typeof gstReportExports.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(gstReportExports).values(data).returning();
    return row ?? null;
  }

  public async getSalesTotals(companyId: string, range: DateRange) {
    const [row] = await db
      .select({
        taxableAmount: sql<string>`coalesce(sum(${salesInvoiceItems.taxableAmount}), 0)`,
        cgstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.cgstAmount}), 0)`,
        sgstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.sgstAmount}), 0)`,
        igstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.igstAmount}), 0)`,
        cessAmount: sql<string>`coalesce(sum(${salesInvoiceItems.cessAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.cgstAmount} + ${salesInvoiceItems.sgstAmount} + ${salesInvoiceItems.igstAmount} + ${salesInvoiceItems.cessAmount}), 0)`
      })
      .from(salesInvoiceItems)
      .innerJoin(salesInvoices, eq(salesInvoiceItems.salesInvoiceId, salesInvoices.id))
      .where(
        and(
          eq(salesInvoiceItems.companyId, companyId),
          isNull(salesInvoices.deletedAt),
          inArray(salesInvoices.invoiceStatus, SALES_REPORT_STATUSES),
          gte(salesInvoices.invoiceDate, range.dateFrom),
          lte(salesInvoices.invoiceDate, range.dateTo)
        )
      );

    return (
      row ?? {
        taxableAmount: "0.00",
        cgstAmount: "0.00",
        sgstAmount: "0.00",
        igstAmount: "0.00",
        cessAmount: "0.00",
        totalGstAmount: "0.00"
      }
    );
  }

  public async getSalesReturnTotals(companyId: string, range: DateRange) {
    const [row] = await db
      .select({
        taxableAmount: sql<string>`coalesce(sum(${salesReturnItems.taxableAmount}), 0)`,
        cgstAmount: sql<string>`coalesce(sum(case
          when ${salesInvoiceItems.quantity} = 0 then 0
          else round((${salesInvoiceItems.cgstAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2)
        end), 0)`,
        sgstAmount: sql<string>`coalesce(sum(case
          when ${salesInvoiceItems.quantity} = 0 then 0
          else round((${salesInvoiceItems.sgstAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2)
        end), 0)`,
        igstAmount: sql<string>`coalesce(sum(case
          when ${salesInvoiceItems.quantity} = 0 then 0
          else round((${salesInvoiceItems.igstAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2)
        end), 0)`,
        cessAmount: sql<string>`coalesce(sum(case
          when ${salesInvoiceItems.quantity} = 0 then 0
          else round((${salesInvoiceItems.cessAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2)
        end), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${salesReturnItems.gstAmount}), 0)`
      })
      .from(salesReturnItems)
      .innerJoin(salesReturns, eq(salesReturnItems.salesReturnId, salesReturns.id))
      .innerJoin(salesInvoiceItems, eq(salesReturnItems.salesInvoiceItemId, salesInvoiceItems.id))
      .where(
        and(
          eq(salesReturns.companyId, companyId),
          gte(salesReturns.returnDate, range.dateFrom),
          lte(salesReturns.returnDate, range.dateTo)
        )
      );

    return (
      row ?? {
        taxableAmount: "0.00",
        cgstAmount: "0.00",
        sgstAmount: "0.00",
        igstAmount: "0.00",
        cessAmount: "0.00",
        totalGstAmount: "0.00"
      }
    );
  }

  public async getPurchaseTotals(companyId: string, range: DateRange) {
    const [row] = await db
      .select({
        taxableAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.taxableAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.cgstAmount} + ${purchaseInvoiceItems.sgstAmount} + ${purchaseInvoiceItems.igstAmount} + ${purchaseInvoiceItems.cessAmount}), 0)`
      })
      .from(purchaseInvoiceItems)
      .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.purchaseInvoiceId, purchaseInvoices.id))
      .where(
        and(
          eq(purchaseInvoiceItems.companyId, companyId),
          isNull(purchaseInvoices.deletedAt),
          inArray(purchaseInvoices.purchaseStatus, PURCHASE_REPORT_STATUSES),
          gte(purchaseInvoices.invoiceDate, range.dateFrom),
          lte(purchaseInvoices.invoiceDate, range.dateTo)
        )
      );

    return (
      row ?? {
        taxableAmount: "0.00",
        totalGstAmount: "0.00"
      }
    );
  }

  public async getPurchaseReturnTotals(companyId: string, range: DateRange) {
    const [row] = await db
      .select({
        taxableAmount: sql<string>`coalesce(sum(${purchaseReturnItems.taxableAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${purchaseReturnItems.gstAmount}), 0)`
      })
      .from(purchaseReturnItems)
      .innerJoin(purchaseReturns, eq(purchaseReturnItems.purchaseReturnId, purchaseReturns.id))
      .where(
        and(
          eq(purchaseReturns.companyId, companyId),
          gte(purchaseReturns.returnDate, range.dateFrom),
          lte(purchaseReturns.returnDate, range.dateTo)
        )
      );

    return (
      row ?? {
        taxableAmount: "0.00",
        totalGstAmount: "0.00"
      }
    );
  }

  public async getEligibleItcTotals(companyId: string, range: DateRange, sourceType: "purchase" | "expense") {
    const [row] = await db
      .select({
        taxableAmount: sql<string>`coalesce(sum(${gstItcStatus.taxableAmount}), 0)`,
        cgstAmount: sql<string>`coalesce(sum(${gstItcStatus.cgstAmount}), 0)`,
        sgstAmount: sql<string>`coalesce(sum(${gstItcStatus.sgstAmount}), 0)`,
        igstAmount: sql<string>`coalesce(sum(${gstItcStatus.igstAmount}), 0)`,
        cessAmount: sql<string>`coalesce(sum(${gstItcStatus.cessAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${gstItcStatus.totalGstAmount}), 0)`
      })
      .from(gstItcStatus)
      .where(
        and(
          eq(gstItcStatus.companyId, companyId),
          eq(gstItcStatus.sourceType, sourceType),
          eq(gstItcStatus.eligibilityStatus, "eligible"),
          gte(gstItcStatus.invoiceDate, range.dateFrom),
          lte(gstItcStatus.invoiceDate, range.dateTo)
        )
      );

    return (
      row ?? {
        taxableAmount: "0.00",
        cgstAmount: "0.00",
        sgstAmount: "0.00",
        igstAmount: "0.00",
        cessAmount: "0.00",
        totalGstAmount: "0.00"
      }
    );
  }

  public async getClaimedItcTotals(companyId: string, range: DateRange, sourceType: "purchase" | "expense") {
    const claimedAmountExpr = sql<string>`coalesce(sum(case
      when ${gstItcStatus.claimStatus} = 'claimed' then ${gstItcStatus.totalGstAmount}
      when ${gstItcStatus.claimStatus} = 'partially_claimed' then ${gstItcStatus.claimedAmount}
      else 0
    end), 0)`;

    const [row] = await db
      .select({
        totalGstAmount: claimedAmountExpr
      })
      .from(gstItcStatus)
      .where(
        and(
          eq(gstItcStatus.companyId, companyId),
          eq(gstItcStatus.sourceType, sourceType),
          eq(gstItcStatus.eligibilityStatus, "eligible"),
          gte(gstItcStatus.invoiceDate, range.dateFrom),
          lte(gstItcStatus.invoiceDate, range.dateTo)
        )
      );

    return {
      totalGstAmount: row?.totalGstAmount ?? "0.00"
    };
  }

  public async getAdjustmentsTotals(companyId: string, range: DateRange) {
    return db
      .select({
        adjustmentType: gstAdjustments.adjustmentType,
        taxComponent: gstAdjustments.taxComponent,
        amount: sql<string>`coalesce(sum(${gstAdjustments.amount}), 0)`
      })
      .from(gstAdjustments)
      .where(
        and(
          eq(gstAdjustments.companyId, companyId),
          eq(gstAdjustments.status, "active"),
          gte(gstAdjustments.adjustmentDate, range.dateFrom),
          lte(gstAdjustments.adjustmentDate, range.dateTo)
        )
      )
      .groupBy(gstAdjustments.adjustmentType, gstAdjustments.taxComponent)
      .orderBy(asc(gstAdjustments.adjustmentType), asc(gstAdjustments.taxComponent));
  }

  public async getSalesMonthlyTotals(companyId: string, range: DateRange): Promise<MonthlyTotalsRow[]> {
    const monthExpr = sql<string>`to_char(date_trunc('month', ${salesInvoices.invoiceDate}), 'YYYY-MM-01')`;
    return db
      .select({
        month: monthExpr,
        taxableAmount: sql<string>`coalesce(sum(${salesInvoices.taxableAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${salesInvoices.gstTotal}), 0)`
      })
      .from(salesInvoices)
      .where(
        and(
          eq(salesInvoices.companyId, companyId),
          isNull(salesInvoices.deletedAt),
          inArray(salesInvoices.invoiceStatus, SALES_REPORT_STATUSES),
          gte(salesInvoices.invoiceDate, range.dateFrom),
          lte(salesInvoices.invoiceDate, range.dateTo)
        )
      )
      .groupBy(monthExpr)
      .orderBy(monthExpr);
  }

  public async getSalesReturnMonthlyTotals(companyId: string, range: DateRange): Promise<MonthlyTotalsRow[]> {
    const monthExpr = sql<string>`to_char(date_trunc('month', ${salesReturns.returnDate}), 'YYYY-MM-01')`;
    return db
      .select({
        month: monthExpr,
        taxableAmount: sql<string>`coalesce(sum(${salesReturnItems.taxableAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${salesReturnItems.gstAmount}), 0)`
      })
      .from(salesReturnItems)
      .innerJoin(salesReturns, eq(salesReturnItems.salesReturnId, salesReturns.id))
      .where(
        and(
          eq(salesReturns.companyId, companyId),
          gte(salesReturns.returnDate, range.dateFrom),
          lte(salesReturns.returnDate, range.dateTo)
        )
      )
      .groupBy(monthExpr)
      .orderBy(monthExpr);
  }

  public async getPurchaseMonthlyTotals(companyId: string, range: DateRange): Promise<MonthlyTotalsRow[]> {
    const monthExpr = sql<string>`to_char(date_trunc('month', ${purchaseInvoices.invoiceDate}), 'YYYY-MM-01')`;
    return db
      .select({
        month: monthExpr,
        taxableAmount: sql<string>`coalesce(sum(${purchaseInvoices.taxableAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${purchaseInvoices.gstTotal}), 0)`
      })
      .from(purchaseInvoices)
      .where(
        and(
          eq(purchaseInvoices.companyId, companyId),
          isNull(purchaseInvoices.deletedAt),
          inArray(purchaseInvoices.purchaseStatus, PURCHASE_REPORT_STATUSES),
          gte(purchaseInvoices.invoiceDate, range.dateFrom),
          lte(purchaseInvoices.invoiceDate, range.dateTo)
        )
      )
      .groupBy(monthExpr)
      .orderBy(monthExpr);
  }

  public async getPurchaseReturnMonthlyTotals(companyId: string, range: DateRange): Promise<MonthlyTotalsRow[]> {
    const monthExpr = sql<string>`to_char(date_trunc('month', ${purchaseReturns.returnDate}), 'YYYY-MM-01')`;
    return db
      .select({
        month: monthExpr,
        taxableAmount: sql<string>`coalesce(sum(${purchaseReturnItems.taxableAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${purchaseReturnItems.gstAmount}), 0)`
      })
      .from(purchaseReturnItems)
      .innerJoin(purchaseReturns, eq(purchaseReturnItems.purchaseReturnId, purchaseReturns.id))
      .where(
        and(
          eq(purchaseReturns.companyId, companyId),
          gte(purchaseReturns.returnDate, range.dateFrom),
          lte(purchaseReturns.returnDate, range.dateTo)
        )
      )
      .groupBy(monthExpr)
      .orderBy(monthExpr);
  }

  public async getEligibleItcMonthlyTotals(
    companyId: string,
    range: DateRange,
    sourceType: "purchase" | "expense"
  ): Promise<MonthlyTotalsRow[]> {
    const monthExpr = sql<string>`to_char(date_trunc('month', ${gstItcStatus.invoiceDate}), 'YYYY-MM-01')`;
    return db
      .select({
        month: monthExpr,
        taxableAmount: sql<string>`coalesce(sum(${gstItcStatus.taxableAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${gstItcStatus.totalGstAmount}), 0)`
      })
      .from(gstItcStatus)
      .where(
        and(
          eq(gstItcStatus.companyId, companyId),
          eq(gstItcStatus.sourceType, sourceType),
          eq(gstItcStatus.eligibilityStatus, "eligible"),
          gte(gstItcStatus.invoiceDate, range.dateFrom),
          lte(gstItcStatus.invoiceDate, range.dateTo)
        )
      )
      .groupBy(monthExpr)
      .orderBy(monthExpr);
  }

  public async getClaimedItcMonthlyTotals(
    companyId: string,
    range: DateRange,
    sourceType: "purchase" | "expense"
  ): Promise<MonthlyTotalsRow[]> {
    const monthExpr = sql<string>`to_char(date_trunc('month', ${gstItcStatus.invoiceDate}), 'YYYY-MM-01')`;
    return db
      .select({
        month: monthExpr,
        taxableAmount: sql<string>`0`,
        totalGstAmount: sql<string>`coalesce(sum(case
          when ${gstItcStatus.claimStatus} = 'claimed' then ${gstItcStatus.totalGstAmount}
          when ${gstItcStatus.claimStatus} = 'partially_claimed' then ${gstItcStatus.claimedAmount}
          else 0
        end), 0)`
      })
      .from(gstItcStatus)
      .where(
        and(
          eq(gstItcStatus.companyId, companyId),
          eq(gstItcStatus.sourceType, sourceType),
          eq(gstItcStatus.eligibilityStatus, "eligible"),
          gte(gstItcStatus.invoiceDate, range.dateFrom),
          lte(gstItcStatus.invoiceDate, range.dateTo)
        )
      )
      .groupBy(monthExpr)
      .orderBy(monthExpr);
  }

  public async getAdjustmentsMonthlyTotals(companyId: string, range: DateRange) {
    const monthExpr = sql<string>`to_char(date_trunc('month', ${gstAdjustments.adjustmentDate}), 'YYYY-MM-01')`;
    return db
      .select({
        month: monthExpr,
        adjustmentType: gstAdjustments.adjustmentType,
        amount: sql<string>`coalesce(sum(${gstAdjustments.amount}), 0)`
      })
      .from(gstAdjustments)
      .where(
        and(
          eq(gstAdjustments.companyId, companyId),
          eq(gstAdjustments.status, "active"),
          gte(gstAdjustments.adjustmentDate, range.dateFrom),
          lte(gstAdjustments.adjustmentDate, range.dateTo)
        )
      )
      .groupBy(monthExpr, gstAdjustments.adjustmentType)
      .orderBy(monthExpr, asc(gstAdjustments.adjustmentType));
  }

  public async getHsnSummaryRows(companyId: string, query: GstHsnSummaryQuery): Promise<HsnSummaryRowInput[]> {
    const rows: HsnSummaryRowInput[] = [];

    if (query.source === "sales" || query.source === "all") {
      const salesRows = await db
        .select({
          hsnSacCode: salesInvoiceItems.hsnSacSnapshot,
          description: salesInvoiceItems.productNameSnapshot,
          unit: salesInvoiceItems.unitSnapshot,
          quantity: salesInvoiceItems.quantity,
          taxableValue: salesInvoiceItems.taxableAmount,
          gstRate: salesInvoiceItems.gstRate,
          cgstAmount: salesInvoiceItems.cgstAmount,
          sgstAmount: salesInvoiceItems.sgstAmount,
          igstAmount: salesInvoiceItems.igstAmount,
          cessAmount: salesInvoiceItems.cessAmount
        })
        .from(salesInvoiceItems)
        .innerJoin(salesInvoices, eq(salesInvoiceItems.salesInvoiceId, salesInvoices.id))
        .where(
          and(
            eq(salesInvoiceItems.companyId, companyId),
            isNull(salesInvoices.deletedAt),
            inArray(salesInvoices.invoiceStatus, SALES_REPORT_STATUSES),
            gte(salesInvoices.invoiceDate, query.dateFrom),
            lte(salesInvoices.invoiceDate, query.dateTo)
          )
        );

      rows.push(...salesRows);

      const salesReturnRows = await db
        .select({
          hsnSacCode: salesInvoiceItems.hsnSacSnapshot,
          description: salesInvoiceItems.productNameSnapshot,
          unit: salesInvoiceItems.unitSnapshot,
          quantity: sql<string>`(${salesReturnItems.quantity}::numeric * -1)::text`,
          taxableValue: sql<string>`(${salesReturnItems.taxableAmount}::numeric * -1)::text`,
          gstRate: salesReturnItems.gstRate,
          cgstAmount: sql<string>`coalesce(case
            when ${salesInvoiceItems.quantity} = 0 then 0
            else round((${salesInvoiceItems.cgstAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2) * -1
          end, 0)::text`,
          sgstAmount: sql<string>`coalesce(case
            when ${salesInvoiceItems.quantity} = 0 then 0
            else round((${salesInvoiceItems.sgstAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2) * -1
          end, 0)::text`,
          igstAmount: sql<string>`coalesce(case
            when ${salesInvoiceItems.quantity} = 0 then 0
            else round((${salesInvoiceItems.igstAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2) * -1
          end, 0)::text`,
          cessAmount: sql<string>`coalesce(case
            when ${salesInvoiceItems.quantity} = 0 then 0
            else round((${salesInvoiceItems.cessAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2) * -1
          end, 0)::text`
        })
        .from(salesReturnItems)
        .innerJoin(salesReturns, eq(salesReturnItems.salesReturnId, salesReturns.id))
        .innerJoin(salesInvoiceItems, eq(salesReturnItems.salesInvoiceItemId, salesInvoiceItems.id))
        .where(
          and(
            eq(salesReturnItems.companyId, companyId),
            gte(salesReturns.returnDate, query.dateFrom),
            lte(salesReturns.returnDate, query.dateTo)
          )
        );

      rows.push(...salesReturnRows);
    }

    if (query.source === "purchase" || query.source === "all") {
      const purchaseRows = await db
        .select({
          hsnSacCode: purchaseInvoiceItems.hsnSacSnapshot,
          description: purchaseInvoiceItems.productNameSnapshot,
          unit: purchaseInvoiceItems.unitSnapshot,
          quantity: purchaseInvoiceItems.quantity,
          taxableValue: purchaseInvoiceItems.taxableAmount,
          gstRate: purchaseInvoiceItems.gstRate,
          cgstAmount: purchaseInvoiceItems.cgstAmount,
          sgstAmount: purchaseInvoiceItems.sgstAmount,
          igstAmount: purchaseInvoiceItems.igstAmount,
          cessAmount: purchaseInvoiceItems.cessAmount
        })
        .from(purchaseInvoiceItems)
        .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.purchaseInvoiceId, purchaseInvoices.id))
        .where(
          and(
            eq(purchaseInvoiceItems.companyId, companyId),
            isNull(purchaseInvoices.deletedAt),
            inArray(purchaseInvoices.purchaseStatus, PURCHASE_REPORT_STATUSES),
            gte(purchaseInvoices.invoiceDate, query.dateFrom),
            lte(purchaseInvoices.invoiceDate, query.dateTo)
          )
        );

      rows.push(...purchaseRows);

      const purchaseReturnRows = await db
        .select({
          hsnSacCode: purchaseInvoiceItems.hsnSacSnapshot,
          description: purchaseInvoiceItems.productNameSnapshot,
          unit: purchaseInvoiceItems.unitSnapshot,
          quantity: sql<string>`(${purchaseReturnItems.quantity}::numeric * -1)::text`,
          taxableValue: sql<string>`(${purchaseReturnItems.taxableAmount}::numeric * -1)::text`,
          gstRate: purchaseReturnItems.gstRate,
          cgstAmount: sql<string>`coalesce(case
            when (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric) = 0 then 0
            else round((${purchaseInvoiceItems.cgstAmount}::numeric * ${purchaseReturnItems.quantity}::numeric) / (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric), 2) * -1
          end, 0)::text`,
          sgstAmount: sql<string>`coalesce(case
            when (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric) = 0 then 0
            else round((${purchaseInvoiceItems.sgstAmount}::numeric * ${purchaseReturnItems.quantity}::numeric) / (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric), 2) * -1
          end, 0)::text`,
          igstAmount: sql<string>`coalesce(case
            when (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric) = 0 then 0
            else round((${purchaseInvoiceItems.igstAmount}::numeric * ${purchaseReturnItems.quantity}::numeric) / (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric), 2) * -1
          end, 0)::text`,
          cessAmount: sql<string>`coalesce(case
            when (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric) = 0 then 0
            else round((${purchaseInvoiceItems.cessAmount}::numeric * ${purchaseReturnItems.quantity}::numeric) / (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric), 2) * -1
          end, 0)::text`
        })
        .from(purchaseReturnItems)
        .innerJoin(purchaseReturns, eq(purchaseReturnItems.purchaseReturnId, purchaseReturns.id))
        .innerJoin(purchaseInvoiceItems, eq(purchaseReturnItems.purchaseInvoiceItemId, purchaseInvoiceItems.id))
        .where(
          and(
            eq(purchaseReturnItems.companyId, companyId),
            gte(purchaseReturns.returnDate, query.dateFrom),
            lte(purchaseReturns.returnDate, query.dateTo)
          )
        );

      rows.push(...purchaseReturnRows);
    }

    if (query.source === "expense" || query.source === "all") {
      const expenseRows = await db
        .select({
          hsnSacCode: expenses.hsnSacCode,
          description: expenses.description,
          unit: sql<string | null>`null`,
          quantity: sql<string>`1.000`,
          taxableValue: expenses.taxableAmount,
          gstRate: expenses.gstRate,
          cgstAmount: expenses.cgstAmount,
          sgstAmount: expenses.sgstAmount,
          igstAmount: expenses.igstAmount,
          cessAmount: sql<string>`0`
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.companyId, companyId),
            isNull(expenses.deletedAt),
            eq(expenses.status, "posted"),
            eq(expenses.gstApplicable, true),
            gte(expenses.expenseDate, query.dateFrom),
            lte(expenses.expenseDate, query.dateTo)
          )
        );

      rows.push(...expenseRows);
    }

    return rows;
  }

  public async getSalesTaxRateRows(companyId: string, query: GstTaxSummaryQuery) {
    return db
      .select({
        gstRate: salesInvoiceItems.gstRate,
        taxableSales: sql<string>`coalesce(sum(${salesInvoiceItems.taxableAmount}), 0)`,
        outputGst: sql<string>`coalesce(sum(${salesInvoiceItems.cgstAmount} + ${salesInvoiceItems.sgstAmount} + ${salesInvoiceItems.igstAmount} + ${salesInvoiceItems.cessAmount}), 0)`,
        taxablePurchases: sql<string>`0`,
        inputGst: sql<string>`0`,
        cgstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.cgstAmount}), 0)`,
        sgstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.sgstAmount}), 0)`,
        igstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.igstAmount}), 0)`,
        cessAmount: sql<string>`coalesce(sum(${salesInvoiceItems.cessAmount}), 0)`
      })
      .from(salesInvoiceItems)
      .innerJoin(salesInvoices, eq(salesInvoiceItems.salesInvoiceId, salesInvoices.id))
      .where(
        and(
          eq(salesInvoiceItems.companyId, companyId),
          isNull(salesInvoices.deletedAt),
          inArray(salesInvoices.invoiceStatus, SALES_REPORT_STATUSES),
          gte(salesInvoices.invoiceDate, query.dateFrom),
          lte(salesInvoices.invoiceDate, query.dateTo)
        )
      )
      .groupBy(salesInvoiceItems.gstRate)
      .orderBy(asc(salesInvoiceItems.gstRate));
  }

  public async getSalesReturnTaxRateRows(companyId: string, query: GstTaxSummaryQuery) {
    return db
      .select({
        gstRate: salesReturnItems.gstRate,
        taxableSales: sql<string>`coalesce(sum(${salesReturnItems.taxableAmount}) * -1, 0)`,
        outputGst: sql<string>`coalesce(sum(${salesReturnItems.gstAmount}) * -1, 0)`,
        taxablePurchases: sql<string>`0`,
        inputGst: sql<string>`0`,
        cgstAmount: sql<string>`coalesce(sum(case
          when ${salesInvoiceItems.quantity} = 0 then 0
          else round((${salesInvoiceItems.cgstAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2)
        end) * -1, 0)`,
        sgstAmount: sql<string>`coalesce(sum(case
          when ${salesInvoiceItems.quantity} = 0 then 0
          else round((${salesInvoiceItems.sgstAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2)
        end) * -1, 0)`,
        igstAmount: sql<string>`coalesce(sum(case
          when ${salesInvoiceItems.quantity} = 0 then 0
          else round((${salesInvoiceItems.igstAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2)
        end) * -1, 0)`,
        cessAmount: sql<string>`coalesce(sum(case
          when ${salesInvoiceItems.quantity} = 0 then 0
          else round((${salesInvoiceItems.cessAmount}::numeric * ${salesReturnItems.quantity}::numeric) / ${salesInvoiceItems.quantity}::numeric, 2)
        end) * -1, 0)`
      })
      .from(salesReturnItems)
      .innerJoin(salesReturns, eq(salesReturnItems.salesReturnId, salesReturns.id))
      .innerJoin(salesInvoiceItems, eq(salesReturnItems.salesInvoiceItemId, salesInvoiceItems.id))
      .where(
        and(
          eq(salesReturnItems.companyId, companyId),
          gte(salesReturns.returnDate, query.dateFrom),
          lte(salesReturns.returnDate, query.dateTo)
        )
      )
      .groupBy(salesReturnItems.gstRate)
      .orderBy(asc(salesReturnItems.gstRate));
  }

  public async getPurchaseTaxRateRows(companyId: string, query: GstTaxSummaryQuery) {
    return db
      .select({
        gstRate: purchaseInvoiceItems.gstRate,
        taxableSales: sql<string>`0`,
        outputGst: sql<string>`0`,
        taxablePurchases: sql<string>`coalesce(sum(${purchaseInvoiceItems.taxableAmount}), 0)`,
        inputGst: sql<string>`coalesce(sum(${purchaseInvoiceItems.cgstAmount} + ${purchaseInvoiceItems.sgstAmount} + ${purchaseInvoiceItems.igstAmount} + ${purchaseInvoiceItems.cessAmount}), 0)`,
        cgstAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.cgstAmount}), 0)`,
        sgstAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.sgstAmount}), 0)`,
        igstAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.igstAmount}), 0)`,
        cessAmount: sql<string>`coalesce(sum(${purchaseInvoiceItems.cessAmount}), 0)`
      })
      .from(purchaseInvoiceItems)
      .innerJoin(purchaseInvoices, eq(purchaseInvoiceItems.purchaseInvoiceId, purchaseInvoices.id))
      .where(
        and(
          eq(purchaseInvoiceItems.companyId, companyId),
          isNull(purchaseInvoices.deletedAt),
          inArray(purchaseInvoices.purchaseStatus, PURCHASE_REPORT_STATUSES),
          gte(purchaseInvoices.invoiceDate, query.dateFrom),
          lte(purchaseInvoices.invoiceDate, query.dateTo)
        )
      )
      .groupBy(purchaseInvoiceItems.gstRate)
      .orderBy(asc(purchaseInvoiceItems.gstRate));
  }

  public async getPurchaseReturnTaxRateRows(companyId: string, query: GstTaxSummaryQuery) {
    return db
      .select({
        gstRate: purchaseReturnItems.gstRate,
        taxableSales: sql<string>`0`,
        outputGst: sql<string>`0`,
        taxablePurchases: sql<string>`coalesce(sum(${purchaseReturnItems.taxableAmount}) * -1, 0)`,
        inputGst: sql<string>`coalesce(sum(${purchaseReturnItems.gstAmount}) * -1, 0)`,
        cgstAmount: sql<string>`coalesce(sum(case
          when (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric) = 0 then 0
          else round((${purchaseInvoiceItems.cgstAmount}::numeric * ${purchaseReturnItems.quantity}::numeric) / (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric), 2)
        end) * -1, 0)`,
        sgstAmount: sql<string>`coalesce(sum(case
          when (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric) = 0 then 0
          else round((${purchaseInvoiceItems.sgstAmount}::numeric * ${purchaseReturnItems.quantity}::numeric) / (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric), 2)
        end) * -1, 0)`,
        igstAmount: sql<string>`coalesce(sum(case
          when (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric) = 0 then 0
          else round((${purchaseInvoiceItems.igstAmount}::numeric * ${purchaseReturnItems.quantity}::numeric) / (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric), 2)
        end) * -1, 0)`,
        cessAmount: sql<string>`coalesce(sum(case
          when (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric) = 0 then 0
          else round((${purchaseInvoiceItems.cessAmount}::numeric * ${purchaseReturnItems.quantity}::numeric) / (${purchaseInvoiceItems.quantity}::numeric + ${purchaseInvoiceItems.freeQuantity}::numeric), 2)
        end) * -1, 0)`
      })
      .from(purchaseReturnItems)
      .innerJoin(purchaseReturns, eq(purchaseReturnItems.purchaseReturnId, purchaseReturns.id))
      .innerJoin(purchaseInvoiceItems, eq(purchaseReturnItems.purchaseInvoiceItemId, purchaseInvoiceItems.id))
      .where(
        and(
          eq(purchaseReturnItems.companyId, companyId),
          gte(purchaseReturns.returnDate, query.dateFrom),
          lte(purchaseReturns.returnDate, query.dateTo)
        )
      )
      .groupBy(purchaseReturnItems.gstRate)
      .orderBy(asc(purchaseReturnItems.gstRate));
  }

  public async getExpenseTaxRateRows(companyId: string, query: GstTaxSummaryQuery) {
    return db
      .select({
        gstRate: expenses.gstRate,
        taxableSales: sql<string>`0`,
        outputGst: sql<string>`0`,
        taxablePurchases: sql<string>`0`,
        inputGst: sql<string>`coalesce(sum(${expenses.gstAmount}), 0)`,
        cgstAmount: sql<string>`coalesce(sum(${expenses.cgstAmount}), 0)`,
        sgstAmount: sql<string>`coalesce(sum(${expenses.sgstAmount}), 0)`,
        igstAmount: sql<string>`coalesce(sum(${expenses.igstAmount}), 0)`,
        cessAmount: sql<string>`0`
      })
      .from(expenses)
      .where(
        and(
          eq(expenses.companyId, companyId),
          isNull(expenses.deletedAt),
          eq(expenses.status, "posted"),
          eq(expenses.gstApplicable, true),
          gte(expenses.expenseDate, query.dateFrom),
          lte(expenses.expenseDate, query.dateTo)
        )
      )
      .groupBy(expenses.gstRate)
      .orderBy(asc(expenses.gstRate));
  }

  public async getOutputTaxBase(companyId: string, query: GstOutputTaxQuery) {
    const salesConditions: SQL[] = [
      eq(salesInvoiceItems.companyId, companyId),
      isNull(salesInvoices.deletedAt),
      inArray(salesInvoices.invoiceStatus, SALES_REPORT_STATUSES),
      gte(salesInvoices.invoiceDate, query.dateFrom),
      lte(salesInvoices.invoiceDate, query.dateTo)
    ];

    if (query.state) {
      salesConditions.push(ilike(salesInvoices.placeOfSupply, `%${query.state}%`));
    }

    if (query.gstRate !== undefined) {
      salesConditions.push(eq(salesInvoiceItems.gstRate, String(query.gstRate)));
    }

    const [salesRow] = await db
      .select({
        taxableAmount: sql<string>`coalesce(sum(${salesInvoiceItems.taxableAmount}), 0)`,
        cgstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.cgstAmount}), 0)`,
        sgstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.sgstAmount}), 0)`,
        igstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.igstAmount}), 0)`,
        cessAmount: sql<string>`coalesce(sum(${salesInvoiceItems.cessAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${salesInvoiceItems.cgstAmount} + ${salesInvoiceItems.sgstAmount} + ${salesInvoiceItems.igstAmount} + ${salesInvoiceItems.cessAmount}), 0)`
      })
      .from(salesInvoiceItems)
      .innerJoin(salesInvoices, eq(salesInvoiceItems.salesInvoiceId, salesInvoices.id))
      .where(and(...salesConditions));

    const returnConditions: SQL[] = [
      eq(salesReturnItems.companyId, companyId),
      gte(salesReturns.returnDate, query.dateFrom),
      lte(salesReturns.returnDate, query.dateTo)
    ];

    if (query.state) {
      returnConditions.push(ilike(salesInvoices.placeOfSupply, `%${query.state}%`));
    }

    if (query.gstRate !== undefined) {
      returnConditions.push(eq(salesReturnItems.gstRate, String(query.gstRate)));
    }

    const [returnsRow] = await db
      .select({
        taxableAmount: sql<string>`coalesce(sum(${salesReturnItems.taxableAmount}), 0)`,
        totalGstAmount: sql<string>`coalesce(sum(${salesReturnItems.gstAmount}), 0)`
      })
      .from(salesReturnItems)
      .innerJoin(salesReturns, eq(salesReturnItems.salesReturnId, salesReturns.id))
      .innerJoin(salesInvoiceItems, eq(salesReturnItems.salesInvoiceItemId, salesInvoiceItems.id))
      .innerJoin(salesInvoices, eq(salesInvoiceItems.salesInvoiceId, salesInvoices.id))
      .where(and(...returnConditions));

    return {
      salesRow: salesRow ?? {
        taxableAmount: "0.00",
        cgstAmount: "0.00",
        sgstAmount: "0.00",
        igstAmount: "0.00",
        cessAmount: "0.00",
        totalGstAmount: "0.00"
      },
      returnsRow: returnsRow ?? {
        taxableAmount: "0.00",
        totalGstAmount: "0.00"
      }
    };
  }

  public async saveMonthlySummary(data: typeof gstMonthlySummaries.$inferInsert, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .insert(gstMonthlySummaries)
      .values(data)
      .onConflictDoUpdate({
        target: [gstMonthlySummaries.companyId, gstMonthlySummaries.periodMonth],
        set: {
          taxableSales: sql`excluded.taxable_sales`,
          outputGst: sql`excluded.output_gst`,
          taxablePurchases: sql`excluded.taxable_purchases`,
          inputGst: sql`excluded.input_gst`,
          expenseInputGst: sql`excluded.expense_input_gst`,
          salesReturnGst: sql`excluded.sales_return_gst`,
          purchaseReturnGst: sql`excluded.purchase_return_gst`,
          netGstPayable: sql`excluded.net_gst_payable`,
          updatedAt: new Date()
        }
      })
      .returning();

    return row ?? null;
  }
}

export const gstRepository = new GstRepository();
