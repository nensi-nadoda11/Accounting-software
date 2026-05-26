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
import { customers, payments, salesInvoices, salesPayments, salesReturns } from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type ListCustomersParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null;
  status?: "active" | "inactive" | "deleted";
  customerType?: "individual" | "business";
  taxType?: "registered" | "unregistered" | "composition";
  hasOutstanding?: boolean;
  isBlacklisted?: boolean;
  sortBy: "name" | "createdAt" | "outstandingAmount" | "customerCode";
  sortOrder: "asc" | "desc";
};

type ExportCustomersParams = Omit<ListCustomersParams, "page" | "limit">;

type CustomerTransactionTotals = {
  totalSales: string;
  totalReturns: string;
  totalPayments: string;
  debitAdjustments: string;
  creditAdjustments: string;
  overdueAmount: string;
};

class CustomersRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private getOutstandingSql() {
    const activeInvoiceClause = sql`
      ${salesInvoices.companyId} = ${customers.companyId}
      AND ${salesInvoices.customerId} = ${customers.id}
      AND ${salesInvoices.deletedAt} IS NULL
      AND ${salesInvoices.invoiceStatus} IN ('posted', 'partially_returned', 'returned')
    `;

    const salesDue = sql<string>`coalesce((select sum(${salesInvoices.dueAmount}) from ${salesInvoices} where ${activeInvoiceClause}), 0)`;

