import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "../../db";
import {
  accountingEvents,
  companyBankAccounts,
  customers,
  paymentAllocations,
  paymentReceipts,
  paymentReminders,
  payments,
  purchaseInvoices,
  salesInvoices,
  suppliers,
  chequeTransactions
} from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type PaymentListFilters = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  partyType?: typeof payments.$inferSelect.partyType | undefined;
  paymentType?: typeof payments.$inferSelect.paymentType | undefined;
  partyId?: string | undefined;
  paymentMode?: typeof payments.$inferSelect.paymentMode | undefined;
  status?: typeof payments.$inferSelect.status | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
  isAdvance?: boolean | undefined;
};

type ReminderListFilters = {
  companyId: string;
  page: number;
  limit: number;
  partyType?: typeof paymentReminders.$inferSelect.partyType | undefined;
  partyId?: string | undefined;
  status?: typeof paymentReminders.$inferSelect.status | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
};

type DueListFilters = {
  companyId: string;
  partyId?: string | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
  overdueOnly?: boolean | undefined;
};

type ReminderPartyFilters = {
  companyId: string;
  partyType: "customer" | "supplier";
};

export class PaymentsRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private buildPaymentConditions(filters: Omit<PaymentListFilters, "page" | "limit">) {
    const conditions: SQL[] = [eq(payments.companyId, filters.companyId), isNull(payments.deletedAt)];

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(payments.paymentNumber, searchPattern),
          ilike(payments.receiptNumber, searchPattern),
          ilike(payments.referenceNumber, searchPattern),
          ilike(customers.name, searchPattern),
          ilike(suppliers.name, searchPattern),
          sql`exists (
            select 1
            from ${paymentAllocations}
            where ${paymentAllocations.paymentId} = ${payments.id}
              and ${paymentAllocations.companyId} = ${filters.companyId}
              and (
                ${paymentAllocations.referenceNumber} ilike ${searchPattern}
                or cast(${paymentAllocations.referenceId} as text) ilike ${searchPattern}
              )
          )`
        )!
      );
    }

    if (filters.partyType) {
      conditions.push(eq(payments.partyType, filters.partyType));
    }

    if (filters.paymentType) {
      conditions.push(eq(payments.paymentType, filters.paymentType));
    }

    if (filters.partyId) {
      conditions.push(eq(payments.partyId, filters.partyId));
    }

    if (filters.paymentMode) {
      conditions.push(eq(payments.paymentMode, filters.paymentMode));
    }

    if (filters.status) {
      conditions.push(eq(payments.status, filters.status));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${payments.paymentDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${payments.paymentDate} <= ${filters.dateTo}`);
    }

    if (filters.isAdvance !== undefined) {
      conditions.push(eq(payments.isAdvance, filters.isAdvance));
    }

    return conditions;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findLatestPaymentNumber(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ paymentNumber: payments.paymentNumber })
      .from(payments)
      .where(eq(payments.companyId, companyId))
      .orderBy(desc(payments.paymentNumber))
      .limit(1);

    return row?.paymentNumber ?? null;
  }

  public async findLatestReceiptNumber(
    companyId: string,
    receiptType: typeof paymentReceipts.$inferSelect.receiptType,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .select({ receiptNumber: paymentReceipts.receiptNumber })
      .from(paymentReceipts)
      .where(and(eq(paymentReceipts.companyId, companyId), eq(paymentReceipts.receiptType, receiptType)))
      .orderBy(desc(paymentReceipts.receiptNumber))
      .limit(1);

    return row?.receiptNumber ?? null;
  }

  public async createPayment(data: typeof payments.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(payments).values(data).returning();
    return row ?? null;
  }

  public async updatePayment(
    companyId: string,
    paymentId: string,
    data: Partial<typeof payments.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(payments)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(payments.companyId, companyId), eq(payments.id, paymentId), isNull(payments.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async findPaymentById(companyId: string, paymentId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(payments)
      .where(and(eq(payments.companyId, companyId), eq(payments.id, paymentId), isNull(payments.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findPaymentDetail(companyId: string, paymentId: string) {
    const [row] = await db
      .select({
        payment: payments,
        customer: customers,
        supplier: suppliers,
        bankAccount: companyBankAccounts
      })
      .from(payments)
      .leftJoin(customers, eq(payments.partyId, customers.id))
      .leftJoin(suppliers, eq(payments.partyId, suppliers.id))
      .leftJoin(companyBankAccounts, eq(payments.bankAccountId, companyBankAccounts.id))
      .where(and(eq(payments.companyId, companyId), eq(payments.id, paymentId), isNull(payments.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async listPayments(filters: PaymentListFilters) {
    const whereClause = and(...this.buildPaymentConditions(filters));

    const rows = await db
      .select({
        payment: payments,
        customerName: customers.name,
        customerCode: customers.customerCode,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode
      })
      .from(payments)
      .leftJoin(customers, eq(payments.partyId, customers.id))
      .leftJoin(suppliers, eq(payments.partyId, suppliers.id))
      .where(whereClause)
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(payments)
      .leftJoin(customers, eq(payments.partyId, customers.id))
      .leftJoin(suppliers, eq(payments.partyId, suppliers.id))
      .where(whereClause);

    const [summaryRow] = await db
      .select({
        amount: sql<string>`coalesce(sum(${payments.amount}), 0)`,
        allocatedAmount: sql<string>`coalesce(sum(${payments.allocatedAmount}), 0)`,
        unallocatedAmount: sql<string>`coalesce(sum(${payments.unallocatedAmount}), 0)`
      })
      .from(payments)
      .leftJoin(customers, eq(payments.partyId, customers.id))
      .leftJoin(suppliers, eq(payments.partyId, suppliers.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0,
      summary: {
        amount: summaryRow?.amount ?? "0.00",
        allocatedAmount: summaryRow?.allocatedAmount ?? "0.00",
        unallocatedAmount: summaryRow?.unallocatedAmount ?? "0.00"
      }
    };
  }

  public async listPaymentsForExport(filters: Omit<PaymentListFilters, "page" | "limit">) {
    const whereClause = and(...this.buildPaymentConditions(filters));

    return db
      .select({
        payment: payments,
        customerName: customers.name,
        supplierName: suppliers.name
      })
      .from(payments)
      .leftJoin(customers, eq(payments.partyId, customers.id))
      .leftJoin(suppliers, eq(payments.partyId, suppliers.id))
      .where(whereClause)
      .orderBy(desc(payments.paymentDate), desc(payments.createdAt));
  }

  public async listAllocations(companyId: string, paymentId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(paymentAllocations)
      .where(and(eq(paymentAllocations.companyId, companyId), eq(paymentAllocations.paymentId, paymentId)))
      .orderBy(asc(paymentAllocations.allocationDate), asc(paymentAllocations.createdAt));
  }

  public async deleteAllocations(companyId: string, paymentId: string, executor?: DbExecutor) {
    await this
      .getExecutor(executor)
      .delete(paymentAllocations)
      .where(and(eq(paymentAllocations.companyId, companyId), eq(paymentAllocations.paymentId, paymentId)));
  }

  public async createAllocations(data: Array<typeof paymentAllocations.$inferInsert>, executor?: DbExecutor) {
    if (data.length === 0) {
      return [];
    }

    return this.getExecutor(executor).insert(paymentAllocations).values(data).returning();
  }

  public async findReceiptByPayment(companyId: string, paymentId: string) {
    const [row] = await db
      .select()
      .from(paymentReceipts)
      .where(and(eq(paymentReceipts.companyId, companyId), eq(paymentReceipts.paymentId, paymentId)))
      .limit(1);

    return row ?? null;
  }

  public async upsertReceipt(
    companyId: string,
    paymentId: string,
    data: Omit<typeof paymentReceipts.$inferInsert, "companyId" | "paymentId">,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .insert(paymentReceipts)
      .values({
        companyId,
        paymentId,
        ...data
      })
      .onConflictDoUpdate({
        target: paymentReceipts.paymentId,
        set: {
          ...data
        }
      })
      .returning();

    return row ?? null;
  }

  public async listChequeTransactions(companyId: string, paymentId: string) {
    return db
      .select()
      .from(chequeTransactions)
      .where(and(eq(chequeTransactions.companyId, companyId), eq(chequeTransactions.paymentId, paymentId)))
      .orderBy(desc(chequeTransactions.statusDate), desc(chequeTransactions.createdAt));
  }

  public async createChequeTransaction(data: typeof chequeTransactions.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(chequeTransactions).values(data).returning();
    return row ?? null;
  }

  public async createAccountingEvent(data: typeof accountingEvents.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(accountingEvents).values(data).returning();
    return row ?? null;
  }

  public async findReminderById(companyId: string, reminderId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(paymentReminders)
      .where(and(eq(paymentReminders.companyId, companyId), eq(paymentReminders.id, reminderId)))
      .limit(1);

    return row ?? null;
  }

  public async listReminders(filters: ReminderListFilters) {
    const conditions: SQL[] = [eq(paymentReminders.companyId, filters.companyId)];

    if (filters.partyType) {
      conditions.push(eq(paymentReminders.partyType, filters.partyType));
    }

    if (filters.partyId) {
      conditions.push(eq(paymentReminders.partyId, filters.partyId));
    }

    if (filters.status) {
      conditions.push(eq(paymentReminders.status, filters.status));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${paymentReminders.dueDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${paymentReminders.dueDate} <= ${filters.dateTo}`);
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select({
        reminder: paymentReminders,
        customerName: customers.name,
        supplierName: suppliers.name
      })
      .from(paymentReminders)
      .leftJoin(customers, eq(paymentReminders.partyId, customers.id))
      .leftJoin(suppliers, eq(paymentReminders.partyId, suppliers.id))
      .where(whereClause)
      .orderBy(desc(paymentReminders.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(paymentReminders).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listReminderParties(filters: ReminderPartyFilters) {
    if (filters.partyType === "customer") {
      return db
        .select({
          id: customers.id,
          name: customers.name,
          code: customers.customerCode
        })
        .from(customers)
        .where(
          and(
            eq(customers.companyId, filters.companyId),
            eq(customers.status, "active"),
            eq(customers.isBlacklisted, false),
            isNull(customers.deletedAt)
          )
        )
        .orderBy(asc(customers.name));
    }

    return db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        code: suppliers.supplierCode
      })
      .from(suppliers)
      .where(
        and(
          eq(suppliers.companyId, filters.companyId),
          eq(suppliers.status, "active"),
          eq(suppliers.isBlacklisted, false),
          isNull(suppliers.deletedAt)
        )
      )
      .orderBy(asc(suppliers.name));
  }

  public async createReminder(data: typeof paymentReminders.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(paymentReminders).values(data).returning();
    return row ?? null;
  }

  public async updateReminder(
    companyId: string,
    reminderId: string,
    data: Partial<typeof paymentReminders.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(paymentReminders)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(paymentReminders.companyId, companyId), eq(paymentReminders.id, reminderId)))
      .returning();

    return row ?? null;
  }

  public async findSalesInvoicesByIds(companyId: string, invoiceIds: string[], executor?: DbExecutor) {
    if (invoiceIds.length === 0) {
      return [];
    }

    return this
      .getExecutor(executor)
      .select()
      .from(salesInvoices)
      .where(and(eq(salesInvoices.companyId, companyId), inArray(salesInvoices.id, invoiceIds), isNull(salesInvoices.deletedAt)));
  }

  public async findPurchaseInvoicesByIds(companyId: string, invoiceIds: string[], executor?: DbExecutor) {
    if (invoiceIds.length === 0) {
      return [];
    }

    return this
      .getExecutor(executor)
      .select()
      .from(purchaseInvoices)
      .where(
        and(eq(purchaseInvoices.companyId, companyId), inArray(purchaseInvoices.id, invoiceIds), isNull(purchaseInvoices.deletedAt))
      );
  }

  public async updateSalesInvoice(
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

  public async updatePurchaseInvoice(
    companyId: string,
    invoiceId: string,
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
      .where(
        and(eq(purchaseInvoices.companyId, companyId), eq(purchaseInvoices.id, invoiceId), isNull(purchaseInvoices.deletedAt))
      )
      .returning();

    return row ?? null;
  }

  public async listCustomerDueItems(filters: DueListFilters) {
    const conditions: SQL[] = [
      eq(salesInvoices.companyId, filters.companyId),
      isNull(salesInvoices.deletedAt),
      inArray(salesInvoices.invoiceStatus, ["posted", "partially_returned", "returned"]),
      sql`${salesInvoices.dueAmount} > 0`
    ];

    if (filters.partyId) {
      conditions.push(eq(salesInvoices.customerId, filters.partyId));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${salesInvoices.invoiceDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${salesInvoices.invoiceDate} <= ${filters.dateTo}`);
    }

    if (filters.overdueOnly) {
      conditions.push(sql`${salesInvoices.dueDate} IS NOT NULL AND ${salesInvoices.dueDate} < CURRENT_DATE`);
    }

    return db
      .select({
        invoice: salesInvoices,
        customerName: customers.name,
        customerCode: customers.customerCode
      })
      .from(salesInvoices)
      .innerJoin(customers, eq(salesInvoices.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(salesInvoices.dueDate), desc(salesInvoices.invoiceDate));
  }

  public async listSupplierDueItems(filters: DueListFilters) {
    const conditions: SQL[] = [
      eq(purchaseInvoices.companyId, filters.companyId),
      isNull(purchaseInvoices.deletedAt),
      inArray(purchaseInvoices.purchaseStatus, ["posted", "returned"]),
      sql`${purchaseInvoices.dueAmount} > 0`
    ];

    if (filters.partyId) {
      conditions.push(eq(purchaseInvoices.supplierId, filters.partyId));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${purchaseInvoices.invoiceDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${purchaseInvoices.invoiceDate} <= ${filters.dateTo}`);
    }

    if (filters.overdueOnly) {
      conditions.push(sql`${purchaseInvoices.dueDate} IS NOT NULL AND ${purchaseInvoices.dueDate} < CURRENT_DATE`);
    }

    return db
      .select({
        invoice: purchaseInvoices,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .where(and(...conditions))
      .orderBy(desc(purchaseInvoices.dueDate), desc(purchaseInvoices.invoiceDate));
  }

  public async getAdvanceBalance(
    companyId: string,
    partyType: typeof payments.$inferSelect.partyType,
    partyId: string
  ) {
    const [row] = await db
      .select({
        value: sql<string>`coalesce(sum(${payments.unallocatedAmount}), 0)`
      })
      .from(payments)
      .where(
        and(
          eq(payments.companyId, companyId),
          eq(payments.partyType, partyType),
          eq(payments.partyId, partyId),
          eq(payments.status, "completed"),
          sql`${payments.unallocatedAmount} > 0`,
          isNull(payments.deletedAt)
        )
      );

    return row?.value ?? "0.00";
  }
}

export const paymentsRepository = new PaymentsRepository();
