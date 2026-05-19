import { and, eq } from "drizzle-orm";

import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { db } from "../../db";
import { notificationLogs, notifications as notificationsTable, scheduledNotifications } from "../../db/schema";
import { emailService } from "../../services/email.service";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { auditLogService } from "../audit-logs/audit-log.service";
import { notificationsRepository } from "./notifications.repository";
import { getDefaultTemplateKey, renderTemplate, SYSTEM_NOTIFICATION_TEMPLATES } from "./notifications.templates";
import type {
  CreateTemplateInput,
  ListLogsQuery,
  ListNotificationsQuery,
  SendNotificationInput,
  UpdatePreferencesInput,
  UpdateTemplateInput
} from "./notifications.validator";
import type {
  NotificationActor,
  NotificationChannel,
  NotificationDispatchInput,
  NotificationPreferenceFlags,
  NotificationPriority,
  NotificationRequestContext,
  NotificationTemplateDefinition,
  NotificationType,
  SchedulerJobKey,
  SchedulerResult
} from "./notifications.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const INVOICE_REMINDER_DAYS = 3;
const GST_DUE_DAY = 20;

const DEFAULT_PREFERENCES: NotificationPreferenceFlags = {
  inAppEnabled: true,
  emailEnabled: true,
  whatsappEnabled: false,
  smsEnabled: false,
  paymentReminders: true,
  supplierReminders: true,
  lowStockAlerts: true,
  expiryAlerts: true,
  invoiceReminders: true,
  payrollAlerts: true,
  gstAlerts: true,
  frequency: "instant"
};

const placeholderEmailConfig =
  env.SMTP_HOST === "smtp.example.com" ||
  env.SMTP_USER === "your_smtp_username" ||
  env.SMTP_PASS === "your_smtp_password";

const sanitizeText = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();

const sanitizeActionUrl = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return trimmed;
    }
  } catch {
    return null;
  }

  return null;
};

const formatDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const formatMoney = (value: string | number) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const toAuditContext = (context: NotificationRequestContext) => ({
  ipAddress: context.ipAddress ?? null,
  userAgent: context.userAgent ?? null
});

const buildPreferencePayload = (
  preference: Partial<NotificationPreferenceFlags> | null | undefined
): NotificationPreferenceFlags => ({
  ...DEFAULT_PREFERENCES,
  ...(preference ?? {})
});

const getCategoryEnabled = (preferences: NotificationPreferenceFlags, type: NotificationType) => {
  switch (type) {
    case "payment_due":
      return preferences.paymentReminders;
    case "supplier_due":
      return preferences.supplierReminders;
    case "low_stock":
      return preferences.lowStockAlerts;
    case "expiry":
      return preferences.expiryAlerts;
    case "invoice":
      return preferences.invoiceReminders;
    case "payroll":
      return preferences.payrollAlerts;
    case "gst":
      return preferences.gstAlerts;
    case "system":
    case "warning":
      return true;
    default:
      return true;
  }
};

class NotificationsService {
  private hasPermission(actor: NotificationActor, permission: string) {
    return actor.permissions?.has(permission) ?? false;
  }

  private async ensureSystemTemplates(companyId: string, userId: string | null) {
    await notificationsRepository.ensureTemplates(
      companyId,
      userId,
      SYSTEM_NOTIFICATION_TEMPLATES.map((template) => ({
        companyId,
        templateKey: template.templateKey,
        type: template.type,
        channel: template.channel,
        subject: template.subject,
        body: template.body,
        variables: template.variables,
        isSystem: template.isSystem,
        isActive: template.isActive,
        createdBy: userId,
        updatedBy: userId
      }))
    );
  }

  private getTemplateFallback(type: NotificationType, channel: NotificationChannel): NotificationTemplateDefinition {
    const template = SYSTEM_NOTIFICATION_TEMPLATES.find(
      (item) => item.templateKey === getDefaultTemplateKey(type) && item.channel === channel
    );

    if (!template) {
      return {
        templateKey: getDefaultTemplateKey(type),
        type,
        channel,
        subject: null,
        body: "{{message}}",
        variables: ["message"],
        isSystem: true,
        isActive: true
      };
    }

    return template;
  }

  private async getTemplate(companyId: string, type: NotificationType, channel: NotificationChannel) {
    const row = await notificationsRepository.findTemplateByKey(companyId, getDefaultTemplateKey(type), channel);
    if (row) {
      return {
        subject: row.subject,
        body: row.body
      };
    }

    const fallback = this.getTemplateFallback(type, channel);
    return {
      subject: fallback.subject,
      body: fallback.body
    };
  }

