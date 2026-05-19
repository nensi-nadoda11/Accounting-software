import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { users } from "./users";

export const auditLogStatusEnum = pgEnum("audit_log_status", ["success", "failed"]);
export const loginLogTypeEnum = pgEnum("login_log_type", ["login", "logout", "failed_login", "password_reset"]);
export const backupTypeEnum = pgEnum("backup_type", ["manual", "scheduled"]);
export const backupStatusEnum = pgEnum("backup_status", ["generating", "completed", "failed", "restoring"]);
export const restoreLogStatusEnum = pgEnum("restore_log_status", ["success", "failed"]);
export const restoreModeEnum = pgEnum("restore_mode", ["merge", "replace"]);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    userNameSnapshot: text("user_name_snapshot"),
    userRoleSnapshot: text("user_role_snapshot"),
    action: text("action").notNull(),
    module: text("module").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    oldValues: jsonb("old_values").$type<Record<string, unknown> | null>(),
    newValues: jsonb("new_values").$type<Record<string, unknown> | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    requestMethod: text("request_method"),
    requestPath: text("request_path"),
    status: auditLogStatusEnum("status").notNull().default("success"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("audit_logs_company_id_idx").on(table.companyId),
    userIdx: index("audit_logs_user_id_idx").on(table.userId),
    moduleIdx: index("audit_logs_module_idx").on(table.module),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    entityIdx: index("audit_logs_entity_type_entity_id_idx").on(table.entityType, table.entityId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
    statusIdx: index("audit_logs_status_idx").on(table.status)
  })
);

export const loginLogs = pgTable(
  "login_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    loginType: loginLogTypeEnum("login_type").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    success: boolean("success").notNull(),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("login_logs_company_id_idx").on(table.companyId),
    userIdx: index("login_logs_user_id_idx").on(table.userId),
    emailIdx: index("login_logs_email_idx").on(table.email),
    loginTypeIdx: index("login_logs_login_type_idx").on(table.loginType),
    createdAtIdx: index("login_logs_created_at_idx").on(table.createdAt)
  })
);

export const backups = pgTable(
  "backups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    backupName: text("backup_name").notNull(),
    backupType: backupTypeEnum("backup_type").notNull().default("manual"),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url"),
    sizeBytes: integer("size_bytes"),
    status: backupStatusEnum("status").notNull().default("generating"),
    includes: jsonb("includes").$type<string[]>().notNull().default([]),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    restoreStartedAt: timestamp("restore_started_at", { withTimezone: true }),
    restoredAt: timestamp("restored_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("backups_company_id_idx").on(table.companyId),
    statusIdx: index("backups_status_idx").on(table.status),
    backupTypeIdx: index("backups_backup_type_idx").on(table.backupType),
    createdAtIdx: index("backups_created_at_idx").on(table.createdAt)
  })
);

export const backupRestoreLogs = pgTable(
  "backup_restore_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    backupId: uuid("backup_id")
      .notNull()
      .references(() => backups.id, { onDelete: "cascade" }),
    restoredBy: uuid("restored_by").references(() => users.id, { onDelete: "set null" }),
    status: restoreLogStatusEnum("status").notNull(),
    restoreMode: restoreModeEnum("restore_mode").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("backup_restore_logs_company_id_idx").on(table.companyId),
    backupIdx: index("backup_restore_logs_backup_id_idx").on(table.backupId),
    statusIdx: index("backup_restore_logs_status_idx").on(table.status),
    createdAtIdx: index("backup_restore_logs_created_at_idx").on(table.createdAt)
  })
);