    return sql<string>`
      CASE
        WHEN ${customers.openingBalanceType} = 'debit' THEN (${customers.openingBalanceAmount} + ${salesDue})
        WHEN ${customers.openingBalanceType} = 'credit' THEN ((${customers.openingBalanceAmount} * -1) + ${salesDue})
        WHEN ${customers.openingBalanceType} = 'none' THEN ${salesDue}
        ELSE 0
      END
    `;
  }

  private buildListConditions(params: Omit<ListCustomersParams, "page" | "limit" | "sortBy" | "sortOrder">) {
    const conditions: SQL[] = [eq(customers.companyId, params.companyId)];
    const outstandingSql = this.getOutstandingSql();

    if (params.status === "deleted") {
      conditions.push(eq(customers.status, "deleted"));
    } else {
      conditions.push(isNull(customers.deletedAt));

      if (params.status) {
        conditions.push(eq(customers.status, params.status));
      }
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(customers.name, searchPattern),
          ilike(customers.mobile, searchPattern),
          ilike(customers.email, searchPattern),
          ilike(customers.gstNumber, searchPattern),
          ilike(customers.customerCode, searchPattern),
          ilike(customers.businessName, searchPattern)
        )!
      );
    }

    if (params.customerType) {
      conditions.push(eq(customers.customerType, params.customerType));
    }

    if (params.taxType) {
      conditions.push(eq(customers.taxType, params.taxType));
    }

    if (params.hasOutstanding !== undefined) {
      conditions.push(params.hasOutstanding ? sql`${outstandingSql} <> 0` : sql`${outstandingSql} = 0`);
    }

    if (params.isBlacklisted !== undefined) {
      conditions.push(eq(customers.isBlacklisted, params.isBlacklisted));
    }

    return conditions;
  }

  private getListOrderBy(sortBy: ListCustomersParams["sortBy"], sortOrder: ListCustomersParams["sortOrder"]) {
    const sortDirection = sortOrder === "asc" ? asc : desc;
    const outstandingSql = this.getOutstandingSql();

    if (sortBy === "name") {
      return [sortDirection(customers.name), desc(customers.createdAt)] as const;
    }

    if (sortBy === "customerCode") {
      return [sortDirection(customers.customerCode), desc(customers.createdAt)] as const;
    }

    if (sortBy === "outstandingAmount") {
      return [sortDirection(outstandingSql), asc(customers.name)] as const;
    }

    return [sortDirection(customers.createdAt), asc(customers.name)] as const;
  }

  public async acquireCustomerCodeLock(companyId: string, executor?: DbExecutor): Promise<void> {
    await this
      .getExecutor(executor)
      .execute(sql`select pg_advisory_xact_lock(hashtext(${`customer-code:${companyId}`}))`);
  }

  public async findLatestCustomerCode(companyId: string, executor?: DbExecutor): Promise<string | null> {
    const [row] = await this
      .getExecutor(executor)
      .select({ customerCode: customers.customerCode })
      .from(customers)
      .where(eq(customers.companyId, companyId))
      .orderBy(desc(customers.customerCode))
      .limit(1);

    return row?.customerCode ?? null;
  }

  public async findById(companyId: string, customerId: string, includeDeleted = false, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(customers.companyId, companyId), eq(customers.id, customerId)];

    if (!includeDeleted) {
      conditions.push(isNull(customers.deletedAt));
    }

    const [customer] = await this
      .getExecutor(executor)
      .select()
      .from(customers)
      .where(and(...conditions))
      .limit(1);

    return customer ?? null;
  }

  public async findByMobile(companyId: string, mobile: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(customers.companyId, companyId),
      eq(customers.mobile, mobile),
      isNull(customers.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(customers.id, excludeId));
    }

    const [customer] = await this
      .getExecutor(executor)
      .select()
      .from(customers)
      .where(and(...conditions))
      .limit(1);

    return customer ?? null;
  }

  public async findByEmail(companyId: string, email: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(customers.companyId, companyId),
      eq(customers.email, email),
      isNull(customers.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(customers.id, excludeId));
    }

    const [customer] = await this
      .getExecutor(executor)
      .select()
      .from(customers)
      .where(and(...conditions))
      .limit(1);

    return customer ?? null;
  }

  public async createCustomer(data: typeof customers.$inferInsert, executor?: DbExecutor) {
    const [customer] = await this.getExecutor(executor).insert(customers).values(data).returning();
    return customer ?? null;
  }

  public async updateCustomer(
    companyId: string,
    customerId: string,
    data: Partial<typeof customers.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [customer] = await this
      .getExecutor(executor)
      .update(customers)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
      .returning();

    return customer ?? null;
  }

  public async softDeleteCustomer(companyId: string, customerId: string, actorId: string, executor?: DbExecutor) {
    const [customer] = await this
      .getExecutor(executor)
      .update(customers)
      .set({
        status: "deleted",
        updatedBy: actorId,
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
      .returning();

    return customer ?? null;
  }

  public async listCustomers(params: ListCustomersParams) {
    const outstandingAmount = this.getOutstandingSql();
    const conditions = this.buildListConditions(params);
    const whereClause = and(...conditions);
    const orderBy = this.getListOrderBy(params.sortBy, params.sortOrder);

    const rows = await db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        name: customers.name,
        customerType: customers.customerType,
        businessName: customers.businessName,
        mobile: customers.mobile,
        email: customers.email,
        gstNumber: customers.gstNumber,
        taxType: customers.taxType,
        status: customers.status,
        isBlacklisted: customers.isBlacklisted,
        openingBalanceAmount: customers.openingBalanceAmount,
        openingBalanceType: customers.openingBalanceType,
        creditLimit: customers.creditLimit,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        outstandingAmount
      })
      .from(customers)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const [totalRow] = await db.select({ value: count() }).from(customers).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listCustomersForExport(params: ExportCustomersParams) {
    const conditions = this.buildListConditions(params);
    const whereClause = and(...conditions);
    const orderBy = this.getListOrderBy(params.sortBy, params.sortOrder);
    const outstandingAmount = this.getOutstandingSql();

    return db
      .select({
        id: customers.id,
        customerCode: customers.customerCode,
        name: customers.name,
        customerType: customers.customerType,
        businessName: customers.businessName,
        mobile: customers.mobile,
        email: customers.email,
        gstNumber: customers.gstNumber,
        taxType: customers.taxType,
        status: customers.status,
        isBlacklisted: customers.isBlacklisted,
        openingBalanceAmount: customers.openingBalanceAmount,
        openingBalanceType: customers.openingBalanceType,
        creditLimit: customers.creditLimit,
        createdAt: customers.createdAt,
        outstandingAmount
      })
      .from(customers)
      .where(whereClause)
      .orderBy(...orderBy);
  }

  public async getCustomerTransactionTotals(
    companyId: string,
    customerId: string,
    excludeInvoiceId?: string
  ): Promise<CustomerTransactionTotals> {
    const invoiceConditions: SQL[] = [
      eq(salesInvoices.companyId, companyId),
      eq(salesInvoices.customerId, customerId),
      isNull(salesInvoices.deletedAt),
      sql`${salesInvoices.invoiceStatus} IN ('posted', 'partially_returned', 'returned')`
    ];

    if (excludeInvoiceId) {
      invoiceConditions.push(ne(salesInvoices.id, excludeInvoiceId));
    }

    const paymentConditions: SQL[] = [eq(salesPayments.companyId, companyId), eq(salesPayments.customerId, customerId)];
    const returnConditions: SQL[] = [eq(salesReturns.companyId, companyId), eq(salesReturns.customerId, customerId)];

    const [salesRows, returnRows, paymentRows, genericPaymentRows, overdueRows] = await Promise.all([
      db
        .select({
          totalSales: sql<string>`coalesce(sum(${salesInvoices.grandTotal}), 0)`
        })
        .from(salesInvoices)
        .where(and(...invoiceConditions)),
      db
        .select({
          totalReturns: sql<string>`coalesce(sum(${salesReturns.grandTotal}), 0)`
        })
        .from(salesReturns)
        .where(and(...returnConditions)),
      db
        .select({
          totalPayments: sql<string>`coalesce(sum(${salesPayments.amount}), 0)`
        })
        .from(salesPayments)
        .where(and(...paymentConditions)),
      db
        .select({
          totalPayments: sql<string>`coalesce(sum(${payments.amount}), 0)`
        })
        .from(payments)
        .where(
          and(
            eq(payments.companyId, companyId),
            eq(payments.partyType, "customer"),
            eq(payments.partyId, customerId),
            eq(payments.status, "completed"),
            isNull(payments.deletedAt)
          )
        ),
      db
        .select({
          overdueAmount: sql<string>`coalesce(sum(${salesInvoices.dueAmount}), 0)`
        })
        .from(salesInvoices)
        .where(
          and(
            ...invoiceConditions,
            sql`${salesInvoices.dueDate} IS NOT NULL AND ${salesInvoices.dueDate} < CURRENT_DATE AND ${salesInvoices.dueAmount} > 0`
          )
        )
    ]);

    const salesRow = salesRows[0];
    const returnRow = returnRows[0];
    const paymentRow = paymentRows[0];
    const genericPaymentRow = genericPaymentRows[0];
    const overdueRow = overdueRows[0];

    return {
      totalSales: salesRow?.totalSales ?? "0.00",
      totalReturns: returnRow?.totalReturns ?? "0.00",
      totalPayments: (Number(paymentRow?.totalPayments ?? 0) + Number(genericPaymentRow?.totalPayments ?? 0)).toFixed(2),
      debitAdjustments: "0.00",
      creditAdjustments: "0.00",
      overdueAmount: overdueRow?.overdueAmount ?? "0.00"
    };
  }

  public async hasLinkedTransactions(companyId: string, customerId: string): Promise<boolean> {
    const [invoiceRows, paymentRows, genericPaymentRows, returnRows] = await Promise.all([
      db
        .select({ value: count() })
        .from(salesInvoices)
        .where(and(eq(salesInvoices.companyId, companyId), eq(salesInvoices.customerId, customerId), isNull(salesInvoices.deletedAt))),
      db
        .select({ value: count() })
        .from(salesPayments)
        .where(and(eq(salesPayments.companyId, companyId), eq(salesPayments.customerId, customerId))),
      db
        .select({ value: count() })
        .from(payments)
        .where(
          and(
            eq(payments.companyId, companyId),
            eq(payments.partyType, "customer"),
            eq(payments.partyId, customerId),
            isNull(payments.deletedAt)
          )
        ),
      db
        .select({ value: count() })
        .from(salesReturns)
        .where(and(eq(salesReturns.companyId, companyId), eq(salesReturns.customerId, customerId)))
    ]);

    const invoiceRow = invoiceRows[0];
    const paymentRow = paymentRows[0];
    const returnRow = returnRows[0];

    return (
      (invoiceRow?.value ?? 0) > 0 ||
      (paymentRow?.value ?? 0) > 0 ||
      (genericPaymentRows[0]?.value ?? 0) > 0 ||
      (returnRow?.value ?? 0) > 0
    );
  }

  public async listLedgerTransactions(
    companyId: string,
    customerId: string,
    filters?: {
      dateFrom?: Date | undefined;
      dateTo?: Date | undefined;
      transactionType?: string | undefined;
    }
  ) {
    const invoiceConditions: SQL[] = [
      eq(salesInvoices.companyId, companyId),
      eq(salesInvoices.customerId, customerId),
      isNull(salesInvoices.deletedAt),
      sql`${salesInvoices.invoiceStatus} IN ('posted', 'partially_returned', 'returned')`
    ];

    const returnConditions: SQL[] = [eq(salesReturns.companyId, companyId), eq(salesReturns.customerId, customerId)];
    const paymentConditions: SQL[] = [eq(salesPayments.companyId, companyId), eq(salesPayments.customerId, customerId)];

    if (filters?.dateFrom) {
      invoiceConditions.push(sql`${salesInvoices.invoiceDate} >= ${filters.dateFrom}`);
      returnConditions.push(sql`${salesReturns.returnDate} >= ${filters.dateFrom}`);
      paymentConditions.push(sql`${salesPayments.paymentDate} >= ${filters.dateFrom}`);
    }

    if (filters?.dateTo) {
      invoiceConditions.push(sql`${salesInvoices.invoiceDate} <= ${filters.dateTo}`);
      returnConditions.push(sql`${salesReturns.returnDate} <= ${filters.dateTo}`);
      paymentConditions.push(sql`${salesPayments.paymentDate} <= ${filters.dateTo}`);
    }

    const [invoiceRows, returnRows, paymentRows, genericPaymentRows] = await Promise.all([
      filters?.transactionType && filters.transactionType !== "sale"
        ? Promise.resolve([])
        : db
            .select({
              date: salesInvoices.invoiceDate,
              createdAt: salesInvoices.createdAt,
              transactionType: sql<string>`'sale'`,
              referenceNo: salesInvoices.invoiceNumber,
              description: sql<string>`'Sales invoice posted'`,
              debit: salesInvoices.grandTotal,
              credit: sql<string>`'0.00'`,
              paymentMode: sql<string | null>`null`,
              remarks: salesInvoices.notes
            })
            .from(salesInvoices)
            .where(and(...invoiceConditions)),
      filters?.transactionType && filters.transactionType !== "sales_return"
        ? Promise.resolve([])
        : db
            .select({
              date: salesReturns.returnDate,
              createdAt: salesReturns.createdAt,
              transactionType: sql<string>`'sales_return'`,
              referenceNo: salesReturns.returnNumber,
              description: salesReturns.reason,
              debit: sql<string>`'0.00'`,
              credit: salesReturns.grandTotal,
              paymentMode: sql<string | null>`null`,
              remarks: salesReturns.notes
            })
            .from(salesReturns)
            .where(and(...returnConditions)),
      filters?.transactionType && filters.transactionType !== "payment"
        ? Promise.resolve([])
        : db
            .select({
              date: salesPayments.paymentDate,
              createdAt: salesPayments.createdAt,
              transactionType: sql<string>`'payment'`,
              referenceNo: salesPayments.referenceNumber,
              description: sql<string>`'Payment received'`,
              debit: sql<string>`'0.00'`,
              credit: salesPayments.amount,
              paymentMode: salesPayments.paymentMode,
              remarks: salesPayments.notes
            })
            .from(salesPayments)
            .where(and(...paymentConditions)),
      filters?.transactionType && filters.transactionType !== "payment"
        ? Promise.resolve([])
        : db
            .select({
              date: payments.paymentDate,
              createdAt: payments.createdAt,
              transactionType: sql<string>`'payment'`,
              referenceNo: sql<string | null>`coalesce(${payments.referenceNumber}, ${payments.paymentNumber})`,
              description: sql<string>`'Payment received'`,
              debit: sql<string>`'0.00'`,
              credit: payments.amount,
              paymentMode: sql<string | null>`${payments.paymentMode}`,
              remarks: payments.notes
            })
            .from(payments)
            .where(
              and(
                eq(payments.companyId, companyId),
                eq(payments.partyType, "customer"),
                eq(payments.partyId, customerId),
                eq(payments.status, "completed"),
                isNull(payments.deletedAt),
                ...(filters?.dateFrom ? [sql`${payments.paymentDate} >= ${filters.dateFrom}`] : []),
                ...(filters?.dateTo ? [sql`${payments.paymentDate} <= ${filters.dateTo}`] : [])
              )
            )
    ]);

    const rows = [...invoiceRows, ...returnRows, ...paymentRows, ...genericPaymentRows].sort((left, right) => {
      const dateDiff = left.date.getTime() - right.date.getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }

      const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
      if (createdAtDiff !== 0) {
        return createdAtDiff;
      }

      return (left.referenceNo ?? "").localeCompare(right.referenceNo ?? "");
    });

    return {
      rows,
      total: rows.length
    };
  }

  public async listPaymentHistory(
    companyId: string,
    customerId: string,
    filters?: { dateFrom?: Date | undefined; dateTo?: Date | undefined }
  ) {
    const conditions: SQL[] = [eq(salesPayments.companyId, companyId), eq(salesPayments.customerId, customerId)];

    if (filters?.dateFrom) {
      conditions.push(sql`${salesPayments.paymentDate} >= ${filters.dateFrom}`);
    }

    if (filters?.dateTo) {
      conditions.push(sql`${salesPayments.paymentDate} <= ${filters.dateTo}`);
    }

    const [rows, genericRows] = await Promise.all([
      db
        .select({
          id: salesPayments.id,
          date: salesPayments.paymentDate,
          referenceNo: salesPayments.referenceNumber,
          amount: salesPayments.amount,
          paymentMode: salesPayments.paymentMode,
          remarks: salesPayments.notes
        })
        .from(salesPayments)
        .where(and(...conditions))
        .orderBy(desc(salesPayments.paymentDate), desc(salesPayments.createdAt)),
      db
        .select({
          id: payments.id,
          date: payments.paymentDate,
          referenceNo: sql<string | null>`coalesce(${payments.referenceNumber}, ${payments.paymentNumber})`,
          amount: payments.amount,
          paymentMode: sql<string | null>`${payments.paymentMode}`,
          remarks: payments.notes
        })
        .from(payments)
        .where(
          and(
            eq(payments.companyId, companyId),
            eq(payments.partyType, "customer"),
            eq(payments.partyId, customerId),
            eq(payments.status, "completed"),
            isNull(payments.deletedAt),
            ...(filters?.dateFrom ? [sql`${payments.paymentDate} >= ${filters.dateFrom}`] : []),
            ...(filters?.dateTo ? [sql`${payments.paymentDate} <= ${filters.dateTo}`] : [])
          )
        )
        .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
    ]);

    const combinedRows = [...rows, ...genericRows].sort((left, right) => {
      const dateDiff = right.date.getTime() - left.date.getTime();
      if (dateDiff !== 0) {
        return dateDiff;
      }

      return (right.referenceNo ?? "").localeCompare(left.referenceNo ?? "");
    });
    const totalAmount = combinedRows.reduce((sum, row) => sum + Number(row.amount), 0);

    return {
      rows: combinedRows,
      total: combinedRows.length,
      totalAmount: totalAmount.toFixed(2)
    };
  }
}

export const customersRepository = new CustomersRepository();
