import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { users } from "./users";

export const gstAdjustmentTypeEnum = pgEnum("gst_adjustment_type", [
  "itc_reversal",
  "itc_claim",
  "output_tax_adjustment",
  "late_fee",
  "interest",
  "rounding",
  "other"
]);
export const gstTaxComponentEnum = pgEnum("gst_tax_component", ["cgst", "sgst", "igst", "cess"]);
export const gstAdjustmentStatusEnum = pgEnum("gst_adjustment_status", ["active", "cancelled"]);
export const gstReportTypeEnum = pgEnum("gst_report_type", [
  "sales_gst",
  "purchase_gst",
  "itc",
  "output_tax",
  "hsn_summary",
  "tax_summary",
  "gstr1",
  "gstr3b"
]);
export const gstItcSourceTypeEnum = pgEnum("gst_itc_source_type", ["purchase", "expense", "adjustment"]);
export const gstItcEligibilityStatusEnum = pgEnum("gst_itc_eligibility_status", [
  "eligible",
  "blocked",
  "reversed",
  "pending"
]);
export const gstItcClaimStatusEnum = pgEnum("gst_itc_claim_status", ["unclaimed", "claimed", "partially_claimed"]);

export const gstAdjustments = pgTable(
  "gst_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    adjustmentNumber: text("adjustment_number").notNull(),
    adjustmentDate: date("adjustment_date", { mode: "date" }).notNull(),
    adjustmentType: gstAdjustmentTypeEnum("adjustment_type").notNull(),
    taxComponent: gstTaxComponentEnum("tax_component").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    reason: text("reason").notNull(),
    referenceNumber: text("reference_number"),
    notes: text("notes"),
    status: gstAdjustmentStatusEnum("status").notNull().default("active"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("gst_adjustments_company_id_idx").on(table.companyId),
    dateIdx: index("gst_adjustments_adjustment_date_idx").on(table.adjustmentDate),
    statusIdx: index("gst_adjustments_status_idx").on(table.status),
    typeIdx: index("gst_adjustments_type_idx").on(table.adjustmentType),
    companyAdjustmentNumberUniqueIdx: uniqueIndex("gst_adjustments_company_adjustment_number_unique_idx").on(
      table.companyId,
      table.adjustmentNumber
    ),
    amountCheck: check("gst_adjustments_amount_check", sql`${table.amount} > 0`)
  })
);

export const gstReportExports = pgTable(
  "gst_report_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    reportType: gstReportTypeEnum("report_type").notNull(),
    dateFrom: date("date_from", { mode: "date" }).notNull(),
    dateTo: date("date_to", { mode: "date" }).notNull(),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
    fileUrl: text("file_url"),
    exportedBy: uuid("exported_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("gst_report_exports_company_id_idx").on(table.companyId),
    reportTypeIdx: index("gst_report_exports_report_type_idx").on(table.reportType),
    createdAtIdx: index("gst_report_exports_created_at_idx").on(table.createdAt),
    dateRangeCheck: check("gst_report_exports_date_range_check", sql`${table.dateTo} >= ${table.dateFrom}`)
  })
);

export const gstItcStatus = pgTable(
  "gst_itc_status",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    sourceType: gstItcSourceTypeEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    sourceNumber: text("source_number"),
    supplierGstin: text("supplier_gstin"),
    invoiceDate: date("invoice_date", { mode: "date" }).notNull(),
    taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    cessAmount: numeric("cess_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalGstAmount: numeric("total_gst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    eligibilityStatus: gstItcEligibilityStatusEnum("eligibility_status").notNull().default("eligible"),
    claimStatus: gstItcClaimStatusEnum("claim_status").notNull().default("unclaimed"),
    claimedAmount: numeric("claimed_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("gst_itc_status_company_id_idx").on(table.companyId),
    sourceIdx: index("gst_itc_status_source_type_source_id_idx").on(table.sourceType, table.sourceId),
    eligibilityIdx: index("gst_itc_status_eligibility_status_idx").on(table.eligibilityStatus),
    claimIdx: index("gst_itc_status_claim_status_idx").on(table.claimStatus),
    invoiceDateIdx: index("gst_itc_status_invoice_date_idx").on(table.invoiceDate),
    companySourceUniqueIdx: uniqueIndex("gst_itc_status_company_source_unique_idx").on(
      table.companyId,
      table.sourceType,
      table.sourceId
    ),
    taxableAmountCheck: check("gst_itc_status_taxable_amount_check", sql`${table.taxableAmount} >= 0`),
    cgstAmountCheck: check("gst_itc_status_cgst_amount_check", sql`${table.cgstAmount} >= 0`),
    sgstAmountCheck: check("gst_itc_status_sgst_amount_check", sql`${table.sgstAmount} >= 0`),
    igstAmountCheck: check("gst_itc_status_igst_amount_check", sql`${table.igstAmount} >= 0`),
    cessAmountCheck: check("gst_itc_status_cess_amount_check", sql`${table.cessAmount} >= 0`),
    totalGstAmountCheck: check("gst_itc_status_total_gst_amount_check", sql`${table.totalGstAmount} >= 0`),
    claimedAmountCheck: check(
      "gst_itc_status_claimed_amount_check",
      sql`${table.claimedAmount} >= 0 AND ${table.claimedAmount} <= ${table.totalGstAmount}`
    )
  })
);

export const gstMonthlySummaries = pgTable(
  "gst_monthly_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    periodMonth: date("period_month", { mode: "date" }).notNull(),
    taxableSales: numeric("taxable_sales", { precision: 14, scale: 2 }).notNull().default("0"),
    outputGst: numeric("output_gst", { precision: 14, scale: 2 }).notNull().default("0"),
    taxablePurchases: numeric("taxable_purchases", { precision: 14, scale: 2 }).notNull().default("0"),
    inputGst: numeric("input_gst", { precision: 14, scale: 2 }).notNull().default("0"),
    expenseInputGst: numeric("expense_input_gst", { precision: 14, scale: 2 }).notNull().default("0"),
    salesReturnGst: numeric("sales_return_gst", { precision: 14, scale: 2 }).notNull().default("0"),
    purchaseReturnGst: numeric("purchase_return_gst", { precision: 14, scale: 2 }).notNull().default("0"),
    netGstPayable: numeric("net_gst_payable", { precision: 14, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("gst_monthly_summaries_company_id_idx").on(table.companyId),
    periodMonthIdx: index("gst_monthly_summaries_period_month_idx").on(table.periodMonth),
    companyPeriodUniqueIdx: uniqueIndex("gst_monthly_summaries_company_period_month_unique_idx").on(
      table.companyId,
      table.periodMonth
    ),
    taxableSalesCheck: check("gst_monthly_summaries_taxable_sales_check", sql`${table.taxableSales} >= 0`),
    outputGstCheck: check("gst_monthly_summaries_output_gst_check", sql`${table.outputGst} >= 0`),
    taxablePurchasesCheck: check("gst_monthly_summaries_taxable_purchases_check", sql`${table.taxablePurchases} >= 0`),
    inputGstCheck: check("gst_monthly_summaries_input_gst_check", sql`${table.inputGst} >= 0`),
    expenseInputGstCheck: check("gst_monthly_summaries_expense_input_gst_check", sql`${table.expenseInputGst} >= 0`),
    salesReturnGstCheck: check("gst_monthly_summaries_sales_return_gst_check", sql`${table.salesReturnGst} >= 0`),
    purchaseReturnGstCheck: check("gst_monthly_summaries_purchase_return_gst_check", sql`${table.purchaseReturnGst} >= 0`)
  })
);
