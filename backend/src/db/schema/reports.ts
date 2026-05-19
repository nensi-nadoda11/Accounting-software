import { sql } from "drizzle-orm";
import { check, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { users } from "./users";

export const reportExportFormatEnum = pgEnum("report_export_format", ["csv", "xlsx", "pdf"]);
export const reportExportStatusEnum = pgEnum("report_export_status", ["generated", "failed"]);

export const reportExports = pgTable(
  "report_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    reportType: text("report_type").notNull(),
    exportFormat: reportExportFormatEnum("export_format").notNull(),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
    fileUrl: text("file_url"),
    status: reportExportStatusEnum("status").notNull().default("generated"),
    generatedBy: uuid("generated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("report_exports_company_id_idx").on(table.companyId),
    companyCreatedIdx: index("report_exports_company_created_at_idx").on(table.companyId, table.createdAt),
    reportTypeIdx: index("report_exports_report_type_idx").on(table.reportType),
    statusIdx: index("report_exports_status_idx").on(table.status)
  })
);

export const reportSnapshots = pgTable(
  "report_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    snapshotType: text("snapshot_type").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("report_snapshots_company_id_idx").on(table.companyId),
    companyTypeIdx: index("report_snapshots_company_snapshot_type_idx").on(table.companyId, table.snapshotType),
    periodCheck: check("report_snapshots_period_check", sql`${table.periodEnd} >= ${table.periodStart}`)
  })
);
