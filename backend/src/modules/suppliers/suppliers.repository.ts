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
import { suppliers } from "../../db/schema";

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
    _companyId: string,
    _supplierId: string
  ): Promise<SupplierTransactionTotals> {
    return {
      totalPurchases: "0.00",
      totalPurchaseReturns: "0.00",
      totalPaymentsMade: "0.00",
      debitAdjustments: "0.00",
      creditAdjustments: "0.00",
      overduePayable: "0.00",
      dueInvoicesCount: 0
    };
  }

  public async hasLinkedTransactions(_companyId: string, _supplierId: string): Promise<boolean> {
    return false;
  }

  public async listLedgerTransactions(
    _companyId: string,
    _supplierId: string,
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

  public async listPurchaseHistory(
    _companyId: string,
    _supplierId: string,
    _filters?: {
      dateFrom?: Date | undefined;
      dateTo?: Date | undefined;
      status?: string | null | undefined;
    }
  ) {
    return {
      rows: [] as Array<{
        id: string;
        date: Date;
        referenceNo: string | null;
        status: string | null;
        grossAmount: string;
        returnAmount: string;
        remarks: string | null;
      }>,
      total: 0,
      totalPurchases: "0.00",
      totalPurchaseReturns: "0.00"
    };
  }

  public async listPaymentHistory(
    _companyId: string,
    _supplierId: string,
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

export const suppliersRepository = new SuppliersRepository();
