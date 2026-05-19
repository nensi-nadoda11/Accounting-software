import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "../../db";
import {
  companies,
  customers,
  gstMonthlySummaries,
  notificationLogs,
  notificationPreferences,
  notifications,
  notificationTemplates,
  payrollItems,
  payrollRuns,
  productBatches,
  products,
  purchaseInvoices,
  scheduledNotifications,
  salesInvoices,
  stockBalances,
  suppliers,
  users,
  warehouses
} from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type NotificationListFilters = {
  companyId: string;
  userId: string;
  page: number;
  limit: number;
  type?: typeof notifications.$inferSelect.type | undefined;
  priority?: typeof notifications.$inferSelect.priority | undefined;
  channel?: typeof notifications.$inferSelect.channel | undefined;
  unread?: boolean | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
};

type TemplateListFilters = {
  companyId: string;
  type?: typeof notificationTemplates.$inferSelect.type | undefined;
  channel?: typeof notificationTemplates.$inferSelect.channel | undefined;
  isActive?: boolean | undefined;
};

type LogListFilters = {
  companyId: string;
  page: number;
  limit: number;
  channel?: typeof notificationLogs.$inferSelect.channel | undefined;
  status?: typeof notificationLogs.$inferSelect.status | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
};

type DuplicateNotificationFilter = {
  companyId: string;
  type: typeof notifications.$inferSelect.type;
  channel: typeof notifications.$inferSelect.channel;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  since: Date;
};

type DuplicateScheduleFilter = {
  companyId: string;
  type: typeof scheduledNotifications.$inferSelect.type;
  entityType: string;
  entityId: string;
  since: Date;
};

