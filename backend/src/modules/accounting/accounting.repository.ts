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
  or,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "../../db";
import {
  accountOpeningBalances,
  accountingEvents,
  chartOfAccounts,
  companyBankAccounts,
  companyFinancialYears,
  customers,
  employees,
  expenseCategories,
  expenses,
  financialPeriodLocks,
  journalEntries,
  journalEntryLines,
  payments,
  paymentAllocations,
  products,
  purchaseInvoiceItems,
  purchaseInvoices,
  purchasePayments,
  purchaseReturns,
  payrollItems,
  payrollRuns,
  salesInvoiceItems,
  salesInvoices,
  salesPayments,
  salesReturns,
  salaryPayments,
  stockMovements,
  suppliers
} from "../../db/schema";
import type { AccountType, JournalPartyType } from "./accounting.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type AccountListFilters = {
  companyId: string;
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | null | undefined;
  type?: typeof chartOfAccounts.$inferSelect.accountType | undefined;
  status?: typeof chartOfAccounts.$inferSelect.status | undefined;
  parentId?: string | null | undefined;
};

type JournalListFilters = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  voucherType?: typeof journalEntries.$inferSelect.voucherType | undefined;
  status?: typeof journalEntries.$inferSelect.status | undefined;
  referenceType?: string | null | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
  financialYearId?: string | undefined;
};

type OpeningBalanceListFilters = {
  companyId: string;
  page: number;
  limit: number;
  accountId?: string | undefined;
  financialYearId?: string | undefined;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  isLocked?: boolean | undefined;
};

type EventListFilters = {
  companyId: string;
  page: number;
  limit: number;
  status?: typeof accountingEvents.$inferSelect.status | undefined;
  eventType?: string | null;
  referenceType?: string | null;
};

type PeriodLockListFilters = {
  companyId: string;
  financialYearId?: string | undefined;
  isLocked?: boolean | undefined;
};

