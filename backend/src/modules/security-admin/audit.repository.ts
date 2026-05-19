import { and, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm";

import { db } from "../../db";
import { auditLogs, backupRestoreLogs, backups, loginLogs, users } from "../../db/schema";
import type { ListAuditLogsQuery, ListLoginLogsQuery, ListRestoreLogsQuery } from "./audit.validator";

type ListAuditLogParams = ListAuditLogsQuery & {
  companyId: string;
  offset?: number;
  exportAll?: boolean;
};

type ListLoginLogParams = ListLoginLogsQuery & {
  companyId: string;
  offset: number;
};

type ListRestoreLogParams = ListRestoreLogsQuery & {
  companyId: string;
  offset: number;
};

export class SecurityAdminAuditRepository {
  public async createLoginLog(data: typeof loginLogs.$inferInsert) {
    const [row] = await db.insert(loginLogs).values(data).returning();
    return row ?? null;
  }

  public async listAuditLogs(params: ListAuditLogParams) {
    const conditions = [eq(auditLogs.companyId, params.companyId)];

    if (params.module) {
      conditions.push(eq(auditLogs.module, params.module));
    }

    if (params.action) {
      conditions.push(ilike(auditLogs.action, `%${params.action}%`));
    }

    if (params.status) {
      conditions.push(eq(auditLogs.status, params.status));
    }

    if (params.entityType) {
      conditions.push(eq(auditLogs.entityType, params.entityType));
    }

    if (params.user) {
      conditions.push(
        or(
          ilike(auditLogs.userNameSnapshot, `%${params.user}%`),
          ilike(users.fullName, `%${params.user}%`),
          ilike(users.email, `%${params.user}%`)
        )!
      );
    }

    if (params.dateFrom) {
      conditions.push(gte(auditLogs.createdAt, params.dateFrom));
    }

    if (params.dateTo) {
      conditions.push(lte(auditLogs.createdAt, params.dateTo));
    }

    const whereClause = and(...conditions);
    const baseQuery = db
      .select({
        log: auditLogs,
        currentUserFullName: users.fullName,
        currentUserEmail: users.email
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt));

    const rows = params.exportAll
      ? await baseQuery
      : await baseQuery.limit(params.limit).offset(params.offset ?? 0);

    const [totalRow] = await db
      .select({ value: count() })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listLoginLogs(params: ListLoginLogParams) {
    const conditions = [eq(loginLogs.companyId, params.companyId)];

    if (params.email) {
      conditions.push(ilike(loginLogs.email, `%${params.email}%`));
    }

    if (params.loginType) {
      conditions.push(eq(loginLogs.loginType, params.loginType));
    }

    if (params.success !== undefined) {
      conditions.push(eq(loginLogs.success, params.success));
    }

    if (params.dateFrom) {
      conditions.push(gte(loginLogs.createdAt, params.dateFrom));
    }

    if (params.dateTo) {
      conditions.push(lte(loginLogs.createdAt, params.dateTo));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select()
      .from(loginLogs)
      .where(whereClause)
      .orderBy(desc(loginLogs.createdAt))
      .limit(params.limit)
      .offset(params.offset);

    const [totalRow] = await db.select({ value: count() }).from(loginLogs).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listRestoreLogs(params: ListRestoreLogParams) {
    const conditions = [eq(backupRestoreLogs.companyId, params.companyId)];

    if (params.status) {
      conditions.push(eq(backupRestoreLogs.status, params.status));
    }

    if (params.restoreMode) {
      conditions.push(eq(backupRestoreLogs.restoreMode, params.restoreMode));
    }

    if (params.dateFrom) {
      conditions.push(gte(backupRestoreLogs.createdAt, params.dateFrom));
    }

    if (params.dateTo) {
      conditions.push(lte(backupRestoreLogs.createdAt, params.dateTo));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select({
        log: backupRestoreLogs,
        backupName: backups.backupName,
        restoredByName: users.fullName
      })
      .from(backupRestoreLogs)
      .innerJoin(backups, eq(backupRestoreLogs.backupId, backups.id))
      .leftJoin(users, eq(backupRestoreLogs.restoredBy, users.id))
      .where(whereClause)
      .orderBy(desc(backupRestoreLogs.createdAt))
      .limit(params.limit)
      .offset(params.offset);

    const [totalRow] = await db
      .select({ value: count() })
      .from(backupRestoreLogs)
      .innerJoin(backups, eq(backupRestoreLogs.backupId, backups.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }
}

export const securityAdminAuditRepository = new SecurityAdminAuditRepository();
