import { and, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../db";
import { appSettings, cashVerifications, chartOfAccounts, journalEntries, journalEntryLines, users } from "../../db/schema";
import type { CashVerificationRecordStatus, CashVerificationStatus } from "./cashVerification.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type ListCashVerificationsParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  status?: CashVerificationStatus | undefined;
  recordStatus?: CashVerificationRecordStatus | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
};

class CashVerificationRepository {
  private approvedUsers = alias(users, "cash_verification_approved_user");

  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private buildListConditions(params: Omit<ListCashVerificationsParams, "page" | "limit">) {
    const conditions: SQL[] = [eq(cashVerifications.companyId, params.companyId)];

    if (params.status) {
      conditions.push(eq(cashVerifications.status, params.status));
    }

    if (params.recordStatus) {
      conditions.push(eq(cashVerifications.recordStatus, params.recordStatus));
    }

    if (params.dateFrom) {
      conditions.push(sql`${cashVerifications.verificationDate} >= ${params.dateFrom.toISOString().slice(0, 10)}`);
    }

    if (params.dateTo) {
      conditions.push(sql`${cashVerifications.verificationDate} <= ${params.dateTo.toISOString().slice(0, 10)}`);
    }

    if (params.search) {
      const pattern = `%${params.search}%`;
      conditions.push(or(ilike(cashVerifications.verificationNo, pattern), ilike(users.fullName, pattern))!);
    }

    return conditions;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findLatestVerificationNo(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ verificationNo: cashVerifications.verificationNo })
      .from(cashVerifications)
      .where(eq(cashVerifications.companyId, companyId))
      .orderBy(desc(cashVerifications.verificationNo))
      .limit(1);

    return row?.verificationNo ?? null;
  }

  public async getCashLedgerBalance(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        accountId: chartOfAccounts.id,
        accountCode: chartOfAccounts.accountCode,
        accountName: chartOfAccounts.accountName,
        normalBalance: chartOfAccounts.normalBalance,
        currentBalance: chartOfAccounts.currentBalance,
        debit: sql<string>`coalesce(sum(case when ${journalEntries.id} is not null then ${journalEntryLines.debit} else 0 end), 0)`,
        credit: sql<string>`coalesce(sum(case when ${journalEntries.id} is not null then ${journalEntryLines.credit} else 0 end), 0)`
      })
      .from(chartOfAccounts)
      .leftJoin(
        journalEntryLines,
        and(eq(journalEntryLines.companyId, companyId), eq(journalEntryLines.accountId, chartOfAccounts.id))
      )
      .leftJoin(
        journalEntries,
        and(
          eq(journalEntries.id, journalEntryLines.journalEntryId),
          sql`${journalEntries.status} in ('posted', 'reversed')`
        )
      )
      .where(
        and(
          eq(chartOfAccounts.companyId, companyId),
          eq(chartOfAccounts.systemKey, "cash"),
          eq(chartOfAccounts.status, "active"),
          isNull(chartOfAccounts.deletedAt)
        )
      )
      .groupBy(
        chartOfAccounts.id,
        chartOfAccounts.accountCode,
        chartOfAccounts.accountName,
        chartOfAccounts.normalBalance,
        chartOfAccounts.currentBalance
      )
      .limit(1);

    return row ?? null;
  }

  public async create(data: typeof cashVerifications.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(cashVerifications).values(data).returning();
    return row ?? null;
  }

  public async update(
    companyId: string,
    cashVerificationId: string,
    data: Partial<typeof cashVerifications.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(cashVerifications)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(cashVerifications.companyId, companyId), eq(cashVerifications.id, cashVerificationId)))
      .returning();

    return row ?? null;
  }

  public async findById(companyId: string, cashVerificationId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(cashVerifications)
      .where(and(eq(cashVerifications.companyId, companyId), eq(cashVerifications.id, cashVerificationId)))
      .limit(1);

    return row ?? null;
  }

  public async getDetail(companyId: string, cashVerificationId: string, executor?: DbExecutor) {
    const approvedUsers = this.approvedUsers;
    const [row] = await this
      .getExecutor(executor)
      .select({
        verification: cashVerifications,
        verifiedByName: users.fullName,
        approvedByName: approvedUsers.fullName
      })
      .from(cashVerifications)
      .leftJoin(users, eq(cashVerifications.verifiedByUserId, users.id))
      .leftJoin(approvedUsers, eq(cashVerifications.approvedByUserId, approvedUsers.id))
      .where(and(eq(cashVerifications.companyId, companyId), eq(cashVerifications.id, cashVerificationId)))
      .limit(1);

    return row ?? null;
  }

  public async list(params: ListCashVerificationsParams) {
    const approvedUsers = this.approvedUsers;
    const whereClause = and(...this.buildListConditions(params));

    const rows = await db
      .select({
        verification: cashVerifications,
        verifiedByName: users.fullName,
        approvedByName: approvedUsers.fullName
      })
      .from(cashVerifications)
      .leftJoin(users, eq(cashVerifications.verifiedByUserId, users.id))
      .leftJoin(approvedUsers, eq(cashVerifications.approvedByUserId, approvedUsers.id))
      .where(whereClause)
      .orderBy(desc(cashVerifications.verificationDate), desc(cashVerifications.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(cashVerifications)
      .leftJoin(users, eq(cashVerifications.verifiedByUserId, users.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async getLatest(companyId: string, executor?: DbExecutor) {
    const approvedUsers = this.approvedUsers;
    const [row] = await this
      .getExecutor(executor)
      .select({
        verification: cashVerifications,
        verifiedByName: users.fullName,
        approvedByName: approvedUsers.fullName
      })
      .from(cashVerifications)
      .leftJoin(users, eq(cashVerifications.verifiedByUserId, users.id))
      .leftJoin(approvedUsers, eq(cashVerifications.approvedByUserId, approvedUsers.id))
      .where(eq(cashVerifications.companyId, companyId))
      .orderBy(desc(cashVerifications.verificationDate), desc(cashVerifications.createdAt))
      .limit(1);

    return row ?? null;
  }

  public async getCashVerificationSettings(companyId: string) {
    const [row] = await db
      .select({ settingValue: appSettings.settingValue })
      .from(appSettings)
      .where(and(eq(appSettings.companyId, companyId), eq(appSettings.settingKey, "cash_verification_settings")))
      .limit(1);

    return row?.settingValue ?? null;
  }
}

export const cashVerificationRepository = new CashVerificationRepository();
