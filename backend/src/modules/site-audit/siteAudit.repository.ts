import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../db";
import {
  cashVerifications,
  siteAuditAttachments,
  siteAuditChecklistItems,
  siteAuditFindings,
  siteAudits,
  stockChecks,
  users,
  warehouses
} from "../../db/schema";
import type { SiteAuditFinalResult, SiteAuditStatus } from "./siteAudit.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type SiteAuditDbExecutor = typeof db | TransactionClient;

type ListSiteAuditsParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  status?: SiteAuditStatus | undefined;
  finalResult?: SiteAuditFinalResult | undefined;
  warehouseId?: string | undefined;
  auditorId?: string | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
};

class SiteAuditRepository {
  private approvedUsers = alias(users, "site_audit_approved_user");

  private getExecutor(executor?: SiteAuditDbExecutor) {
    return executor ?? db;
  }

  private buildListConditions(params: Omit<ListSiteAuditsParams, "page" | "limit">) {
    const conditions: SQL[] = [eq(siteAudits.companyId, params.companyId)];

    if (params.status) {
      conditions.push(eq(siteAudits.status, params.status));
    }

    if (params.finalResult) {
      conditions.push(eq(siteAudits.finalResult, params.finalResult));
    }

    if (params.warehouseId) {
      conditions.push(eq(siteAudits.warehouseId, params.warehouseId));
    }

    if (params.auditorId) {
      conditions.push(eq(siteAudits.auditorUserId, params.auditorId));
    }

    if (params.dateFrom) {
      conditions.push(sql`${siteAudits.auditDate} >= ${params.dateFrom.toISOString().slice(0, 10)}`);
    }

    if (params.dateTo) {
      conditions.push(sql`${siteAudits.auditDate} <= ${params.dateTo.toISOString().slice(0, 10)}`);
    }

    if (params.search) {
      const pattern = `%${params.search}%`;
      conditions.push(or(ilike(siteAudits.auditNo, pattern), ilike(warehouses.name, pattern), ilike(users.fullName, pattern))!);
    }

    return conditions;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: SiteAuditDbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findLatestAuditNo(companyId: string, executor?: SiteAuditDbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ auditNo: siteAudits.auditNo })
      .from(siteAudits)
      .where(eq(siteAudits.companyId, companyId))
      .orderBy(desc(siteAudits.auditNo))
      .limit(1);