  private mapNotification(row: typeof notificationsTable.$inferSelect) {
    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      message: row.message,
      type: row.type,
      priority: row.priority,
      channel: row.channel,
      entityType: row.entityType,
      entityId: row.entityId,
      actionUrl: row.actionUrl,
      isRead: row.isRead,
      readAt: row.readAt,
      createdAt: row.createdAt
    };
  }

  private mapPreferences(row: Partial<NotificationPreferenceFlags> & { userId: string }) {
    return {
      userId: row.userId,
      ...buildPreferencePayload(row)
    };
  }

  private async resolveUserTarget(companyId: string, userId: string) {
    const user = await notificationsRepository.findCompanyUser(companyId, userId);
    if (!user) {
      throw new AppError("Recipient user not found", 404);
    }

    return user;
  }

  private async dispatchNotification(
    input: NotificationDispatchInput,
    options?: {
      allowDuplicates?: boolean;
      preferenceOverride?: NotificationPreferenceFlags | null;
    }
  ) {
    const title = sanitizeText(input.title);
    const message = sanitizeText(input.message);
    const actionUrl = sanitizeActionUrl(input.actionUrl);
    const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MS);

    if (!options?.allowDuplicates) {
      const duplicate = await notificationsRepository.findRecentDuplicateNotification({
        companyId: input.companyId,
        type: input.type,
        channel: input.channel,
        userId: input.userId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        since: duplicateSince
      });

      if (duplicate) {
        return {
          status: "skipped" as const,
          reason: "duplicate_window",
          notification: this.mapNotification(duplicate)
        };
      }
    }

    let recipient = input.recipient ?? null;
    let preference = options?.preferenceOverride ?? null;

    if (input.userId) {
      const user = await this.resolveUserTarget(input.companyId, input.userId);
      const storedPreference = await notificationsRepository.findPreference(input.companyId, input.userId);
      preference = buildPreferencePayload(
        storedPreference
          ? {
              inAppEnabled: storedPreference.inAppEnabled,
              emailEnabled: storedPreference.emailEnabled,
              whatsappEnabled: storedPreference.whatsappEnabled,
              smsEnabled: storedPreference.smsEnabled,
              paymentReminders: storedPreference.paymentReminders,
              supplierReminders: storedPreference.supplierReminders,
              lowStockAlerts: storedPreference.lowStockAlerts,
              expiryAlerts: storedPreference.expiryAlerts,
              invoiceReminders: storedPreference.invoiceReminders,
              payrollAlerts: storedPreference.payrollAlerts,
              gstAlerts: storedPreference.gstAlerts,
              frequency: storedPreference.frequency
            }
          : preference
      );

      if (input.channel === "email") {
        recipient = recipient ?? user.email ?? null;
      }

      if (input.channel === "sms" || input.channel === "whatsapp") {
        recipient = recipient ?? user.mobileNumber ?? null;
      }
    }

    if (preference) {
      if (!getCategoryEnabled(preference, input.type)) {
        return { status: "skipped" as const, reason: "preference_disabled" };
      }

      if (input.channel === "in_app" && !preference.inAppEnabled) {
        return { status: "skipped" as const, reason: "preference_disabled" };
      }

      if (input.channel === "email" && !preference.emailEnabled) {
        return { status: "skipped" as const, reason: "preference_disabled" };
      }

      if (input.channel === "whatsapp" && !preference.whatsappEnabled) {
        return { status: "skipped" as const, reason: "preference_disabled" };
      }

      if (input.channel === "sms" && !preference.smsEnabled) {
        return { status: "skipped" as const, reason: "preference_disabled" };
      }
    }

    if (!recipient && input.channel !== "in_app") {
      return { status: "skipped" as const, reason: "missing_recipient" };
    }

    const created = await db.transaction(async (transaction) => {
      const notification = await notificationsRepository.createNotification(
        {
          companyId: input.companyId,
          userId: input.userId ?? null,
          title,
          message,
          type: input.type,
          priority: input.priority,
          channel: input.channel,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          actionUrl,
          createdBy: input.createdBy ?? null
        },
        transaction
      );

      if (!notification) {
        throw new AppError("Failed to create notification", 500);
      }

      const log = await notificationsRepository.createLog(
        {
          companyId: input.companyId,
          notificationId: notification.id,
          channel: input.channel,
          recipient: input.channel === "in_app" ? input.userId ?? "in_app" : recipient ?? "unknown",
          status: input.channel === "in_app" ? "sent" : "pending",
          metadata: input.metadata ?? null,
          sentAt: input.channel === "in_app" ? new Date() : null
        },
        transaction
      );

      if (!log) {
        throw new AppError("Failed to create notification log", 500);
      }

      return { notification, log };
    });

    if (input.channel === "in_app") {
      return {
        status: "sent" as const,
        notification: this.mapNotification(created.notification),
        log: created.log
      };
    }

    if (input.channel === "whatsapp" || input.channel === "sms") {
      const updatedLog = await notificationsRepository.updateLog(created.log.id, {
        status: "skipped",
        errorMessage: "Provider not configured",
        metadata: {
          ...(created.log.metadata ?? {}),
          reason: "provider_not_configured"
        }
      });

      return {
        status: "skipped" as const,
        reason: "provider_not_configured",
        notification: this.mapNotification(created.notification),
        log: updatedLog ?? created.log
      };
    }

    if (placeholderEmailConfig) {
      const updatedLog = await notificationsRepository.updateLog(created.log.id, {
        status: "skipped",
        errorMessage: "Email provider not configured",
        metadata: {
          ...(created.log.metadata ?? {}),
          reason: "provider_not_configured"
        }
      });

      return {
        status: "skipped" as const,
        reason: "provider_not_configured",
        notification: this.mapNotification(created.notification),
        log: updatedLog ?? created.log
      };
    }

    try {
      await emailService.sendGenericEmail({
        to: recipient!,
        subject: title,
        html: `<p>${message.replace(/\n+/g, "</p><p>")}</p>`,
        text: message
      });

      const updatedLog = await notificationsRepository.updateLog(created.log.id, {
        status: "sent",
        sentAt: new Date(),
        errorMessage: null
      });

      return {
        status: "sent" as const,
        notification: this.mapNotification(created.notification),
        log: updatedLog ?? created.log
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Email send failed";
      const updatedLog = await notificationsRepository.updateLog(created.log.id, {
        status: "failed",
        errorMessage
      });

      return {
        status: "failed" as const,
        reason: errorMessage,
        notification: this.mapNotification(created.notification),
        log: updatedLog ?? created.log
      };
    }
  }

  private async dispatchTemplatedInternalNotification(input: {
    companyId: string;
    userId: string;
    type: NotificationType;
    priority: NotificationPriority;
    title: string;
    variables: Record<string, string>;
    entityType: string;
    entityId: string;
    actionUrl?: string | null;
    createdBy?: string | null;
  }) {
    const template = await this.getTemplate(input.companyId, input.type, "in_app");
    const rendered = renderTemplate(template, input.variables);

    return this.dispatchNotification({
      companyId: input.companyId,
      userId: input.userId,
      title: input.title,
      message: rendered.text,
      type: input.type,
      priority: input.priority,
      channel: "in_app",
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl ?? null,
      createdBy: input.createdBy ?? null
    });
  }

  private async dispatchTemplatedExternalEmail(input: {
    companyId: string;
    recipient: string;
    type: NotificationType;
    priority: NotificationPriority;
    variables: Record<string, string>;
    entityType: string;
    entityId: string;
    actionUrl?: string | null;
    createdBy?: string | null;
  }) {
    const template = await this.getTemplate(input.companyId, input.type, "email");
    const rendered = renderTemplate(template, input.variables);

    return this.dispatchNotification({
      companyId: input.companyId,
      recipient: input.recipient,
      title: rendered.subject ?? "Notification",
      message: rendered.text,
      type: input.type,
      priority: input.priority,
      channel: "email",
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl ?? null,
      createdBy: input.createdBy ?? null
    });
  }

  private async buildRecipients(companyId: string) {
    const rows = await notificationsRepository.listCompanyUsersWithPreferences(companyId);
    return rows.map((row) => ({
      user: row.user,
      preference: buildPreferencePayload(
        row.preference
          ? {
              inAppEnabled: row.preference.inAppEnabled,
              emailEnabled: row.preference.emailEnabled,
              whatsappEnabled: row.preference.whatsappEnabled,
              smsEnabled: row.preference.smsEnabled,
              paymentReminders: row.preference.paymentReminders,
              supplierReminders: row.preference.supplierReminders,
              lowStockAlerts: row.preference.lowStockAlerts,
              expiryAlerts: row.preference.expiryAlerts,
              invoiceReminders: row.preference.invoiceReminders,
              payrollAlerts: row.preference.payrollAlerts,
              gstAlerts: row.preference.gstAlerts,
              frequency: row.preference.frequency
            }
          : null
      )
    }));
  }

  private getGstDueDate(periodMonth: Date) {
    const dueMonth = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth() + 1, GST_DUE_DAY));
    return dueMonth;
  }

  private async createScheduleOrSkip(
    companyId: string,
    type: NotificationType,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>
  ) {
    const existing = await notificationsRepository.findRecentScheduledNotification({
      companyId,
      type,
      entityType,
      entityId,
      since: new Date(Date.now() - DUPLICATE_WINDOW_MS)
    });

    if (existing) {
      return null;
    }

    return notificationsRepository.createScheduledNotification({
      companyId,
      type,
      entityType,
      entityId,
      scheduledFor: new Date(),
      status: "pending",
      attempts: 0,
      payload
    });
  }

  private async finishSchedule(
    scheduleId: string,
    status: "sent" | "failed",
    attempts: number,
    lastError: string | null,
    payload: Record<string, unknown>
  ) {
    await notificationsRepository.updateScheduledNotification(scheduleId, {
      status,
      attempts,
      lastError,
      payload
    });
  }

  private async runDueRemindersForCompany(companyId: string, createdBy: string | null): Promise<Omit<SchedulerResult, "job" | "companies">> {
    await this.ensureSystemTemplates(companyId, createdBy);
    const company = await notificationsRepository.findCompanyById(companyId);
    const recipients = await this.buildRecipients(companyId);
    const overdueInvoices = await notificationsRepository.listOverdueSalesInvoices(companyId, getTodayUtc());

    let scheduled = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of overdueInvoices) {
      const schedule = await this.createScheduleOrSkip(companyId, "payment_due", "sales_invoice", item.invoice.id, {
        invoiceNumber: item.invoice.invoiceNumber,
        dueAmount: item.invoice.dueAmount,
        dueDate: item.invoice.dueDate ? formatDateOnly(item.invoice.dueDate) : null
      });

      if (!schedule) {
        skipped += 1;
        continue;
      }

      scheduled += 1;
      const variables = {
        invoiceNumber: item.invoice.invoiceNumber,
        partyName: item.customer.name,
        dueAmount: formatMoney(item.invoice.dueAmount),
        dueDate: item.invoice.dueDate ? formatDateOnly(item.invoice.dueDate) : "N/A",
        companyName: company?.name ?? "Your company"
      };

      try {
        let dispatched = 0;
        for (const recipient of recipients) {
          const result = await this.dispatchTemplatedInternalNotification({
            companyId,
            userId: recipient.user.id,
            type: "payment_due",
            priority: "critical",
            title: `Overdue invoice ${item.invoice.invoiceNumber}`,
            variables,
            entityType: "sales_invoice",
            entityId: item.invoice.id,
            actionUrl: `/app/sales/invoices`,
            createdBy
          });

          if (result.status === "sent") {
            dispatched += 1;
          }
        }

        if (item.customer.email) {
          await this.dispatchTemplatedExternalEmail({
            companyId,
            recipient: item.customer.email,
            type: "payment_due",
            priority: "warning",
            variables,
            entityType: "sales_invoice",
            entityId: item.invoice.id,
            actionUrl: null,
            createdBy
          });
        }

        await this.finishSchedule(schedule.id, "sent", 1, null, {
          ...schedule.payload,
          dispatched
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to process due reminder";
        await this.finishSchedule(schedule.id, "failed", 1, message, schedule.payload);
        failed += 1;
      }
    }

    return { scheduled, sent, skipped, failed };
  }

  private async runSupplierRemindersForCompany(companyId: string, createdBy: string | null) {
    await this.ensureSystemTemplates(companyId, createdBy);
    const recipients = await this.buildRecipients(companyId);
    const dueInvoices = await notificationsRepository.listDuePurchaseInvoices(companyId, addDays(getTodayUtc(), 1));

    let scheduled = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of dueInvoices) {
      const schedule = await this.createScheduleOrSkip(companyId, "supplier_due", "purchase_invoice", item.invoice.id, {
        invoiceNumber: item.invoice.purchaseNumber,
        dueAmount: item.invoice.dueAmount
      });

      if (!schedule) {
        skipped += 1;
        continue;
      }

      scheduled += 1;
      const variables = {
        invoiceNumber: item.invoice.purchaseNumber,
        partyName: item.supplier.name,
        dueAmount: formatMoney(item.invoice.dueAmount),
        dueDate: item.invoice.dueDate ? formatDateOnly(item.invoice.dueDate) : "N/A"
      };

      try {
        let dispatched = 0;
        for (const recipient of recipients) {
          const result = await this.dispatchTemplatedInternalNotification({
            companyId,
            userId: recipient.user.id,
            type: "supplier_due",
            priority: "warning",
            title: `Supplier payable ${item.invoice.purchaseNumber}`,
            variables,
            entityType: "purchase_invoice",
            entityId: item.invoice.id,
            actionUrl: `/app/purchases/payments`,
            createdBy
          });

          if (result.status === "sent") {
            dispatched += 1;
          }
        }

        await this.finishSchedule(schedule.id, "sent", 1, null, {
          ...schedule.payload,
          dispatched
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to process supplier reminder";
        await this.finishSchedule(schedule.id, "failed", 1, message, schedule.payload);
        failed += 1;
      }
    }

    return { scheduled, sent, skipped, failed };
  }

  private async runLowStockForCompany(companyId: string, createdBy: string | null) {
    await this.ensureSystemTemplates(companyId, createdBy);
    const recipients = await this.buildRecipients(companyId);
    const candidates = await notificationsRepository.listLowStockCandidates(companyId);

    let scheduled = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of candidates) {
      const schedule = await this.createScheduleOrSkip(companyId, "low_stock", "stock_balance", item.balance.id, {
        productId: item.product.id,
        warehouseId: item.warehouse.id
      });

      if (!schedule) {
        skipped += 1;
        continue;
      }

      scheduled += 1;
      const variables = {
        productName: item.product.name,
        warehouseName: item.warehouse.name,
        availableQuantity: formatMoney(item.balance.availableQuantity),
        reorderLevel: formatMoney(item.product.reorderLevel)
      };

      try {
        let dispatched = 0;
        for (const recipient of recipients) {
          const result = await this.dispatchTemplatedInternalNotification({
            companyId,
            userId: recipient.user.id,
            type: "low_stock",
            priority: Number(item.balance.availableQuantity) <= 0 ? "critical" : "warning",
            title: `Low stock: ${item.product.name}`,
            variables,
            entityType: "stock_balance",
            entityId: item.balance.id,
            actionUrl: `/app/inventory/stock`,
            createdBy
          });

          if (result.status === "sent") {
            dispatched += 1;
          }
        }

        await this.finishSchedule(schedule.id, "sent", 1, null, {
          ...schedule.payload,
          dispatched
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to process low stock alert";
        await this.finishSchedule(schedule.id, "failed", 1, message, schedule.payload);
        failed += 1;
      }
    }

    return { scheduled, sent, skipped, failed };
  }

  private async runExpiryForCompany(companyId: string, createdBy: string | null) {
    await this.ensureSystemTemplates(companyId, createdBy);
    const recipients = await this.buildRecipients(companyId);
    const today = getTodayUtc();
    const candidates = await notificationsRepository.listExpiryCandidates(
      companyId,
      formatDateOnly(addDays(today, env.INVENTORY_EXPIRY_ALERT_DAYS))
    );

    let scheduled = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of candidates) {
      const schedule = await this.createScheduleOrSkip(companyId, "expiry", "product_batch", item.batch.id, {
        batchNumber: item.batch.batchNumber,
        expiryDate: item.batch.expiryDate ?? null
      });

      if (!schedule) {
        skipped += 1;
        continue;
      }

      scheduled += 1;
      const variables = {
        batchNumber: item.batch.batchNumber,
        productName: item.product.name,
        expiryDate: item.batch.expiryDate ?? "N/A"
      };

      try {
        let dispatched = 0;
        for (const recipient of recipients) {
          const result = await this.dispatchTemplatedInternalNotification({
            companyId,
            userId: recipient.user.id,
            type: "expiry",
            priority: item.batch.expiryDate && item.batch.expiryDate < formatDateOnly(today) ? "critical" : "warning",
            title: `Expiry alert: ${item.product.name}`,
            variables,
            entityType: "product_batch",
            entityId: item.batch.id,
            actionUrl: `/app/inventory/stock`,
            createdBy
          });

          if (result.status === "sent") {
            dispatched += 1;
          }
        }

        await this.finishSchedule(schedule.id, "sent", 1, null, {
          ...schedule.payload,
          dispatched
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to process expiry alert";
        await this.finishSchedule(schedule.id, "failed", 1, message, schedule.payload);
        failed += 1;
      }
    }

    return { scheduled, sent, skipped, failed };
  }

  private async runInvoiceForCompany(companyId: string, createdBy: string | null) {
    await this.ensureSystemTemplates(companyId, createdBy);
    const company = await notificationsRepository.findCompanyById(companyId);
    const recipients = await this.buildRecipients(companyId);
    const start = getTodayUtc();
    const end = addDays(start, INVOICE_REMINDER_DAYS);
    const candidates = await notificationsRepository.listDueSalesInvoices(companyId, start, end);

    let scheduled = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of candidates) {
      const schedule = await this.createScheduleOrSkip(companyId, "invoice", "sales_invoice", item.invoice.id, {
        invoiceNumber: item.invoice.invoiceNumber,
        dueDate: item.invoice.dueDate ? formatDateOnly(item.invoice.dueDate) : null
      });

      if (!schedule) {
        skipped += 1;
        continue;
      }

      scheduled += 1;
      const variables = {
        invoiceNumber: item.invoice.invoiceNumber,
        partyName: item.customer.name,
        dueDate: item.invoice.dueDate ? formatDateOnly(item.invoice.dueDate) : "N/A",
        dueAmount: formatMoney(item.invoice.dueAmount),
        companyName: company?.name ?? "Your company"
      };

      try {
        let dispatched = 0;
        for (const recipient of recipients) {
          const result = await this.dispatchTemplatedInternalNotification({
            companyId,
            userId: recipient.user.id,
            type: "invoice",
            priority: "info",
            title: `Invoice reminder ${item.invoice.invoiceNumber}`,
            variables,
            entityType: "sales_invoice",
            entityId: item.invoice.id,
            actionUrl: `/app/sales/invoices`,
            createdBy
          });

          if (result.status === "sent") {
            dispatched += 1;
          }
        }

        if (item.customer.email) {
          await this.dispatchTemplatedExternalEmail({
            companyId,
            recipient: item.customer.email,
            type: "invoice",
            priority: "info",
            variables,
            entityType: "sales_invoice",
            entityId: item.invoice.id,
            actionUrl: null,
            createdBy
          });
        }

        await this.finishSchedule(schedule.id, "sent", 1, null, {
          ...schedule.payload,
          dispatched
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to process invoice reminder";
        await this.finishSchedule(schedule.id, "failed", 1, message, schedule.payload);
        failed += 1;
      }
    }

    return { scheduled, sent, skipped, failed };
  }

  private async runGstForCompany(companyId: string, createdBy: string | null) {
    await this.ensureSystemTemplates(companyId, createdBy);
    const recipients = await this.buildRecipients(companyId);
    const candidates = await notificationsRepository.listGstCandidates(companyId);
    const cutoff = addDays(getTodayUtc(), 7);

    let scheduled = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of candidates) {
      const dueDate = this.getGstDueDate(item.periodMonth);
      if (dueDate > cutoff) {
        skipped += 1;
        continue;
      }

      const schedule = await this.createScheduleOrSkip(companyId, "gst", "gst_monthly_summary", item.id, {
        dueDate: formatDateOnly(dueDate),
        periodMonth: formatDateOnly(item.periodMonth)
      });

      if (!schedule) {
        skipped += 1;
        continue;
      }

      scheduled += 1;
      const variables = {
        periodLabel: item.periodMonth.toISOString().slice(0, 7),
        dueDate: formatDateOnly(dueDate),
        netGstPayable: formatMoney(item.netGstPayable)
      };

      try {
        let dispatched = 0;
        for (const recipient of recipients) {
          const result = await this.dispatchTemplatedInternalNotification({
            companyId,
            userId: recipient.user.id,
            type: "gst",
            priority: "warning",
            title: `GST due for ${variables.periodLabel}`,
            variables,
            entityType: "gst_monthly_summary",
            entityId: item.id,
            actionUrl: `/app/accounting/gst`,
            createdBy
          });

          if (result.status === "sent") {
            dispatched += 1;
          }
        }

        await this.finishSchedule(schedule.id, "sent", 1, null, {
          ...schedule.payload,
          dispatched
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to process GST reminder";
        await this.finishSchedule(schedule.id, "failed", 1, message, schedule.payload);
        failed += 1;
      }
    }

    return { scheduled, sent, skipped, failed };
  }

  private async runPayrollForCompany(companyId: string, createdBy: string | null) {
    await this.ensureSystemTemplates(companyId, createdBy);
    const recipients = await this.buildRecipients(companyId);
    const candidates = await notificationsRepository.listPayrollCandidates(companyId);

    let scheduled = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of candidates) {
      const unpaidCount = await notificationsRepository.countUnpaidPayrollItems(companyId, item.run.id);
      if (unpaidCount === 0) {
        skipped += 1;
        continue;
      }

      const schedule = await this.createScheduleOrSkip(companyId, "payroll", "payroll_run", item.run.id, {
        payrollMonth: item.run.payrollMonth,
        unpaidCount
      });

      if (!schedule) {
        skipped += 1;
        continue;
      }

      scheduled += 1;
      const variables = {
        runNumber: item.run.runNumber,
        payrollMonth: item.run.payrollMonth,
        pendingAmount: formatMoney(item.pendingAmount)
      };

      try {
        let dispatched = 0;
        for (const recipient of recipients) {
          const result = await this.dispatchTemplatedInternalNotification({
            companyId,
            userId: recipient.user.id,
            type: "payroll",
            priority: "warning",
            title: `Payroll pending ${item.run.payrollMonth}`,
            variables,
            entityType: "payroll_run",
            entityId: item.run.id,
            actionUrl: `/app/hr-payroll/payroll`,
            createdBy
          });

          if (result.status === "sent") {
            dispatched += 1;
          }
        }

        await this.finishSchedule(schedule.id, "sent", 1, null, {
          ...schedule.payload,
          dispatched,
          pendingAmount: item.pendingAmount
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to process payroll reminder";
        await this.finishSchedule(schedule.id, "failed", 1, message, schedule.payload);
        failed += 1;
      }
    }

    return { scheduled, sent, skipped, failed };
  }

  private async runAcrossCompanies(
    job: SchedulerJobKey,
    companyIds: string[],
    createdBy: string | null
  ): Promise<SchedulerResult> {
    let scheduled = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const companyId of companyIds) {
      const result =
        job === "due_reminders"
          ? await this.runDueRemindersForCompany(companyId, createdBy)
          : job === "low_stock_check"
            ? await this.runLowStockForCompany(companyId, createdBy)
            : job === "expiry_check"
              ? await this.runExpiryForCompany(companyId, createdBy)
              : job === "invoice_reminders"
                ? await this.runInvoiceForCompany(companyId, createdBy)
                : job === "gst_reminders"
                  ? await this.runGstForCompany(companyId, createdBy)
                  : await this.runPayrollForCompany(companyId, createdBy);

      if (job === "due_reminders") {
        const supplierResult = await this.runSupplierRemindersForCompany(companyId, createdBy);
        scheduled += supplierResult.scheduled;
        sent += supplierResult.sent;
        skipped += supplierResult.skipped;
        failed += supplierResult.failed;
      }

      scheduled += result.scheduled;
      sent += result.sent;
      skipped += result.skipped;
      failed += result.failed;
    }

    return {
      job,
      companies: companyIds.length,
      scheduled,
      sent,
      skipped,
      failed
    };
  }

  public async listNotifications(actor: NotificationActor, query: ListNotificationsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await notificationsRepository.listNotifications({
      companyId: actor.companyId,
      userId: actor.id,
      page: pagination.page,
      limit: pagination.limit,
      type: query.type,
      priority: query.priority,
      channel: query.channel,
      unread: query.unread,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });

    return {
      items: result.rows.map((row) => this.mapNotification(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async getUnreadCount(actor: NotificationActor) {
    return {
      count: await notificationsRepository.countUnread(actor.companyId, actor.id)
    };
  }

  public async listRecipients(actor: NotificationActor) {
    const rows = await notificationsRepository.listCompanyUsersWithPreferences(actor.companyId);
    return {
      items: rows.map((row) => ({
        id: row.user.id,
        fullName: row.user.fullName,
        email: row.user.email,
        mobileNumber: row.user.mobileNumber
      }))
    };
  }

  public async markRead(actor: NotificationActor, notificationId: string, context: NotificationRequestContext) {
    const notification = await notificationsRepository.markRead(actor.companyId, notificationId, actor.id);
    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_read",
      entityType: "notification",
      entityId: notification.id,
      metadata: {
        channel: notification.channel,
        type: notification.type
      },
      ...toAuditContext(context)
    });

    return {
      notification: this.mapNotification(notification)
    };
  }

  public async markAllRead(actor: NotificationActor, context: NotificationRequestContext) {
    const updatedCount = await notificationsRepository.markAllRead(actor.companyId, actor.id);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_read_all",
      entityType: "notification",
      metadata: {
        updatedCount
      },
      ...toAuditContext(context)
    });

    return {
      updatedCount
    };
  }

  public async deleteNotification(actor: NotificationActor, notificationId: string, context: NotificationRequestContext) {
    const notification = await notificationsRepository.softDeleteNotification(actor.companyId, notificationId, actor.id);
    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_deleted",
      entityType: "notification",
      entityId: notification.id,
      metadata: {
        channel: notification.channel,
        type: notification.type
      },
      ...toAuditContext(context)
    });

    return {
      notification: this.mapNotification(notification)
    };
  }

  public async getPreferences(actor: NotificationActor) {
    const preference = await notificationsRepository.findPreference(actor.companyId, actor.id);
    return {
      preference: this.mapPreferences({
        userId: actor.id,
        ...(preference
          ? {
              inAppEnabled: preference.inAppEnabled,
              emailEnabled: preference.emailEnabled,
              whatsappEnabled: preference.whatsappEnabled,
              smsEnabled: preference.smsEnabled,
              paymentReminders: preference.paymentReminders,
              supplierReminders: preference.supplierReminders,
              lowStockAlerts: preference.lowStockAlerts,
              expiryAlerts: preference.expiryAlerts,
              invoiceReminders: preference.invoiceReminders,
              payrollAlerts: preference.payrollAlerts,
              gstAlerts: preference.gstAlerts,
              frequency: preference.frequency
            }
          : {})
      })
    };
  }

  public async updatePreferences(actor: NotificationActor, input: UpdatePreferencesInput, context: NotificationRequestContext) {
    const targetUserId = input.userId ?? actor.id;
    if (targetUserId !== actor.id && !this.hasPermission(actor, "notifications.settings.manage")) {
      throw new AppError("You do not have permission to update this user's preferences", 403);
    }

    await this.resolveUserTarget(actor.companyId, targetUserId);

    const saved = await notificationsRepository.upsertPreference({
      companyId: actor.companyId,
      userId: targetUserId,
      inAppEnabled: input.inAppEnabled ?? DEFAULT_PREFERENCES.inAppEnabled,
      emailEnabled: input.emailEnabled ?? DEFAULT_PREFERENCES.emailEnabled,
      whatsappEnabled: input.whatsappEnabled ?? DEFAULT_PREFERENCES.whatsappEnabled,
      smsEnabled: input.smsEnabled ?? DEFAULT_PREFERENCES.smsEnabled,
      paymentReminders: input.paymentReminders ?? DEFAULT_PREFERENCES.paymentReminders,
      supplierReminders: input.supplierReminders ?? DEFAULT_PREFERENCES.supplierReminders,
      lowStockAlerts: input.lowStockAlerts ?? DEFAULT_PREFERENCES.lowStockAlerts,
      expiryAlerts: input.expiryAlerts ?? DEFAULT_PREFERENCES.expiryAlerts,
      invoiceReminders: input.invoiceReminders ?? DEFAULT_PREFERENCES.invoiceReminders,
      payrollAlerts: input.payrollAlerts ?? DEFAULT_PREFERENCES.payrollAlerts,
      gstAlerts: input.gstAlerts ?? DEFAULT_PREFERENCES.gstAlerts,
      frequency: input.frequency ?? DEFAULT_PREFERENCES.frequency
    });

    if (!saved) {
      throw new AppError("Failed to update notification preferences", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_preferences_updated",
      entityType: "notification_preference",
      entityId: saved.id,
      metadata: {
        targetUserId
      },
      ...toAuditContext(context)
    });

    return {
      preference: this.mapPreferences({
        userId: saved.userId,
        inAppEnabled: saved.inAppEnabled,
        emailEnabled: saved.emailEnabled,
        whatsappEnabled: saved.whatsappEnabled,
        smsEnabled: saved.smsEnabled,
        paymentReminders: saved.paymentReminders,
        supplierReminders: saved.supplierReminders,
        lowStockAlerts: saved.lowStockAlerts,
        expiryAlerts: saved.expiryAlerts,
        invoiceReminders: saved.invoiceReminders,
        payrollAlerts: saved.payrollAlerts,
        gstAlerts: saved.gstAlerts,
        frequency: saved.frequency
      })
    };
  }

  public async listTemplates(actor: NotificationActor, query: { type?: NotificationType; channel?: NotificationChannel; isActive?: boolean }) {
    await this.ensureSystemTemplates(actor.companyId, actor.id);
    const rows = await notificationsRepository.listTemplates({
      companyId: actor.companyId,
      type: query.type,
      channel: query.channel,
      isActive: query.isActive
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        templateKey: row.templateKey,
        type: row.type,
        channel: row.channel,
        subject: row.subject,
        body: row.body,
        variables: row.variables,
        isSystem: row.isSystem,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }))
    };
  }

  public async createTemplate(actor: NotificationActor, input: CreateTemplateInput, context: NotificationRequestContext) {
    const created = await notificationsRepository.createTemplate({
      companyId: actor.companyId,
      templateKey: input.templateKey,
      type: input.type,
      channel: input.channel,
      subject: input.subject ?? null,
      body: sanitizeText(input.body),
      variables: input.variables,
      isSystem: false,
      isActive: input.isActive,
      createdBy: actor.id,
      updatedBy: actor.id
    });

    if (!created) {
      throw new AppError("Failed to create notification template", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_template_created",
      entityType: "notification_template",
      entityId: created.id,
      metadata: {
        templateKey: created.templateKey,
        channel: created.channel
      },
      ...toAuditContext(context)
    });

    return {
      template: created
    };
  }

  public async updateTemplate(actor: NotificationActor, templateId: string, input: UpdateTemplateInput, context: NotificationRequestContext) {
    const existing = await notificationsRepository.findTemplateById(actor.companyId, templateId);
    if (!existing) {
      throw new AppError("Notification template not found", 404);
    }

    const updated = await notificationsRepository.updateTemplate(actor.companyId, templateId, {
      subject: input.subject === undefined ? existing.subject : input.subject,
      body: input.body === undefined ? existing.body : sanitizeText(input.body),
      variables: input.variables ?? existing.variables,
      isActive: input.isActive ?? existing.isActive,
      updatedBy: actor.id
    });

    if (!updated) {
      throw new AppError("Failed to update notification template", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_template_updated",
      entityType: "notification_template",
      entityId: updated.id,
      metadata: {
        templateKey: updated.templateKey,
        channel: updated.channel
      },
      ...toAuditContext(context)
    });

    return {
      template: updated
    };
  }

  public async listLogs(actor: NotificationActor, query: ListLogsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await notificationsRepository.listLogs({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      channel: query.channel,
      status: query.status,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });

    return {
      items: result.rows.map((row) => ({
        id: row.log.id,
        notificationId: row.log.notificationId,
        notificationTitle: row.notificationTitle,
        channel: row.log.channel,
        recipient: row.log.recipient,
        status: row.log.status,
        errorMessage: row.log.errorMessage,
        sentAt: row.log.sentAt,
        metadata: row.log.metadata,
        createdAt: row.log.createdAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async sendManualNotification(actor: NotificationActor, input: SendNotificationInput, context: NotificationRequestContext) {
    const targetUserId = input.userId ?? null;
    if (targetUserId) {
      await this.resolveUserTarget(actor.companyId, targetUserId);
    }

    const result = await this.dispatchNotification({
      companyId: actor.companyId,
      userId: targetUserId,
      recipient: input.recipient ?? null,
      title: input.title,
      message: input.message,
      type: input.type,
      priority: input.priority,
      channel: input.channel,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      actionUrl: input.actionUrl ?? null,
      createdBy: actor.id
    }, { allowDuplicates: true });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_sent",
      entityType: "notification",
      entityId: "notification" in result && result.notification ? result.notification.id : null,
      metadata: {
        channel: input.channel,
        type: input.type,
        status: result.status,
        targetUserId
      },
      ...toAuditContext(context)
    });

    return result;
  }

  public async runDueReminders(actor: NotificationActor, context: NotificationRequestContext) {
    const result = await this.runAcrossCompanies("due_reminders", [actor.companyId], actor.id);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_job_run",
      entityType: "scheduled_notification",
      metadata: result,
      ...toAuditContext(context)
    });
    return result;
  }

  public async runLowStockCheck(actor: NotificationActor, context: NotificationRequestContext) {
    const result = await this.runAcrossCompanies("low_stock_check", [actor.companyId], actor.id);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_job_run",
      entityType: "scheduled_notification",
      metadata: result,
      ...toAuditContext(context)
    });
    return result;
  }

  public async runExpiryCheck(actor: NotificationActor, context: NotificationRequestContext) {
    const result = await this.runAcrossCompanies("expiry_check", [actor.companyId], actor.id);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_job_run",
      entityType: "scheduled_notification",
      metadata: result,
      ...toAuditContext(context)
    });
    return result;
  }

  public async runInvoiceReminders(actor: NotificationActor, context: NotificationRequestContext) {
    const result = await this.runAcrossCompanies("invoice_reminders", [actor.companyId], actor.id);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_job_run",
      entityType: "scheduled_notification",
      metadata: result,
      ...toAuditContext(context)
    });
    return result;
  }

  public async runGstReminders(actor: NotificationActor, context: NotificationRequestContext) {
    const result = await this.runAcrossCompanies("gst_reminders", [actor.companyId], actor.id);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_job_run",
      entityType: "scheduled_notification",
      metadata: result,
      ...toAuditContext(context)
    });
    return result;
  }

  public async runPayrollReminders(actor: NotificationActor, context: NotificationRequestContext) {
    const result = await this.runAcrossCompanies("payroll_reminders", [actor.companyId], actor.id);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "notification_job_run",
      entityType: "scheduled_notification",
      metadata: result,
      ...toAuditContext(context)
    });
    return result;
  }

  public async runAutomaticCycle() {
    const companyIds = (await notificationsRepository.findActiveCompanyIds()).map((row) => row.id);
    if (companyIds.length === 0) {
      return;
    }

    for (const job of [
      "due_reminders",
      "low_stock_check",
      "expiry_check",
      "invoice_reminders",
      "gst_reminders",
      "payroll_reminders"
    ] as const) {
      try {
        const result = await this.runAcrossCompanies(job, companyIds, null);
        logger.info(`Notification job ${job} completed`, result);
      } catch (error) {
        logger.error(`Notification job ${job} failed`, error);
      }
    }
  }
}

export const notificationsService = new NotificationsService();
