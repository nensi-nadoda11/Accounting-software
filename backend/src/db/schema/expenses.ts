import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  type AnyPgColumn,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { chartOfAccounts } from "./accounting";
import { companies } from "./companies";
import { companyBankAccounts } from "./company-settings";
import { chequeStatusEnum, paymentModeEnum } from "./payments";
import { productPriceTaxTypeEnum } from "./products";
import { users } from "./users";

export const expenseCategoryStatusEnum = pgEnum("expense_category_status", ["active", "inactive", "deleted"]);
export const expenseStatusEnum = pgEnum("expense_status", ["draft", "posted", "approved", "cancelled", "recurring_generated"]);
export const recurringExpenseFrequencyEnum = pgEnum("recurring_expense_frequency", [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "yearly"
]);
export const recurringExpenseStatusEnum = pgEnum("recurring_expense_status", ["active", "paused", "completed", "cancelled"]);
export const recurringExpenseCreateStatusEnum = pgEnum("recurring_expense_create_status", ["draft", "posted"]);

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    categoryCode: text("category_code").notNull(),
    name: text("name").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => expenseCategories.id, { onDelete: "restrict" }),
    defaultAccountId: uuid("default_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
    color: text("color"),
    icon: text("icon"),
    description: text("description"),
    status: expenseCategoryStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyStatusParentIdx: index("expense_categories_company_status_parent_idx").on(table.companyId, table.status, table.parentId),
    companyCodeUniqueIdx: uniqueIndex("expense_categories_company_category_code_unique_idx").on(table.companyId, table.categoryCode),
    companyNameUniqueIdx: uniqueIndex("expense_categories_company_name_unique_idx")
      .on(table.companyId, table.name)
      .where(sql`${table.deletedAt} IS NULL`)
  })
);

export const recurringExpenses = pgTable(
  "recurring_expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    templateName: text("template_name").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategories.id, { onDelete: "restrict" }),
    expenseAccountId: uuid("expense_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
    payeeName: text("payee_name"),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    gstApplicable: boolean("gst_applicable").notNull().default(false),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    priceTaxType: productPriceTaxTypeEnum("price_tax_type").notNull(),
    paymentMode: paymentModeEnum("payment_mode").notNull(),
    bankAccountId: uuid("bank_account_id").references(() => companyBankAccounts.id, { onDelete: "restrict" }),
    frequency: recurringExpenseFrequencyEnum("frequency").notNull(),
    startDate: date("start_date", { mode: "date" }).notNull(),
    endDate: date("end_date", { mode: "date" }),
    nextRunDate: date("next_run_date", { mode: "date" }).notNull(),
    autoCreateEnabled: boolean("auto_create_enabled").notNull().default(true),
    createAsStatus: recurringExpenseCreateStatusEnum("create_as_status").notNull().default("draft"),
    reminderDaysBefore: integer("reminder_days_before").notNull().default(0),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    status: recurringExpenseStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyStatusIdx: index("recurring_expenses_company_status_idx").on(table.companyId, table.status),
    companyNextRunIdx: index("recurring_expenses_company_next_run_idx").on(table.companyId, table.nextRunDate),
    categoryIdx: index("recurring_expenses_category_id_idx").on(table.categoryId),
    reminderDaysCheck: check("recurring_expenses_reminder_days_check", sql`${table.reminderDaysBefore} >= 0`),
    amountCheck: check("recurring_expenses_amount_check", sql`${table.amount} > 0`),
    gstRateCheck: check("recurring_expenses_gst_rate_check", sql`${table.gstRate} >= 0 AND ${table.gstRate} <= 28`),
    endDateCheck: check("recurring_expenses_end_date_check", sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`)
  })
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    expenseNumber: text("expense_number").notNull(),
    expenseDate: date("expense_date", { mode: "date" }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategories.id, { onDelete: "restrict" }),
    expenseAccountId: uuid("expense_account_id").references(() => chartOfAccounts.id, { onDelete: "set null" }),
    payeeName: text("payee_name"),
    vendorGstNumber: text("vendor_gst_number"),
    vendorPanNumber: text("vendor_pan_number"),
    hsnSacCode: text("hsn_sac_code"),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    gstApplicable: boolean("gst_applicable").notNull().default(false),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    priceTaxType: productPriceTaxTypeEnum("price_tax_type").notNull(),
    taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    paymentMode: paymentModeEnum("payment_mode").notNull(),
    bankAccountId: uuid("bank_account_id").references(() => companyBankAccounts.id, { onDelete: "restrict" }),
    referenceNumber: text("reference_number"),
    chequeNumber: text("cheque_number"),
    chequeDate: date("cheque_date", { mode: "date" }),
    chequeStatus: chequeStatusEnum("cheque_status"),
    status: expenseStatusEnum("status").notNull().default("draft"),
    recurringExpenseId: uuid("recurring_expense_id").references(() => recurringExpenses.id, { onDelete: "set null" }),
    accountingEventCreated: boolean("accounting_event_created").notNull().default(false),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("expenses_company_id_idx").on(table.companyId),
    companyExpenseNumberUniqueIdx: uniqueIndex("expenses_company_expense_number_unique_idx").on(
      table.companyId,
      table.expenseNumber
    ),
    expenseDateIdx: index("expenses_expense_date_idx").on(table.expenseDate),
    categoryIdx: index("expenses_category_id_idx").on(table.categoryId),
    paymentModeIdx: index("expenses_payment_mode_idx").on(table.paymentMode),
    statusIdx: index("expenses_status_idx").on(table.status),
    recurringIdx: index("expenses_recurring_expense_id_idx").on(table.recurringExpenseId),
    amountCheck: check("expenses_amount_check", sql`${table.amount} > 0`),
    gstRateCheck: check("expenses_gst_rate_check", sql`${table.gstRate} >= 0 AND ${table.gstRate} <= 28`),
    taxableAmountCheck: check("expenses_taxable_amount_check", sql`${table.taxableAmount} >= 0`),
    cgstAmountCheck: check("expenses_cgst_amount_check", sql`${table.cgstAmount} >= 0`),
    sgstAmountCheck: check("expenses_sgst_amount_check", sql`${table.sgstAmount} >= 0`),
    igstAmountCheck: check("expenses_igst_amount_check", sql`${table.igstAmount} >= 0`),
    gstAmountCheck: check("expenses_gst_amount_check", sql`${table.gstAmount} >= 0`),
    totalAmountCheck: check("expenses_total_amount_check", sql`${table.totalAmount} >= 0`)
  })
);

export const expenseAttachments = pgTable(
  "expense_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
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
    companyExpenseIdx: index("expense_attachments_company_expense_idx").on(table.companyId, table.expenseId),
    companyCreatedIdx: index("expense_attachments_company_created_idx").on(table.companyId, table.createdAt),
    sizeCheck: check("expense_attachments_size_bytes_check", sql`${table.sizeBytes} > 0`)
  })
);