    return row?.auditNo ?? null;
  }

  public async createAudit(data: typeof siteAudits.$inferInsert, executor?: SiteAuditDbExecutor) {
    const [row] = await this.getExecutor(executor).insert(siteAudits).values(data).returning();
    return row ?? null;
  }

  public async updateAudit(companyId: string, siteAuditId: string, data: Partial<typeof siteAudits.$inferInsert>, executor?: SiteAuditDbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(siteAudits)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(siteAudits.companyId, companyId), eq(siteAudits.id, siteAuditId)))
      .returning();

    return row ?? null;
  }

  public async findById(companyId: string, siteAuditId: string, executor?: SiteAuditDbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(siteAudits)
      .where(and(eq(siteAudits.companyId, companyId), eq(siteAudits.id, siteAuditId)))
      .limit(1);

    return row ?? null;
  }

  public async findWarehouseById(companyId: string, warehouseId: string, executor?: SiteAuditDbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(warehouses)
      .where(and(eq(warehouses.companyId, companyId), eq(warehouses.id, warehouseId), isNull(warehouses.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findUserById(companyId: string, userId: string, executor?: SiteAuditDbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(users)
      .where(and(eq(users.companyId, companyId), eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async findStockCheckById(companyId: string, stockCheckId: string, executor?: SiteAuditDbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(stockChecks)
      .where(and(eq(stockChecks.companyId, companyId), eq(stockChecks.id, stockCheckId)))
      .limit(1);

    return row ?? null;
  }

  public async findCashVerificationById(companyId: string, cashVerificationId: string, executor?: SiteAuditDbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(cashVerifications)
      .where(and(eq(cashVerifications.companyId, companyId), eq(cashVerifications.id, cashVerificationId)))
      .limit(1);

    return row ?? null;
  }

  public async replaceChecklist(siteAuditId: string, data: Array<typeof siteAuditChecklistItems.$inferInsert>, executor?: SiteAuditDbExecutor) {
    await this.getExecutor(executor).delete(siteAuditChecklistItems).where(eq(siteAuditChecklistItems.siteAuditId, siteAuditId));
    if (!data.length) {
      return [];
    }
    return this.getExecutor(executor).insert(siteAuditChecklistItems).values(data).returning();
  }

  public async listChecklist(siteAuditId: string, executor?: SiteAuditDbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(siteAuditChecklistItems)
      .where(eq(siteAuditChecklistItems.siteAuditId, siteAuditId))
      .orderBy(asc(siteAuditChecklistItems.createdAt));
  }

  public async createFindings(data: Array<typeof siteAuditFindings.$inferInsert>, executor?: SiteAuditDbExecutor) {
    if (!data.length) {
      return [];
    }
    return this.getExecutor(executor).insert(siteAuditFindings).values(data).returning();
  }

  public async createFinding(data: typeof siteAuditFindings.$inferInsert, executor?: SiteAuditDbExecutor) {
    const [row] = await this.getExecutor(executor).insert(siteAuditFindings).values(data).returning();
    return row ?? null;
  }

  public async updateFinding(siteAuditId: string, findingId: string, data: Partial<typeof siteAuditFindings.$inferInsert>, executor?: SiteAuditDbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(siteAuditFindings)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(siteAuditFindings.siteAuditId, siteAuditId), eq(siteAuditFindings.id, findingId)))
      .returning();

    return row ?? null;
  }

  public async listFindings(siteAuditId: string, executor?: SiteAuditDbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(siteAuditFindings)
      .where(eq(siteAuditFindings.siteAuditId, siteAuditId))
      .orderBy(desc(siteAuditFindings.severity), asc(siteAuditFindings.createdAt));
  }

  public async createAttachments(data: Array<typeof siteAuditAttachments.$inferInsert>, executor?: SiteAuditDbExecutor) {
    if (!data.length) {
      return [];
    }
    return this.getExecutor(executor).insert(siteAuditAttachments).values(data).returning();
  }

  public async listAttachments(companyId: string, siteAuditId: string, executor?: SiteAuditDbExecutor) {
    return this
      .getExecutor(executor)
      .select()
      .from(siteAuditAttachments)
      .where(and(eq(siteAuditAttachments.companyId, companyId), eq(siteAuditAttachments.siteAuditId, siteAuditId), isNull(siteAuditAttachments.deletedAt)))
      .orderBy(asc(siteAuditAttachments.createdAt));
  }

  public async findAttachmentById(companyId: string, attachmentId: string, executor?: SiteAuditDbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(siteAuditAttachments)
      .where(and(eq(siteAuditAttachments.companyId, companyId), eq(siteAuditAttachments.id, attachmentId), isNull(siteAuditAttachments.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async softDeleteAttachment(companyId: string, attachmentId: string, executor?: SiteAuditDbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(siteAuditAttachments)
      .set({ deletedAt: new Date() })
      .where(and(eq(siteAuditAttachments.companyId, companyId), eq(siteAuditAttachments.id, attachmentId), isNull(siteAuditAttachments.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async getDetail(companyId: string, siteAuditId: string, executor?: SiteAuditDbExecutor) {
    const approvedUsers = this.approvedUsers;
    const [audit] = await this
      .getExecutor(executor)
      .select({
        audit: siteAudits,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        auditorName: users.fullName,
        auditorRole: users.role,
        approvedByName: approvedUsers.fullName,
        stockCheckNo: stockChecks.checkNo,
        stockCheckStatus: stockChecks.status,
        stockCheckTotalItems: stockChecks.totalItems,
        stockCheckMatchedItems: stockChecks.matchedItems,
        stockCheckShortItems: stockChecks.shortItems,
        stockCheckExcessItems: stockChecks.excessItems,
        cashVerificationNo: cashVerifications.verificationNo,
        cashVerificationStatus: cashVerifications.status,
        cashVerificationRecordStatus: cashVerifications.recordStatus,
        cashExpectedCash: cashVerifications.expectedCash,
        cashActualCash: cashVerifications.actualCash,
        cashDifferenceAmount: cashVerifications.differenceAmount
      })
      .from(siteAudits)
      .leftJoin(warehouses, eq(siteAudits.warehouseId, warehouses.id))
      .leftJoin(users, eq(siteAudits.auditorUserId, users.id))
      .leftJoin(approvedUsers, eq(siteAudits.approvedByUserId, approvedUsers.id))
      .leftJoin(stockChecks, eq(siteAudits.linkedStockCheckId, stockChecks.id))
      .leftJoin(cashVerifications, eq(siteAudits.linkedCashVerificationId, cashVerifications.id))
      .where(and(eq(siteAudits.companyId, companyId), eq(siteAudits.id, siteAuditId)))
      .limit(1);

    if (!audit) {
      return null;
    }

    const [checklist, findings, attachments] = await Promise.all([
      this.listChecklist(siteAuditId, executor),
      this.listFindings(siteAuditId, executor),
      this.listAttachments(companyId, siteAuditId, executor)
    ]);

    return { ...audit, checklist, findings, attachments };
  }

  public async list(params: ListSiteAuditsParams) {
    const whereClause = and(...this.buildListConditions(params));
    const rows = await db
      .select({
        audit: siteAudits,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        auditorName: users.fullName,
        findingCount: sql<number>`count(${siteAuditFindings.id})`,
        criticalFindingCount: sql<number>`count(${siteAuditFindings.id}) filter (where ${siteAuditFindings.severity} = 'critical')`
      })
      .from(siteAudits)
      .leftJoin(warehouses, eq(siteAudits.warehouseId, warehouses.id))
      .leftJoin(users, eq(siteAudits.auditorUserId, users.id))
      .leftJoin(siteAuditFindings, eq(siteAudits.id, siteAuditFindings.siteAuditId))
      .where(whereClause)
      .groupBy(siteAudits.id, warehouses.name, warehouses.warehouseCode, users.fullName)
      .orderBy(desc(siteAudits.auditDate), desc(siteAudits.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(siteAudits)
      .leftJoin(warehouses, eq(siteAudits.warehouseId, warehouses.id))
      .leftJoin(users, eq(siteAudits.auditorUserId, users.id))
      .where(whereClause);

    return { rows, total: totalRow?.value ?? 0 };
  }

  public async listForLookup(companyId: string, kind: "stock" | "cash", search?: string | null) {
    if (kind === "stock") {
      const conditions: SQL[] = [eq(stockChecks.companyId, companyId)];
      if (search) {
        conditions.push(ilike(stockChecks.checkNo, `%${search}%`));
      }
      return db.select().from(stockChecks).where(and(...conditions)).orderBy(desc(stockChecks.checkDate), desc(stockChecks.createdAt)).limit(50);
    }

    const conditions: SQL[] = [eq(cashVerifications.companyId, companyId)];
    if (search) {
      conditions.push(ilike(cashVerifications.verificationNo, `%${search}%`));
    }
    return db.select().from(cashVerifications).where(and(...conditions)).orderBy(desc(cashVerifications.verificationDate), desc(cashVerifications.createdAt)).limit(50);
  }
}

export const siteAuditRepository = new SiteAuditRepository();
