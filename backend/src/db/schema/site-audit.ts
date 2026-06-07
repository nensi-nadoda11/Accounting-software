import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { cashVerifications } from "./cash-verification";
import { companies } from "./companies";
import { warehouses } from "./inventory";
import { stockChecks } from "./stock-check";
import { users } from "./users";

export const siteAuditStatusEnum = pgEnum("site_audit_status", ["draft", "completed", "approved", "cancelled"]);
export const siteAuditFinalResultEnum = pgEnum("site_audit_final_result", ["passed", "issues_found", "needs_review"]);
export const siteAuditFindingSeverityEnum = pgEnum("site_audit_finding_severity", ["low", "medium", "high", "critical"]);
export const siteAuditFindingStatusEnum = pgEnum("site_audit_finding_status", ["open", "resolved", "ignored"]);

export const siteAudits = pgTable(
  "site_audits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    auditNo: text("audit_no").notNull(),
    auditDate: date("audit_date").notNull(),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "restrict" }),
    auditorUserId: uuid("auditor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    linkedStockCheckId: uuid("linked_stock_check_id").references(() => stockChecks.id, { onDelete: "set null" }),
    linkedCashVerificationId: uuid("linked_cash_verification_id").references(() => cashVerifications.id, { onDelete: "set null" }),
    status: siteAuditStatusEnum("status").notNull().default("draft"),
    finalResult: siteAuditFinalResultEnum("final_result").notNull().default("needs_review"),
    overallRemarks: text("overall_remarks"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("site_audits_company_id_idx").on(table.companyId),
    auditNoIdx: index("site_audits_audit_no_idx").on(table.auditNo),
    auditDateIdx: index("site_audits_audit_date_idx").on(table.auditDate),
    warehouseIdx: index("site_audits_warehouse_id_idx").on(table.warehouseId),
    auditorIdx: index("site_audits_auditor_user_id_idx").on(table.auditorUserId),
    statusIdx: index("site_audits_status_idx").on(table.status),
    finalResultIdx: index("site_audits_final_result_idx").on(table.finalResult),
    companyAuditNoUniqueIdx: uniqueIndex("site_audits_company_audit_no_unique_idx").on(table.companyId, table.auditNo)
  })
);

export const siteAuditChecklistItems = pgTable(
  "site_audit_checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteAuditId: uuid("site_audit_id")
      .notNull()
      .references(() => siteAudits.id, { onDelete: "cascade" }),
    checklistKey: text("checklist_key").notNull(),
    checklistLabel: text("checklist_label").notNull(),
    isChecked: boolean("is_checked").notNull().default(false),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    auditIdx: index("site_audit_checklist_items_site_audit_id_idx").on(table.siteAuditId)
  })
);

export const siteAuditFindings = pgTable(
  "site_audit_findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteAuditId: uuid("site_audit_id")
      .notNull()
      .references(() => siteAudits.id, { onDelete: "cascade" }),
    findingTitle: text("finding_title").notNull(),
    findingDescription: text("finding_description"),
    severity: siteAuditFindingSeverityEnum("severity").notNull(),
    status: siteAuditFindingStatusEnum("status").notNull().default("open"),
    relatedModule: text("related_module"),
    relatedReferenceId: uuid("related_reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    auditIdx: index("site_audit_findings_site_audit_id_idx").on(table.siteAuditId),
    severityIdx: index("site_audit_findings_severity_idx").on(table.severity),
    statusIdx: index("site_audit_findings_status_idx").on(table.status)
  })
);

export const siteAuditAttachments = pgTable(
  "site_audit_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    siteAuditId: uuid("site_audit_id")
      .notNull()
      .references(() => siteAudits.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    originalName: text("original_name").notNull(),
    fileUrl: text("file_url").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyAuditIdx: index("site_audit_attachments_company_audit_idx").on(table.companyId, table.siteAuditId),
    companyCreatedIdx: index("site_audit_attachments_company_created_idx").on(table.companyId, table.createdAt)
  })
);
