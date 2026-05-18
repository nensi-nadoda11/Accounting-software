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
  chartOfAccounts,
  companies,
  companyBankAccounts,
  expenseAttachments,
  expenseCategories,
  expenses,
  recurringExpenses
} from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type ExpenseListFilters = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  categoryId?: string | undefined;
  paymentMode?: typeof expenses.$inferSelect.paymentMode | undefined;
  status?: typeof expenses.$inferSelect.status | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
  gstApplicable?: boolean | undefined;
  recurringExpenseId?: string | undefined;
};

type CategoryListFilters = {
  companyId: string;
  search?: string | null | undefined;
  status?: typeof expenseCategories.$inferSelect.status | undefined;
  parentId?: string | null | undefined;
};

type RecurringListFilters = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  status?: typeof recurringExpenses.$inferSelect.status | undefined;
  frequency?: typeof recurringExpenses.$inferSelect.frequency | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
};

type ReportFilters = {
  companyId: string;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
  categoryId?: string | undefined;
  paymentMode?: typeof expenses.$inferSelect.paymentMode | undefined;
  includeDrafts?: boolean | undefined;
};

class ExpensesRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private buildCategoryConditions(filters: CategoryListFilters) {
    const conditions: SQL[] = [eq(expenseCategories.companyId, filters.companyId), isNull(expenseCategories.deletedAt)];

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(ilike(expenseCategories.name, pattern), ilike(expenseCategories.categoryCode, pattern), ilike(expenseCategories.description, pattern))!
      );
    }

    if (filters.status) {
      conditions.push(eq(expenseCategories.status, filters.status));
    }

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        conditions.push(sql`${expenseCategories.parentId} IS NULL`);
      } else {
        conditions.push(eq(expenseCategories.parentId, filters.parentId));
      }
    }

    return conditions;
  }

  private buildExpenseConditions(filters: Omit<ExpenseListFilters, "page" | "limit">) {
    const conditions: SQL[] = [eq(expenses.companyId, filters.companyId), isNull(expenses.deletedAt)];

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(expenses.expenseNumber, pattern),
          ilike(expenses.description, pattern),
          ilike(expenses.payeeName, pattern),
          ilike(expenses.referenceNumber, pattern)
        )!
      );
    }

    if (filters.categoryId) {
      conditions.push(eq(expenses.categoryId, filters.categoryId));
    }

    if (filters.paymentMode) {
      conditions.push(eq(expenses.paymentMode, filters.paymentMode));
    }

    if (filters.status) {
      conditions.push(eq(expenses.status, filters.status));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${expenses.expenseDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${expenses.expenseDate} <= ${filters.dateTo}`);
    }

    if (filters.gstApplicable !== undefined) {
      conditions.push(eq(expenses.gstApplicable, filters.gstApplicable));
    }

    if (filters.recurringExpenseId) {
      conditions.push(eq(expenses.recurringExpenseId, filters.recurringExpenseId));
    }

    return conditions;
  }

  private buildReportConditions(filters: ReportFilters) {
    const conditions: SQL[] = [eq(expenses.companyId, filters.companyId), isNull(expenses.deletedAt)];

    if (filters.includeDrafts) {
      conditions.push(or(eq(expenses.status, "draft"), eq(expenses.status, "posted"))!);
    } else {
      conditions.push(eq(expenses.status, "posted"));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${expenses.expenseDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${expenses.expenseDate} <= ${filters.dateTo}`);
    }

    if (filters.categoryId) {
      conditions.push(eq(expenses.categoryId, filters.categoryId));
    }

    if (filters.paymentMode) {
      conditions.push(eq(expenses.paymentMode, filters.paymentMode));
    }

    return conditions;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findLatestExpenseNumber(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ expenseNumber: expenses.expenseNumber })
      .from(expenses)
      .where(eq(expenses.companyId, companyId))
      .orderBy(desc(expenses.expenseNumber))
      .limit(1);

    return row?.expenseNumber ?? null;
  }

  public async findLatestCategoryCode(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ categoryCode: expenseCategories.categoryCode })
      .from(expenseCategories)
      .where(eq(expenseCategories.companyId, companyId))
      .orderBy(desc(expenseCategories.categoryCode))
      .limit(1);

    return row?.categoryCode ?? null;
  }

  public async listCategories(filters: CategoryListFilters) {
    return db
      .select()
      .from(expenseCategories)
      .where(and(...this.buildCategoryConditions(filters)))
      .orderBy(asc(expenseCategories.name), asc(expenseCategories.createdAt));
  }

  public async findCategoryById(companyId: string, categoryId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(expenseCategories)
      .where(and(eq(expenseCategories.companyId, companyId), eq(expenseCategories.id, categoryId), isNull(expenseCategories.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findCategoriesByIds(companyId: string, categoryIds: string[], executor?: DbExecutor) {
    if (categoryIds.length === 0) {
      return [];
    }

    return this
      .getExecutor(executor)
      .select()
      .from(expenseCategories)
      .where(and(eq(expenseCategories.companyId, companyId), inArray(expenseCategories.id, categoryIds), isNull(expenseCategories.deletedAt)));
  }

  public async findCategoryByName(companyId: string, name: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(expenseCategories.companyId, companyId), eq(expenseCategories.name, name), isNull(expenseCategories.deletedAt)];

    if (excludeId) {
      conditions.push(ne(expenseCategories.id, excludeId));
    }

    const [row] = await this.getExecutor(executor).select().from(expenseCategories).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async createCategory(data: typeof expenseCategories.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(expenseCategories).values(data).returning();
    return row ?? null;
  }

  public async updateCategory(
    companyId: string,
    categoryId: string,
    data: Partial<typeof expenseCategories.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(expenseCategories)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(expenseCategories.companyId, companyId), eq(expenseCategories.id, categoryId), isNull(expenseCategories.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async countExpensesByCategory(companyId: string, categoryId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ value: count() })
      .from(expenses)
      .where(and(eq(expenses.companyId, companyId), eq(expenses.categoryId, categoryId), isNull(expenses.deletedAt)));

    return row?.value ?? 0;
  }

  public async countRecurringByCategory(companyId: string, categoryId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ value: count() })
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.companyId, companyId), eq(recurringExpenses.categoryId, categoryId), isNull(recurringExpenses.deletedAt)));

    return row?.value ?? 0;
  }

  public async createExpense(data: typeof expenses.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(expenses).values(data).returning();
    return row ?? null;
  }

  public async findExpenseById(companyId: string, expenseId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(expenses)
      .where(and(eq(expenses.companyId, companyId), eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async updateExpense(companyId: string, expenseId: string, data: Partial<typeof expenses.$inferInsert>, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(expenses)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(expenses.companyId, companyId), eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async softDeleteExpense(companyId: string, expenseId: string, actorId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(expenses)
      .set({
        updatedBy: actorId,
        updatedAt: new Date(),
        deletedAt: new Date()
      })
      .where(and(eq(expenses.companyId, companyId), eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async findExpenseDetail(companyId: string, expenseId: string) {
    const [row] = await db
      .select({
        expense: expenses,
        category: expenseCategories,
        account: chartOfAccounts,
        bankAccount: companyBankAccounts
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(chartOfAccounts, eq(expenses.expenseAccountId, chartOfAccounts.id))
      .leftJoin(companyBankAccounts, eq(expenses.bankAccountId, companyBankAccounts.id))
      .where(and(eq(expenses.companyId, companyId), eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async listExpenses(filters: ExpenseListFilters) {
    const whereClause = and(...this.buildExpenseConditions(filters));

    const rows = await db
      .select({
        expense: expenses,
        categoryName: expenseCategories.name,
        categoryCode: expenseCategories.categoryCode,
        accountName: chartOfAccounts.accountName,
        accountCode: chartOfAccounts.accountCode
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .leftJoin(chartOfAccounts, eq(expenses.expenseAccountId, chartOfAccounts.id))
      .where(whereClause)
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(expenses).where(whereClause);

    const [summaryRow] = await db
      .select({
        amount: sql<string>`coalesce(sum(${expenses.amount}), 0)`,
        taxableAmount: sql<string>`coalesce(sum(${expenses.taxableAmount}), 0)`,
        gstAmount: sql<string>`coalesce(sum(${expenses.gstAmount}), 0)`,
        totalAmount: sql<string>`coalesce(sum(${expenses.totalAmount}), 0)`
      })
      .from(expenses)
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0,
      summary: {
        amount: summaryRow?.amount ?? "0.00",
        taxableAmount: summaryRow?.taxableAmount ?? "0.00",
        gstAmount: summaryRow?.gstAmount ?? "0.00",
        totalAmount: summaryRow?.totalAmount ?? "0.00"
      }
    };
  }

  public async listExpensesForExport(filters: Omit<ExpenseListFilters, "page" | "limit">) {
    return db
      .select({
        expense: expenses,
        categoryName: expenseCategories.name
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(...this.buildExpenseConditions(filters)))
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
  }

  public async listExpenseAttachments(companyId: string, expenseId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(expenseAttachments)
      .where(and(eq(expenseAttachments.companyId, companyId), eq(expenseAttachments.expenseId, expenseId), isNull(expenseAttachments.deletedAt)))
      .orderBy(asc(expenseAttachments.createdAt));
  }

  public async countActiveAttachments(companyId: string, expenseId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ value: count() })
      .from(expenseAttachments)
      .where(and(eq(expenseAttachments.companyId, companyId), eq(expenseAttachments.expenseId, expenseId), isNull(expenseAttachments.deletedAt)));

    return row?.value ?? 0;
  }

  public async createExpenseAttachments(data: Array<typeof expenseAttachments.$inferInsert>, executor?: DbExecutor) {
    if (data.length === 0) {
      return [];
    }

    return this.getExecutor(executor).insert(expenseAttachments).values(data).returning();
  }

  public async findAttachmentById(companyId: string, attachmentId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(expenseAttachments)
      .where(and(eq(expenseAttachments.companyId, companyId), eq(expenseAttachments.id, attachmentId), isNull(expenseAttachments.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async softDeleteAttachment(companyId: string, attachmentId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(expenseAttachments)
      .set({
        deletedAt: new Date()
      })
      .where(and(eq(expenseAttachments.companyId, companyId), eq(expenseAttachments.id, attachmentId), isNull(expenseAttachments.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async softDeleteAttachmentsByExpense(companyId: string, expenseId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .update(expenseAttachments)
      .set({
        deletedAt: new Date()
      })
      .where(and(eq(expenseAttachments.companyId, companyId), eq(expenseAttachments.expenseId, expenseId), isNull(expenseAttachments.deletedAt)))
      .returning();
  }

  public async createRecurringExpense(data: typeof recurringExpenses.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(recurringExpenses).values(data).returning();
    return row ?? null;
  }

  public async findRecurringExpenseById(companyId: string, recurringExpenseId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.companyId, companyId), eq(recurringExpenses.id, recurringExpenseId), isNull(recurringExpenses.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async updateRecurringExpense(
    companyId: string,
    recurringExpenseId: string,
    data: Partial<typeof recurringExpenses.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(recurringExpenses)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(recurringExpenses.companyId, companyId), eq(recurringExpenses.id, recurringExpenseId), isNull(recurringExpenses.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async listRecurringExpenses(filters: RecurringListFilters) {
    const conditions: SQL[] = [eq(recurringExpenses.companyId, filters.companyId), isNull(recurringExpenses.deletedAt)];

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(ilike(recurringExpenses.templateName, pattern), ilike(recurringExpenses.description, pattern), ilike(recurringExpenses.payeeName, pattern))!
      );
    }

    if (filters.status) {
      conditions.push(eq(recurringExpenses.status, filters.status));
    }

    if (filters.frequency) {
      conditions.push(eq(recurringExpenses.frequency, filters.frequency));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${recurringExpenses.nextRunDate} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${recurringExpenses.nextRunDate} <= ${filters.dateTo}`);
    }

    const whereClause = and(...conditions);

    const rows = await db
      .select({
        recurring: recurringExpenses,
        categoryName: expenseCategories.name,
        accountName: chartOfAccounts.accountName
      })
      .from(recurringExpenses)
      .innerJoin(expenseCategories, eq(recurringExpenses.categoryId, expenseCategories.id))
      .leftJoin(chartOfAccounts, eq(recurringExpenses.expenseAccountId, chartOfAccounts.id))
      .where(whereClause)
      .orderBy(asc(recurringExpenses.nextRunDate), asc(recurringExpenses.templateName))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(recurringExpenses).where(whereClause);
    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listDueRecurringExpenses(companyId: string, runUntil: Date, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(recurringExpenses)
      .where(
        and(
          eq(recurringExpenses.companyId, companyId),
          eq(recurringExpenses.autoCreateEnabled, true),
          eq(recurringExpenses.status, "active"),
          isNull(recurringExpenses.deletedAt),
          sql`${recurringExpenses.nextRunDate} <= ${runUntil}`,
          sql`${recurringExpenses.endDate} IS NULL OR ${recurringExpenses.endDate} >= ${recurringExpenses.nextRunDate}`
        )
      )
      .orderBy(asc(recurringExpenses.nextRunDate), asc(recurringExpenses.createdAt));
  }

  public async createAccountingEvent(data: typeof accountingEvents.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(accountingEvents).values(data).returning();
    return row ?? null;
  }

  public async getCategoryWiseReport(filters: ReportFilters) {
    return db
      .select({
        categoryId: expenses.categoryId,
        categoryName: expenseCategories.name,
        expenseCount: count(),
        taxableAmount: sql<string>`coalesce(sum(${expenses.taxableAmount}), 0)`,
        gstAmount: sql<string>`coalesce(sum(${expenses.gstAmount}), 0)`,
        totalAmount: sql<string>`coalesce(sum(${expenses.totalAmount}), 0)`
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(...this.buildReportConditions(filters)))
      .groupBy(expenses.categoryId, expenseCategories.name)
      .orderBy(desc(sql`coalesce(sum(${expenses.totalAmount}), 0)`), asc(expenseCategories.name));
  }

  public async getMonthlyReport(filters: ReportFilters) {
    return db
      .select({
        month: sql<string>`to_char(${expenses.expenseDate}, 'YYYY-MM')`,
        expenseCount: count(),
        taxableAmount: sql<string>`coalesce(sum(${expenses.taxableAmount}), 0)`,
        gstAmount: sql<string>`coalesce(sum(${expenses.gstAmount}), 0)`,
        totalAmount: sql<string>`coalesce(sum(${expenses.totalAmount}), 0)`
      })
      .from(expenses)
      .where(and(...this.buildReportConditions(filters)))
      .groupBy(sql`to_char(${expenses.expenseDate}, 'YYYY-MM')`)
      .orderBy(asc(sql`to_char(${expenses.expenseDate}, 'YYYY-MM')`));
  }

  public async getPaymentModeReport(filters: ReportFilters) {
    return db
      .select({
        paymentMode: expenses.paymentMode,
        expenseCount: count(),
        totalAmount: sql<string>`coalesce(sum(${expenses.totalAmount}), 0)`
      })
      .from(expenses)
      .where(and(...this.buildReportConditions(filters)))
      .groupBy(expenses.paymentMode)
      .orderBy(desc(sql`coalesce(sum(${expenses.totalAmount}), 0)`), asc(expenses.paymentMode));
  }

  public async getGstReport(filters: ReportFilters) {
    return db
      .select({
        gstApplicable: expenses.gstApplicable,
        gstRate: expenses.gstRate,
        expenseCount: count(),
        taxableAmount: sql<string>`coalesce(sum(${expenses.taxableAmount}), 0)`,
        cgstAmount: sql<string>`coalesce(sum(${expenses.cgstAmount}), 0)`,
        sgstAmount: sql<string>`coalesce(sum(${expenses.sgstAmount}), 0)`,
        igstAmount: sql<string>`coalesce(sum(${expenses.igstAmount}), 0)`,
        gstAmount: sql<string>`coalesce(sum(${expenses.gstAmount}), 0)`,
        totalAmount: sql<string>`coalesce(sum(${expenses.totalAmount}), 0)`
      })
      .from(expenses)
      .where(and(...this.buildReportConditions(filters)))
      .groupBy(expenses.gstApplicable, expenses.gstRate)
      .orderBy(asc(expenses.gstApplicable), asc(expenses.gstRate));
  }

  public async findCompanyTaxContext(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        id: companies.id,
        gstNumber: companies.gstNumber,
        state: companies.state
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    return row ?? null;
  }
}

export const expensesRepository = new ExpensesRepository();