export class NotificationsRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  public async findActiveCompanyIds() {
    return db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.status, "active"));
  }

  public async findCompanyById(companyId: string) {
    const [row] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
    return row ?? null;
  }

  public async findCompanyUser(companyId: string, userId: string) {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.companyId, companyId), eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async listCompanyUsersWithPreferences(companyId: string) {
    return db
      .select({
        user: users,
        preference: notificationPreferences
      })
      .from(users)
      .leftJoin(
        notificationPreferences,
        and(eq(notificationPreferences.companyId, companyId), eq(notificationPreferences.userId, users.id))
      )
      .where(and(eq(users.companyId, companyId), eq(users.status, "active"), isNull(users.deletedAt)))
      .orderBy(users.fullName);
  }

  public async findNotificationById(companyId: string, notificationId: string, userId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.companyId, companyId),
          eq(notifications.id, notificationId),
          isNull(notifications.deletedAt),
          or(eq(notifications.userId, userId), isNull(notifications.userId))
        )
      )
      .limit(1);

    return row ?? null;
  }

  public async listNotifications(filters: NotificationListFilters) {
    const conditions: SQL[] = [
      eq(notifications.companyId, filters.companyId),
      isNull(notifications.deletedAt),
      or(eq(notifications.userId, filters.userId), isNull(notifications.userId))!
    ];

    if (filters.type) {
      conditions.push(eq(notifications.type, filters.type));
    }

    if (filters.priority) {
      conditions.push(eq(notifications.priority, filters.priority));
    }

    if (filters.channel) {
      conditions.push(eq(notifications.channel, filters.channel));
    }

    if (filters.unread !== undefined) {
      conditions.push(eq(notifications.isRead, !filters.unread));
    }

    if (filters.dateFrom) {
      conditions.push(gte(notifications.createdAt, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(notifications.createdAt, filters.dateTo));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(notifications).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async countUnread(companyId: string, userId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.companyId, companyId),
          eq(notifications.channel, "in_app"),
          eq(notifications.isRead, false),
          isNull(notifications.deletedAt),
          or(eq(notifications.userId, userId), isNull(notifications.userId))
        )
      );

    return row?.value ?? 0;
  }

  public async markRead(companyId: string, notificationId: string, userId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(
        and(
          eq(notifications.companyId, companyId),
          eq(notifications.id, notificationId),
          isNull(notifications.deletedAt),
          or(eq(notifications.userId, userId), isNull(notifications.userId))
        )
      )
      .returning();

    return row ?? null;
  }

  public async markAllRead(companyId: string, userId: string) {
    const rows = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(
        and(
          eq(notifications.companyId, companyId),
          eq(notifications.channel, "in_app"),
          eq(notifications.isRead, false),
          isNull(notifications.deletedAt),
          or(eq(notifications.userId, userId), isNull(notifications.userId))
        )
      )
      .returning({ id: notifications.id });

    return rows.length;
  }

  public async softDeleteNotification(companyId: string, notificationId: string, userId: string) {
    const [row] = await db
      .update(notifications)
      .set({
        deletedAt: new Date()
      })
      .where(
        and(
          eq(notifications.companyId, companyId),
          eq(notifications.id, notificationId),
          isNull(notifications.deletedAt),
          or(eq(notifications.userId, userId), isNull(notifications.userId))
        )
      )
      .returning();

    return row ?? null;
  }

  public async findPreference(companyId: string, userId: string) {
    const [row] = await db
      .select()
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.companyId, companyId), eq(notificationPreferences.userId, userId)))
      .limit(1);

    return row ?? null;
  }

  public async upsertPreference(data: typeof notificationPreferences.$inferInsert) {
    const [row] = await db
      .insert(notificationPreferences)
      .values(data)
      .onConflictDoUpdate({
        target: [notificationPreferences.companyId, notificationPreferences.userId],
        set: {
          ...data,
          updatedAt: new Date()
        }
      })
      .returning();

    return row ?? null;
  }

  public async ensureTemplates(companyId: string, createdBy: string | null, rows: Array<typeof notificationTemplates.$inferInsert>) {
    if (rows.length === 0) {
      return;
    }

    await db
      .insert(notificationTemplates)
      .values(
        rows.map((row) => ({
          ...row,
          companyId,
          createdBy,
          updatedBy: createdBy
        }))
      )
      .onConflictDoNothing({
        target: [notificationTemplates.companyId, notificationTemplates.templateKey, notificationTemplates.channel]
      });
  }

  public async listTemplates(filters: TemplateListFilters) {
    const conditions: SQL[] = [eq(notificationTemplates.companyId, filters.companyId)];

    if (filters.type) {
      conditions.push(eq(notificationTemplates.type, filters.type));
    }

    if (filters.channel) {
      conditions.push(eq(notificationTemplates.channel, filters.channel));
    }

    if (filters.isActive !== undefined) {
      conditions.push(eq(notificationTemplates.isActive, filters.isActive));
    }

    return db
      .select()
      .from(notificationTemplates)
      .where(and(...conditions))
      .orderBy(desc(notificationTemplates.isSystem), notificationTemplates.templateKey, notificationTemplates.channel);
  }

  public async findTemplateById(companyId: string, templateId: string) {
    const [row] = await db
      .select()
      .from(notificationTemplates)
      .where(and(eq(notificationTemplates.companyId, companyId), eq(notificationTemplates.id, templateId)))
      .limit(1);

    return row ?? null;
  }

  public async findTemplateByKey(companyId: string, templateKey: string, channel: typeof notificationTemplates.$inferSelect.channel) {
    const [row] = await db
      .select()
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.companyId, companyId),
          eq(notificationTemplates.templateKey, templateKey),
          eq(notificationTemplates.channel, channel),
          eq(notificationTemplates.isActive, true)
        )
      )
      .limit(1);

    return row ?? null;
  }

  public async createTemplate(data: typeof notificationTemplates.$inferInsert) {
    const [row] = await db.insert(notificationTemplates).values(data).returning();
    return row ?? null;
  }

  public async updateTemplate(companyId: string, templateId: string, data: Partial<typeof notificationTemplates.$inferInsert>) {
    const [row] = await db
      .update(notificationTemplates)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(notificationTemplates.companyId, companyId), eq(notificationTemplates.id, templateId)))
      .returning();

    return row ?? null;
  }

  public async createNotification(data: typeof notifications.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(notifications).values(data).returning();
    return row ?? null;
  }

  public async createLog(data: typeof notificationLogs.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(notificationLogs).values(data).returning();
    return row ?? null;
  }

  public async updateLog(logId: string, data: Partial<typeof notificationLogs.$inferInsert>) {
    const [row] = await db
      .update(notificationLogs)
      .set(data)
      .where(eq(notificationLogs.id, logId))
      .returning();

    return row ?? null;
  }

  public async listLogs(filters: LogListFilters) {
    const conditions: SQL[] = [eq(notificationLogs.companyId, filters.companyId)];

    if (filters.channel) {
      conditions.push(eq(notificationLogs.channel, filters.channel));
    }

    if (filters.status) {
      conditions.push(eq(notificationLogs.status, filters.status));
    }

    if (filters.dateFrom) {
      conditions.push(gte(notificationLogs.createdAt, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(notificationLogs.createdAt, filters.dateTo));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select({
        log: notificationLogs,
        notificationTitle: notifications.title
      })
      .from(notificationLogs)
      .leftJoin(notifications, eq(notificationLogs.notificationId, notifications.id))
      .where(whereClause)
      .orderBy(desc(notificationLogs.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const [totalRow] = await db.select({ value: count() }).from(notificationLogs).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findRecentDuplicateNotification(filters: DuplicateNotificationFilter) {
    const conditions: SQL[] = [
      eq(notifications.companyId, filters.companyId),
      eq(notifications.type, filters.type),
      eq(notifications.channel, filters.channel),
      gte(notifications.createdAt, filters.since),
      isNull(notifications.deletedAt)
    ];

    if (filters.userId) {
      conditions.push(eq(notifications.userId, filters.userId));
    } else {
      conditions.push(isNull(notifications.userId));
    }

    if (filters.entityType) {
      conditions.push(eq(notifications.entityType, filters.entityType));
    } else {
      conditions.push(isNull(notifications.entityType));
    }

    if (filters.entityId) {
      conditions.push(eq(notifications.entityId, filters.entityId));
    } else {
      conditions.push(isNull(notifications.entityId));
    }

    const [row] = await db.select().from(notifications).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async createScheduledNotification(data: typeof scheduledNotifications.$inferInsert) {
    const [row] = await db.insert(scheduledNotifications).values(data).returning();
    return row ?? null;
  }

  public async updateScheduledNotification(scheduleId: string, data: Partial<typeof scheduledNotifications.$inferInsert>) {
    const [row] = await db
      .update(scheduledNotifications)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(scheduledNotifications.id, scheduleId))
      .returning();

    return row ?? null;
  }

  public async findRecentScheduledNotification(filters: DuplicateScheduleFilter) {
    const [row] = await db
      .select()
      .from(scheduledNotifications)
      .where(
        and(
          eq(scheduledNotifications.companyId, filters.companyId),
          eq(scheduledNotifications.type, filters.type),
          eq(scheduledNotifications.entityType, filters.entityType),
          eq(scheduledNotifications.entityId, filters.entityId),
          gte(scheduledNotifications.createdAt, filters.since),
          ne(scheduledNotifications.status, "cancelled")
        )
      )
      .limit(1);

    return row ?? null;
  }

  public async listDueSalesInvoices(companyId: string, startDate: Date, endDate?: Date | null) {
    const conditions: SQL[] = [
      eq(salesInvoices.companyId, companyId),
      inArray(salesInvoices.invoiceStatus, ["posted", "partially_returned", "returned"]),
      gt(salesInvoices.dueAmount, "0"),
      isNull(salesInvoices.deletedAt),
      gte(salesInvoices.dueDate, startDate)
    ];

    if (endDate) {
      conditions.push(lte(salesInvoices.dueDate, endDate));
    }

    return db
      .select({
        invoice: salesInvoices,
        customer: customers
      })
      .from(salesInvoices)
      .innerJoin(customers, eq(salesInvoices.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(salesInvoices.dueDate, salesInvoices.invoiceDate);
  }

  public async listOverdueSalesInvoices(companyId: string, beforeDate: Date) {
    return db
      .select({
        invoice: salesInvoices,
        customer: customers
      })
      .from(salesInvoices)
      .innerJoin(customers, eq(salesInvoices.customerId, customers.id))
      .where(
        and(
          eq(salesInvoices.companyId, companyId),
          inArray(salesInvoices.invoiceStatus, ["posted", "partially_returned", "returned"]),
          gt(salesInvoices.dueAmount, "0"),
          isNull(salesInvoices.deletedAt),
          lt(salesInvoices.dueDate, beforeDate)
        )
      )
      .orderBy(salesInvoices.dueDate, salesInvoices.invoiceDate);
  }

  public async listDuePurchaseInvoices(companyId: string, beforeDate: Date) {
    return db
      .select({
        invoice: purchaseInvoices,
        supplier: suppliers
      })
      .from(purchaseInvoices)
      .innerJoin(suppliers, eq(purchaseInvoices.supplierId, suppliers.id))
      .where(
        and(
          eq(purchaseInvoices.companyId, companyId),
          inArray(purchaseInvoices.purchaseStatus, ["posted", "returned"]),
          gt(purchaseInvoices.dueAmount, "0"),
          isNull(purchaseInvoices.deletedAt),
          lte(purchaseInvoices.dueDate, beforeDate)
        )
      )
      .orderBy(purchaseInvoices.dueDate, purchaseInvoices.invoiceDate);
  }

  public async listLowStockCandidates(companyId: string) {
    return db
      .select({
        balance: stockBalances,
        product: products,
        warehouse: warehouses
      })
      .from(stockBalances)
      .innerJoin(products, eq(stockBalances.productId, products.id))
      .innerJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
      .where(
        and(
          eq(stockBalances.companyId, companyId),
          eq(products.companyId, companyId),
          eq(products.status, "active"),
          eq(products.stockTrackingEnabled, true),
          gt(products.reorderLevel, "0"),
          lte(stockBalances.availableQuantity, products.reorderLevel),
          isNull(products.deletedAt),
          isNull(warehouses.deletedAt)
        )
      )
      .orderBy(products.name, warehouses.name);
  }

  public async listExpiryCandidates(companyId: string, untilDate: string) {
    return db
      .select({
        balance: stockBalances,
        batch: productBatches,
        product: products,
        warehouse: warehouses
      })
      .from(stockBalances)
      .innerJoin(productBatches, eq(stockBalances.batchId, productBatches.id))
      .innerJoin(products, eq(stockBalances.productId, products.id))
      .innerJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
      .where(
        and(
          eq(stockBalances.companyId, companyId),
          eq(products.companyId, companyId),
          eq(products.expiryTrackingEnabled, true),
          gt(stockBalances.availableQuantity, "0"),
          lte(productBatches.expiryDate, untilDate),
          isNull(products.deletedAt),
          isNull(productBatches.deletedAt),
          isNull(warehouses.deletedAt),
          ne(productBatches.status, "deleted")
        )
      )
      .orderBy(productBatches.expiryDate, products.name);
  }

  public async listGstCandidates(companyId: string) {
    return db
      .select()
      .from(gstMonthlySummaries)
      .where(and(eq(gstMonthlySummaries.companyId, companyId), gt(gstMonthlySummaries.netGstPayable, "0")))
      .orderBy(desc(gstMonthlySummaries.periodMonth))
      .limit(3);
  }

  public async listPayrollCandidates(companyId: string) {
    const pendingAmount = sql<string>`${payrollRuns.netPayableTotal} - ${payrollRuns.paidTotal}`;

    return db
      .select({
        run: payrollRuns,
        pendingAmount
      })
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.companyId, companyId),
          inArray(payrollRuns.status, ["generated", "paid"]),
          gt(pendingAmount, "0")
        )
      )
      .orderBy(desc(payrollRuns.payrollMonth))
      .limit(6);
  }

  public async countUnpaidPayrollItems(companyId: string, payrollRunId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(payrollItems)
      .where(
        and(
          eq(payrollItems.companyId, companyId),
          eq(payrollItems.payrollRunId, payrollRunId),
          inArray(payrollItems.paymentStatus, ["unpaid", "partial"])
        )
      );

    return row?.value ?? 0;
  }
}

export const notificationsRepository = new NotificationsRepository();
