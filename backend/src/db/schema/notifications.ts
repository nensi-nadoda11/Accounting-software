import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, boolean } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { users } from "./users";

export const notificationTypeEnum = pgEnum("notification_type", [
  "payment_due",
  "supplier_due",
  "low_stock",
  "expiry",
  "invoice",
  "payroll",
  "gst",
  "system",
  "warning"
]);

export const notificationPriorityEnum = pgEnum("notification_priority", ["info", "success", "warning", "critical"]);

export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "email", "whatsapp", "sms"]);

export const notificationFrequencyEnum = pgEnum("notification_frequency", ["instant", "daily", "weekly"]);

export const notificationLogStatusEnum = pgEnum("notification_log_status", ["pending", "sent", "failed", "skipped"]);

export const scheduledNotificationStatusEnum = pgEnum("scheduled_notification_status", [
  "pending",
  "sent",
  "failed",
  "cancelled"
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: notificationTypeEnum("type").notNull(),
    priority: notificationPriorityEnum("priority").notNull().default("info"),
    channel: notificationChannelEnum("channel").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    actionUrl: text("action_url"),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("notifications_company_id_idx").on(table.companyId),
    companyUserIdx: index("notifications_company_user_id_idx").on(table.companyId, table.userId),
    companyTypeIdx: index("notifications_company_type_idx").on(table.companyId, table.type),
    companyPriorityIdx: index("notifications_company_priority_idx").on(table.companyId, table.priority),
    companyReadIdx: index("notifications_company_is_read_idx").on(table.companyId, table.isRead),
    companyChannelReadIdx: index("notifications_company_channel_read_idx").on(table.companyId, table.channel, table.isRead),
    companyCreatedAtIdx: index("notifications_company_created_at_idx").on(table.companyId, table.createdAt)
  })
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    emailEnabled: boolean("email_enabled").notNull().default(true),
    whatsappEnabled: boolean("whatsapp_enabled").notNull().default(false),
    smsEnabled: boolean("sms_enabled").notNull().default(false),
    paymentReminders: boolean("payment_reminders").notNull().default(true),
    supplierReminders: boolean("supplier_reminders").notNull().default(true),
    lowStockAlerts: boolean("low_stock_alerts").notNull().default(true),
    expiryAlerts: boolean("expiry_alerts").notNull().default(true),
    invoiceReminders: boolean("invoice_reminders").notNull().default(true),
    payrollAlerts: boolean("payroll_alerts").notNull().default(true),
    gstAlerts: boolean("gst_alerts").notNull().default(true),
    frequency: notificationFrequencyEnum("frequency").notNull().default("instant"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("notification_preferences_company_id_idx").on(table.companyId),
    companyUserUniqueIdx: uniqueIndex("notification_preferences_company_user_unique_idx").on(table.companyId, table.userId)
  })
);

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    type: notificationTypeEnum("type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    variables: jsonb("variables").$type<string[]>().notNull().default([]),
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("notification_templates_company_id_idx").on(table.companyId),
    companyTypeIdx: index("notification_templates_company_type_idx").on(table.companyId, table.type),
    companyChannelIdx: index("notification_templates_company_channel_idx").on(table.companyId, table.channel),
    companyKeyChannelUniqueIdx: uniqueIndex("notification_templates_company_key_channel_unique_idx").on(
      table.companyId,
      table.templateKey,
      table.channel
    )
  })
);

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    notificationId: uuid("notification_id").references(() => notifications.id, { onDelete: "set null" }),
    channel: notificationChannelEnum("channel").notNull(),
    recipient: text("recipient").notNull(),
    status: notificationLogStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("notification_logs_company_id_idx").on(table.companyId),
    channelIdx: index("notification_logs_channel_idx").on(table.channel),
    statusIdx: index("notification_logs_status_idx").on(table.status),
    companyCreatedAtIdx: index("notification_logs_company_created_at_idx").on(table.companyId, table.createdAt)
  })
);

export const scheduledNotifications = pgTable(
  "scheduled_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: scheduledNotificationStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("scheduled_notifications_company_id_idx").on(table.companyId),
    companyTypeIdx: index("scheduled_notifications_company_type_idx").on(table.companyId, table.type),
    scheduledForStatusIdx: index("scheduled_notifications_scheduled_for_status_idx").on(table.scheduledFor, table.status),
    companyEntityIdx: index("scheduled_notifications_company_entity_idx").on(table.companyId, table.entityType, table.entityId)
  })
);
