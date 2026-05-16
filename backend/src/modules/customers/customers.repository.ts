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
import { customers } from "../../db/schema";

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
    return sql<string>`
      CASE
        WHEN ${customers.openingBalanceType} = 'debit' THEN ${customers.openingBalanceAmount}
        WHEN ${customers.openingBalanceType} = 'credit' THEN (${customers.openingBalanceAmount} * -1)
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

    return db.select().from(customers).where(whereClause).orderBy(...orderBy);
  }

  public async getCustomerTransactionTotals(_companyId: string, _customerId: string): Promise<CustomerTransactionTotals> {
    return {
      totalSales: "0.00",
      totalReturns: "0.00",
      totalPayments: "0.00",
      debitAdjustments: "0.00",
      creditAdjustments: "0.00",
      overdueAmount: "0.00"
    };
  }

  public async hasLinkedTransactions(_companyId: string, _customerId: string): Promise<boolean> {
    return false;
  }

  public async listLedgerTransactions(
    _companyId: string,
    _customerId: string,
    _filters?: {
      dateFrom?: Date | undefined;
      dateTo?: Date | undefined;
      transactionType?: string | undefined;
    }
  ) {
    return {
      rows: [] as Array<{
        date: Date;
        transactionType: string;
        referenceNo: string | null;
        description: string;
        debit: string;
        credit: string;
        paymentMode: string | null;
        remarks: string | null;
      }>,
      total: 0
    };
  }

  public async listPaymentHistory(
    _companyId: string,
    _customerId: string,
    _filters?: { dateFrom?: Date | undefined; dateTo?: Date | undefined }
  ) {
    return {
      rows: [] as Array<{
        id: string;
        date: Date;
        referenceNo: string | null;
        amount: string;
        paymentMode: string | null;
        remarks: string | null;
      }>,
      total: 0,
      totalAmount: "0.00"
    };
  }
}

export const customersRepository = new CustomersRepository();