export class AccountingRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findFinancialYearById(companyId: string, financialYearId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(companyFinancialYears)
      .where(and(eq(companyFinancialYears.companyId, companyId), eq(companyFinancialYears.id, financialYearId)))
      .limit(1);

    return row ?? null;
  }

  public async listFinancialYears(companyId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(companyFinancialYears)
      .where(eq(companyFinancialYears.companyId, companyId))
      .orderBy(desc(companyFinancialYears.startDate));
  }

  public async findAccountById(companyId: string, accountId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.companyId, companyId), eq(chartOfAccounts.id, accountId), isNull(chartOfAccounts.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findAccountByCode(companyId: string, accountCode: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(chartOfAccounts)
      .where(
        and(eq(chartOfAccounts.companyId, companyId), eq(chartOfAccounts.accountCode, accountCode), isNull(chartOfAccounts.deletedAt))
      )
      .limit(1);

    return row ?? null;
  }

  public async findAccountBySystemKey(companyId: string, systemKey: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.companyId, companyId), eq(chartOfAccounts.systemKey, systemKey), isNull(chartOfAccounts.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findAccountsByIds(companyId: string, accountIds: string[], executor?: DbExecutor) {
    if (accountIds.length === 0) {
      return [];
    }

    return this
      .getExecutor(executor)
      .select()
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.companyId, companyId), inArray(chartOfAccounts.id, accountIds), isNull(chartOfAccounts.deletedAt)));
  }

  public async listAccounts(filters: AccountListFilters) {
    const conditions: SQL[] = [eq(chartOfAccounts.companyId, filters.companyId), isNull(chartOfAccounts.deletedAt)];

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(or(ilike(chartOfAccounts.accountName, pattern), ilike(chartOfAccounts.accountCode, pattern))!);
    }

    if (filters.type) {
      conditions.push(eq(chartOfAccounts.accountType, filters.type));
    }

    if (filters.status) {
      conditions.push(eq(chartOfAccounts.status, filters.status));
    }

    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        conditions.push(sql`${chartOfAccounts.parentId} IS NULL`);
      } else {
        conditions.push(eq(chartOfAccounts.parentId, filters.parentId));
      }
    }

    const whereClause = and(...conditions);
    const query = db
      .select()
      .from(chartOfAccounts)
      .where(whereClause)
      .orderBy(asc(chartOfAccounts.accountType), asc(chartOfAccounts.accountCode), asc(chartOfAccounts.createdAt));

    const rows =
      filters.page && filters.limit
        ? await query.limit(filters.limit).offset((filters.page - 1) * filters.limit)
        : await query;

    const [totalRow] = await db.select({ value: count() }).from(chartOfAccounts).where(whereClause);
    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findAccountChildren(companyId: string, parentId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.companyId, companyId), eq(chartOfAccounts.parentId, parentId), isNull(chartOfAccounts.deletedAt)));
  }

  public async listAccountCodesByPrefix(companyId: string, prefix: string, executor?: DbExecutor) {
    const pattern = `${prefix}%`;
    const rows = await this
      .getExecutor(executor)
      .select({ accountCode: chartOfAccounts.accountCode })
      .from(chartOfAccounts)
      .where(and(eq(chartOfAccounts.companyId, companyId), ilike(chartOfAccounts.accountCode, pattern), isNull(chartOfAccounts.deletedAt)));

    return rows.map((row) => row.accountCode);
  }

  public async createAccount(data: typeof chartOfAccounts.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(chartOfAccounts).values(data).returning();
    return row ?? null;
  }

  public async updateAccount(
    companyId: string,
    accountId: string,
    data: Partial<typeof chartOfAccounts.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(chartOfAccounts)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(chartOfAccounts.companyId, companyId), eq(chartOfAccounts.id, accountId), isNull(chartOfAccounts.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async countPostedJournalLinesForAccount(companyId: string, accountId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ value: count() })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntryLines.companyId, companyId),
          eq(journalEntryLines.accountId, accountId),
          inArray(journalEntries.status, ["posted", "reversed"])
        )
      );

    return row?.value ?? 0;
  }

  public async listOpeningBalances(filters: OpeningBalanceListFilters) {
    const conditions: SQL[] = [eq(accountOpeningBalances.companyId, filters.companyId)];

    if (filters.accountId) {
      conditions.push(eq(accountOpeningBalances.accountId, filters.accountId));
    }

    if (filters.financialYearId) {
      conditions.push(eq(accountOpeningBalances.financialYearId, filters.financialYearId));
    }

    if (filters.dateFrom) {
      conditions.push(gte(accountOpeningBalances.openingDate, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(accountOpeningBalances.openingDate, filters.dateTo));
    }

    if (filters.isLocked !== undefined) {
      conditions.push(eq(accountOpeningBalances.isLocked, filters.isLocked));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select({
        openingBalance: accountOpeningBalances,
        account: chartOfAccounts
      })
      .from(accountOpeningBalances)
      .innerJoin(chartOfAccounts, eq(accountOpeningBalances.accountId, chartOfAccounts.id))
      .where(whereClause)
      .orderBy(desc(accountOpeningBalances.openingDate), asc(chartOfAccounts.accountCode))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(accountOpeningBalances).where(whereClause);
    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findOpeningBalanceById(companyId: string, openingBalanceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(accountOpeningBalances)
      .where(and(eq(accountOpeningBalances.companyId, companyId), eq(accountOpeningBalances.id, openingBalanceId)))
      .limit(1);

    return row ?? null;
  }

  public async createOpeningBalance(data: typeof accountOpeningBalances.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(accountOpeningBalances).values(data).returning();
    return row ?? null;
  }

  public async updateOpeningBalance(
    companyId: string,
    openingBalanceId: string,
    data: Partial<typeof accountOpeningBalances.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(accountOpeningBalances)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(accountOpeningBalances.companyId, companyId), eq(accountOpeningBalances.id, openingBalanceId)))
      .returning();

    return row ?? null;
  }

  public async lockOpeningBalances(companyId: string, ids: string[], executor?: DbExecutor) {
    if (ids.length === 0) {
      return [];
    }

    return this
      .getExecutor(executor)
      .update(accountOpeningBalances)
      .set({
        isLocked: true,
        updatedAt: new Date()
      })
      .where(and(eq(accountOpeningBalances.companyId, companyId), inArray(accountOpeningBalances.id, ids)))
      .returning();
  }

  public async getOpeningBalanceTotalsForAccount(companyId: string, accountId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        debit: sql<string>`coalesce(sum(${accountOpeningBalances.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${accountOpeningBalances.credit}), 0)`
      })
      .from(accountOpeningBalances)
      .where(and(eq(accountOpeningBalances.companyId, companyId), eq(accountOpeningBalances.accountId, accountId)));

    return {
      debit: row?.debit ?? "0.00",
      credit: row?.credit ?? "0.00"
    };
  }

  public async listJournals(filters: JournalListFilters) {
    const conditions: SQL[] = [eq(journalEntries.companyId, filters.companyId)];

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(journalEntries.journalNumber, pattern),
          ilike(journalEntries.referenceNumber, pattern),
          ilike(journalEntries.description, pattern)
        )!
      );
    }

    if (filters.voucherType) {
      conditions.push(eq(journalEntries.voucherType, filters.voucherType));
    }

    if (filters.status) {
      conditions.push(eq(journalEntries.status, filters.status));
    }

    if (filters.referenceType) {
      conditions.push(eq(journalEntries.referenceType, filters.referenceType));
    }

    if (filters.financialYearId) {
      conditions.push(eq(journalEntries.financialYearId, filters.financialYearId));
    }

    if (filters.dateFrom) {
      conditions.push(gte(journalEntries.entryDate, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(journalEntries.entryDate, filters.dateTo));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select()
      .from(journalEntries)
      .where(whereClause)
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(journalEntries).where(whereClause);
    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findJournalById(companyId: string, journalId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.id, journalId)))
      .limit(1);

    return row ?? null;
  }

  public async findJournalByReference(companyId: string, referenceType: string, referenceId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.referenceType, referenceType), eq(journalEntries.referenceId, referenceId)))
      .orderBy(desc(journalEntries.createdAt))
      .limit(1);

    return row ?? null;
  }

  public async listJournalsByReference(companyId: string, referenceType: string, referenceId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.referenceType, referenceType), eq(journalEntries.referenceId, referenceId)))
      .orderBy(desc(journalEntries.createdAt));
  }

  public async listJournalLines(companyId: string, journalId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        line: journalEntryLines,
        account: chartOfAccounts
      })
      .from(journalEntryLines)
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(and(eq(journalEntryLines.companyId, companyId), eq(journalEntryLines.journalEntryId, journalId)))
      .orderBy(asc(journalEntryLines.lineNumber), asc(journalEntryLines.createdAt));
  }

  public async findLatestJournalNumberByPrefix(companyId: string, prefix: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ journalNumber: journalEntries.journalNumber })
      .from(journalEntries)
      .where(and(eq(journalEntries.companyId, companyId), ilike(journalEntries.journalNumber, `${prefix}-%`)))
      .orderBy(desc(journalEntries.journalNumber))
      .limit(1);

    return row?.journalNumber ?? null;
  }

  public async createJournal(data: typeof journalEntries.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(journalEntries).values(data).returning();
    return row ?? null;
  }

  public async updateJournal(companyId: string, journalId: string, data: Partial<typeof journalEntries.$inferInsert>, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(journalEntries)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(journalEntries.companyId, companyId), eq(journalEntries.id, journalId)))
      .returning();

    return row ?? null;
  }

  public async deleteJournalLines(companyId: string, journalId: string, executor?: DbExecutor) {
    await this
      .getExecutor(executor)
      .delete(journalEntryLines)
      .where(and(eq(journalEntryLines.companyId, companyId), eq(journalEntryLines.journalEntryId, journalId)));
  }

  public async createJournalLines(data: Array<typeof journalEntryLines.$inferInsert>, executor?: DbExecutor) {
    if (data.length === 0) {
      return [];
    }

    return this.getExecutor(executor).insert(journalEntryLines).values(data).returning();
  }

  public async updateAccountBalance(companyId: string, accountId: string, currentBalance: string, updatedBy: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(chartOfAccounts)
      .set({
        currentBalance,
        updatedBy,
        updatedAt: new Date()
      })
      .where(and(eq(chartOfAccounts.companyId, companyId), eq(chartOfAccounts.id, accountId), isNull(chartOfAccounts.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async listLedgerRows(companyId: string, accountId: string, dateFrom: Date, dateTo: Date, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        journal: journalEntries,
        line: journalEntryLines,
        account: chartOfAccounts
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(
        and(
          eq(journalEntryLines.companyId, companyId),
          eq(journalEntryLines.accountId, accountId),
          inArray(journalEntries.status, ["posted", "reversed"]),
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo)
        )
      )
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.createdAt), asc(journalEntryLines.lineNumber));
  }

  public async getLedgerTotalsBeforeDate(companyId: string, accountId: string, dateFrom: Date, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        debit: sql<string>`coalesce(sum(${journalEntryLines.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${journalEntryLines.credit}), 0)`
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntryLines.companyId, companyId),
          eq(journalEntryLines.accountId, accountId),
          inArray(journalEntries.status, ["posted", "reversed"]),
          sql`${journalEntries.entryDate} < ${dateFrom}`
        )
      );

    return {
      debit: row?.debit ?? "0.00",
      credit: row?.credit ?? "0.00"
    };
  }

  public async listPartyLedgerRows(companyId: string, partyType: JournalPartyType, partyId: string, dateFrom: Date, dateTo: Date, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        journal: journalEntries,
        line: journalEntryLines,
        account: chartOfAccounts
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(
        and(
          eq(journalEntryLines.companyId, companyId),
          eq(journalEntryLines.partyType, partyType),
          eq(journalEntryLines.partyId, partyId),
          inArray(journalEntries.status, ["posted", "reversed"]),
          gte(journalEntries.entryDate, dateFrom),
          lte(journalEntries.entryDate, dateTo)
        )
      )
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.createdAt), asc(journalEntryLines.lineNumber));
  }

  public async getPartyLedgerTotalsBeforeDate(companyId: string, partyType: JournalPartyType, partyId: string, dateFrom: Date, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        debit: sql<string>`coalesce(sum(${journalEntryLines.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${journalEntryLines.credit}), 0)`
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntryLines.companyId, companyId),
          eq(journalEntryLines.partyType, partyType),
          eq(journalEntryLines.partyId, partyId),
          inArray(journalEntries.status, ["posted", "reversed"]),
          sql`${journalEntries.entryDate} < ${dateFrom}`
        )
      );

    return {
      debit: row?.debit ?? "0.00",
      credit: row?.credit ?? "0.00"
    };
  }

  public async listBookRows(
    companyId: string,
    systemKey: string,
    dateFrom: Date,
    dateTo: Date,
    bankAccountId?: string,
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [
      eq(journalEntryLines.companyId, companyId),
      eq(chartOfAccounts.systemKey, systemKey),
      inArray(journalEntries.status, ["posted", "reversed"]),
      gte(journalEntries.entryDate, dateFrom),
      lte(journalEntries.entryDate, dateTo)
    ];

    if (systemKey === "bank" && bankAccountId) {
      conditions.push(eq(journalEntryLines.referenceType, "company_bank_account"));
      conditions.push(eq(journalEntryLines.referenceId, bankAccountId));
    }

    return this
      .getExecutor(executor)
      .select({
        journal: journalEntries,
        line: journalEntryLines,
        account: chartOfAccounts
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(and(...conditions))
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.createdAt), asc(journalEntryLines.lineNumber));
  }

  public async getGroupedAccountLineTotals(
    companyId: string,
    options: {
      dateFrom?: Date | null;
      dateTo?: Date | null;
      accountTypes?: AccountType[];
    },
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [eq(journalEntries.companyId, companyId), inArray(journalEntries.status, ["posted", "reversed"])];

    if (options.dateFrom) {
      conditions.push(gte(journalEntries.entryDate, options.dateFrom));
    }

    if (options.dateTo) {
      conditions.push(lte(journalEntries.entryDate, options.dateTo));
    }

    if (options.accountTypes && options.accountTypes.length > 0) {
      conditions.push(inArray(chartOfAccounts.accountType, options.accountTypes));
    }

    return this
      .getExecutor(executor)
      .select({
        accountId: chartOfAccounts.id,
        accountCode: chartOfAccounts.accountCode,
        accountName: chartOfAccounts.accountName,
        accountType: chartOfAccounts.accountType,
        accountSubtype: chartOfAccounts.accountSubtype,
        normalBalance: chartOfAccounts.normalBalance,
        debit: sql<string>`coalesce(sum(${journalEntryLines.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${journalEntryLines.credit}), 0)`
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(and(...conditions))
      .groupBy(
        chartOfAccounts.id,
        chartOfAccounts.accountCode,
        chartOfAccounts.accountName,
        chartOfAccounts.accountType,
        chartOfAccounts.accountSubtype,
        chartOfAccounts.normalBalance
      )
      .orderBy(asc(chartOfAccounts.accountType), asc(chartOfAccounts.accountCode));
  }

  public async listEvents(filters: EventListFilters) {
    const conditions: SQL[] = [eq(accountingEvents.companyId, filters.companyId)];

    if (filters.status) {
      conditions.push(eq(accountingEvents.status, filters.status));
    }

    if (filters.eventType) {
      conditions.push(eq(accountingEvents.eventType, filters.eventType));
    }

    if (filters.referenceType) {
      conditions.push(eq(accountingEvents.referenceType, filters.referenceType));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select()
      .from(accountingEvents)
      .where(whereClause)
      .orderBy(desc(accountingEvents.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(accountingEvents).where(whereClause);
    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listPendingEvents(companyId: string, limit: number, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(accountingEvents)
      .where(and(eq(accountingEvents.companyId, companyId), eq(accountingEvents.status, "pending")))
      .orderBy(asc(accountingEvents.createdAt))
      .limit(limit);
  }

  public async findEventById(companyId: string, eventId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(accountingEvents)
      .where(and(eq(accountingEvents.companyId, companyId), eq(accountingEvents.id, eventId)))
      .limit(1);

    return row ?? null;
  }

  public async updateEvent(companyId: string, eventId: string, data: Partial<typeof accountingEvents.$inferInsert>, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(accountingEvents)
      .set(data)
      .where(and(eq(accountingEvents.companyId, companyId), eq(accountingEvents.id, eventId)))
      .returning();

    return row ?? null;
  }

  public async listPeriodLocks(filters: PeriodLockListFilters) {
    const conditions: SQL[] = [eq(financialPeriodLocks.companyId, filters.companyId)];

    if (filters.financialYearId) {
      conditions.push(eq(financialPeriodLocks.financialYearId, filters.financialYearId));
    }

    if (filters.isLocked !== undefined) {
      conditions.push(eq(financialPeriodLocks.isLocked, filters.isLocked));
    }

    return db
      .select()
      .from(financialPeriodLocks)
      .where(and(...conditions))
      .orderBy(desc(financialPeriodLocks.periodStart), desc(financialPeriodLocks.createdAt));
  }

  public async findPeriodLockById(companyId: string, lockId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(financialPeriodLocks)
      .where(and(eq(financialPeriodLocks.companyId, companyId), eq(financialPeriodLocks.id, lockId)))
      .limit(1);

    return row ?? null;
  }

  public async findBlockingPeriodLock(companyId: string, targetDate: Date, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(financialPeriodLocks)
      .where(
        and(
          eq(financialPeriodLocks.companyId, companyId),
          eq(financialPeriodLocks.isLocked, true),
          lte(financialPeriodLocks.periodStart, targetDate),
          gte(financialPeriodLocks.periodEnd, targetDate)
        )
      )
      .orderBy(desc(financialPeriodLocks.periodEnd))
      .limit(1);

    return row ?? null;
  }

  public async createPeriodLock(data: typeof financialPeriodLocks.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(financialPeriodLocks).values(data).returning();
    return row ?? null;
  }

  public async deletePeriodLock(companyId: string, lockId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .delete(financialPeriodLocks)
      .where(and(eq(financialPeriodLocks.companyId, companyId), eq(financialPeriodLocks.id, lockId)))
      .returning();

    return row ?? null;
  }

  public async getSalesInvoiceAccountingContext(companyId: string, salesInvoiceId: string, executor?: DbExecutor) {
    const [invoiceRow] = await this
      .getExecutor(executor)
      .select({
        invoice: salesInvoices,
        customerName: customers.name,
        customerCode: customers.customerCode
      })
      .from(salesInvoices)
      .leftJoin(customers, eq(salesInvoices.customerId, customers.id))
      .where(and(eq(salesInvoices.companyId, companyId), eq(salesInvoices.id, salesInvoiceId), isNull(salesInvoices.deletedAt)))
      .limit(1);

    if (!invoiceRow) {
      return null;
    }

    const items = await this
      .getExecutor(executor)
      .select({
        productType: products.productType,
        taxableAmount: salesInvoiceItems.taxableAmount,
        lineTotal: salesInvoiceItems.lineTotal,
        cgstAmount: salesInvoiceItems.cgstAmount,
        sgstAmount: salesInvoiceItems.sgstAmount,
        igstAmount: salesInvoiceItems.igstAmount,
        cessAmount: salesInvoiceItems.cessAmount
      })
      .from(salesInvoiceItems)
      .innerJoin(products, eq(salesInvoiceItems.productId, products.id))
      .where(and(eq(salesInvoiceItems.companyId, companyId), eq(salesInvoiceItems.salesInvoiceId, salesInvoiceId)));

    const [inventoryRow] = await this
      .getExecutor(executor)
      .select({
        value: sql<string>`coalesce(sum(${stockMovements.value}), 0)`
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.companyId, companyId),
          eq(stockMovements.referenceType, "sales_invoice"),
          eq(stockMovements.referenceId, salesInvoiceId)
        )
      );

    return {
      ...invoiceRow,
      items,
      inventoryValue: inventoryRow?.value ?? "0.00"
    };
  }

  public async getSalesReturnAccountingContext(companyId: string, salesReturnId: string, executor?: DbExecutor) {
    const [returnRow] = await this
      .getExecutor(executor)
      .select({
        salesReturn: salesReturns,
        invoice: salesInvoices,
        customerName: customers.name,
        customerCode: customers.customerCode
      })
      .from(salesReturns)
      .innerJoin(salesInvoices, eq(salesReturns.salesInvoiceId, salesInvoices.id))
      .leftJoin(customers, eq(salesReturns.customerId, customers.id))
      .where(and(eq(salesReturns.companyId, companyId), eq(salesReturns.id, salesReturnId)))
      .limit(1);

    if (!returnRow) {
      return null;
    }

    const [inventoryRow] = await this
      .getExecutor(executor)
      .select({
        value: sql<string>`coalesce(sum(${stockMovements.value}), 0)`
      })
      .from(stockMovements)
      .where(
        and(eq(stockMovements.companyId, companyId), eq(stockMovements.referenceType, "sales_return"), eq(stockMovements.referenceId, salesReturnId))
      );

    return {
      ...returnRow,
      inventoryValue: inventoryRow?.value ?? "0.00"
    };
  }

  public async getPurchaseInvoiceAccountingContext(companyId: string, purchaseInvoiceId: string, executor?: DbExecutor) {
    const [invoiceRow] = await this
      .getExecutor(executor)
      .select({
        invoice: purchaseInvoices,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .where(and(eq(purchaseInvoices.companyId, companyId), eq(purchaseInvoices.id, purchaseInvoiceId), isNull(purchaseInvoices.deletedAt)))
      .limit(1);

    if (!invoiceRow) {
      return null;
    }

    const items = await this
      .getExecutor(executor)
      .select({
        productType: products.productType,
        taxableAmount: purchaseInvoiceItems.taxableAmount,
        lineTotal: purchaseInvoiceItems.lineTotal,
        freeQuantity: purchaseInvoiceItems.freeQuantity,
        quantity: purchaseInvoiceItems.quantity
      })
      .from(purchaseInvoiceItems)
      .innerJoin(products, eq(purchaseInvoiceItems.productId, products.id))
      .where(and(eq(purchaseInvoiceItems.companyId, companyId), eq(purchaseInvoiceItems.purchaseInvoiceId, purchaseInvoiceId)));

    const [inventoryRow] = await this
      .getExecutor(executor)
      .select({
        value: sql<string>`coalesce(sum(${stockMovements.value}), 0)`
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.companyId, companyId),
          eq(stockMovements.referenceType, "purchase_invoice"),
          eq(stockMovements.referenceId, purchaseInvoiceId)
        )
      );

    return {
      ...invoiceRow,
      items,
      inventoryValue: inventoryRow?.value ?? "0.00"
    };
  }

  public async getPurchaseReturnAccountingContext(companyId: string, purchaseReturnId: string, executor?: DbExecutor) {
    const [returnRow] = await this
      .getExecutor(executor)
      .select({
        purchaseReturn: purchaseReturns,
        invoice: purchaseInvoices,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode
      })
      .from(purchaseReturns)
      .innerJoin(purchaseInvoices, eq(purchaseReturns.purchaseInvoiceId, purchaseInvoices.id))
      .innerJoin(suppliers, eq(purchaseReturns.supplierId, suppliers.id))
      .where(and(eq(purchaseReturns.companyId, companyId), eq(purchaseReturns.id, purchaseReturnId)))
      .limit(1);

    if (!returnRow) {
      return null;
    }

    const [inventoryRow] = await this
      .getExecutor(executor)
      .select({
        value: sql<string>`coalesce(sum(${stockMovements.value}), 0)`
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.companyId, companyId),
          eq(stockMovements.referenceType, "purchase_return"),
          eq(stockMovements.referenceId, purchaseReturnId)
        )
      );

    return {
      ...returnRow,
      inventoryValue: inventoryRow?.value ?? "0.00"
    };
  }

  public async getExpenseAccountingContext(companyId: string, expenseId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        expense: expenses,
        category: expenseCategories
      })
      .from(expenses)
      .innerJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(eq(expenses.companyId, companyId), eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async getPaymentAccountingContext(companyId: string, paymentId: string, executor?: DbExecutor) {
    const [paymentRow] = await this
      .getExecutor(executor)
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
      .where(and(eq(payments.companyId, companyId), eq(payments.id, paymentId), isNull(payments.deletedAt)))
      .limit(1);

    if (!paymentRow) {
      return null;
    }

    const allocations = await this
      .getExecutor(executor)
      .select()
      .from(paymentAllocations)
      .where(and(eq(paymentAllocations.companyId, companyId), eq(paymentAllocations.paymentId, paymentId)))
      .orderBy(asc(paymentAllocations.createdAt));

    const bankAccount =
      paymentRow.payment.bankAccountId
        ? await this
            .getExecutor(executor)
            .select()
            .from(companyBankAccounts)
            .where(and(eq(companyBankAccounts.companyId, companyId), eq(companyBankAccounts.id, paymentRow.payment.bankAccountId)))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : null;

    return {
      ...paymentRow,
      allocations,
      bankAccount
    };
  }

  public async getPayrollRunAccountingContext(companyId: string, payrollRunId: string, executor?: DbExecutor) {
    const [run] = await this
      .getExecutor(executor)
      .select()
      .from(payrollRuns)
      .where(and(eq(payrollRuns.companyId, companyId), eq(payrollRuns.id, payrollRunId)))
      .limit(1);

    if (!run) {
      return null;
    }

    const items = await this
      .getExecutor(executor)
      .select({
        item: payrollItems,
        employee: employees
      })
      .from(payrollItems)
      .innerJoin(employees, eq(payrollItems.employeeId, employees.id))
      .where(and(eq(payrollItems.companyId, companyId), eq(payrollItems.payrollRunId, payrollRunId)))
      .orderBy(asc(payrollItems.employeeNameSnapshot));

    const paymentsForRun = await this
      .getExecutor(executor)
      .select()
      .from(salaryPayments)
      .where(and(eq(salaryPayments.companyId, companyId), eq(salaryPayments.payrollRunId, payrollRunId)))
      .orderBy(asc(salaryPayments.paymentDate), asc(salaryPayments.createdAt));

    return {
      run,
      items,
      payments: paymentsForRun
    };
  }

  public async getSalesPaymentAccountingContext(companyId: string, salesPaymentId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        payment: salesPayments,
        invoice: salesInvoices,
        customerName: customers.name,
        customerCode: customers.customerCode
      })
      .from(salesPayments)
      .innerJoin(salesInvoices, eq(salesPayments.salesInvoiceId, salesInvoices.id))
      .leftJoin(customers, eq(salesPayments.customerId, customers.id))
      .where(and(eq(salesPayments.companyId, companyId), eq(salesPayments.id, salesPaymentId)))
      .limit(1);

    return row ?? null;
  }

  public async getPurchasePaymentAccountingContext(companyId: string, purchasePaymentId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        payment: purchasePayments,
        invoice: purchaseInvoices,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode
      })
      .from(purchasePayments)
      .innerJoin(purchaseInvoices, eq(purchasePayments.purchaseInvoiceId, purchaseInvoices.id))
      .innerJoin(suppliers, eq(purchasePayments.supplierId, suppliers.id))
      .where(and(eq(purchasePayments.companyId, companyId), eq(purchasePayments.id, purchasePaymentId)))
      .limit(1);

    return row ?? null;
  }
}

export const accountingRepository = new AccountingRepository();
