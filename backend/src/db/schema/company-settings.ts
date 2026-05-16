import { and, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { companies } from "./companies";

export const companyGstTypeEnum = pgEnum("company_gst_type", [
  "regular",
  "composition",
  "unregistered"
]);

export const companyGstFilingFrequencyEnum = pgEnum("company_gst_filing_frequency", [
  "monthly",
  "quarterly",
  "annually"
]);

export const companyBankAccountTypeEnum = pgEnum("company_bank_account_type", [
  "current",
  "savings",
  "cash_credit",
  "overdraft",
  "other"
]);

export const companyInvoiceTaxDisplayFormatEnum = pgEnum("company_invoice_tax_display_format", [
  "item_wise",
  "summary",
  "both"
]);

export const companyInvoiceTemplateEnum = pgEnum("company_invoice_template", [
  "gst_a4",
  "pos",
  "thermal"
]);

export const companyTaxSettings = pgTable(
  "company_tax_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    gstEnabled: boolean("gst_enabled").notNull().default(false),
    gstType: companyGstTypeEnum("gst_type").notNull().default("unregistered"),
    compositionScheme: boolean("composition_scheme").notNull().default(false),
    taxInclusivePricing: boolean("tax_inclusive_pricing").notNull().default(false),
    defaultGstRate: numeric("default_gst_rate", { precision: 5, scale: 2 }),
    hsnSacEnabled: boolean("hsn_sac_enabled").notNull().default(false),
    eInvoiceEnabled: boolean("e_invoice_enabled").notNull().default(false),
    eWayBillEnabled: boolean("e_way_bill_enabled").notNull().default(false),
    gstFilingFrequency: companyGstFilingFrequencyEnum("gst_filing_frequency").notNull().default("monthly"),
    tanNumber: text("tan_number"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyUniqueIdx: uniqueIndex("company_tax_settings_company_id_unique_idx").on(table.companyId),
    companyIdx: index("company_tax_settings_company_id_idx").on(table.companyId)
  })
);

export const companyFinancialYears = pgTable(
  "company_financial_years",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date", { mode: "date" }).notNull(),
    endDate: date("end_date", { mode: "date" }).notNull(),
    isActive: boolean("is_active").notNull().default(false),
    isLocked: boolean("is_locked").notNull().default(false),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("company_financial_years_company_id_idx").on(table.companyId),
    companyActiveIdx: index("company_financial_years_company_active_idx").on(table.companyId, table.isActive),
    activeCompanyUniqueIdx: uniqueIndex("company_financial_years_active_company_unique_idx")
      .on(table.companyId)
      .where(sql`${table.isActive} = true`),
    dateRangeCheck: check("company_financial_years_date_check", sql`${table.endDate} > ${table.startDate}`)
  })
);

export const companyBankAccounts = pgTable(
  "company_bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    bankName: text("bank_name").notNull(),
    accountHolderName: text("account_holder_name").notNull(),
    accountNumber: text("account_number").notNull(),
    ifscCode: text("ifsc_code").notNull(),
    branchName: text("branch_name"),
    upiId: text("upi_id"),
    qrImageUrl: text("qr_image_url"),
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    accountType: companyBankAccountTypeEnum("account_type").notNull().default("current"),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("company_bank_accounts_company_id_idx").on(table.companyId),
    companyActiveIdx: index("company_bank_accounts_company_active_idx").on(table.companyId, table.isActive),
    defaultActiveUniqueIdx: uniqueIndex("company_bank_accounts_default_active_unique_idx")
      .on(table.companyId)
      .where(sql`${table.isDefault} = true AND ${table.isActive} = true AND ${table.deletedAt} is null`)
  })
);

export const companyInvoiceSettings = pgTable(
  "company_invoice_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    salesInvoicePrefix: text("sales_invoice_prefix").notNull().default("INV"),
    purchaseInvoicePrefix: text("purchase_invoice_prefix").notNull().default("PUR"),
    creditNotePrefix: text("credit_note_prefix").notNull().default("CN"),
    debitNotePrefix: text("debit_note_prefix").notNull().default("DN"),
    autoNumbering: boolean("auto_numbering").notNull().default(true),
    nextSalesInvoiceNumber: integer("next_sales_invoice_number").notNull().default(1),
    nextPurchaseInvoiceNumber: integer("next_purchase_invoice_number").notNull().default(1),
    numberPadding: integer("number_padding").notNull().default(4),
    termsAndConditions: text("terms_and_conditions"),
    footerNote: text("footer_note"),
    showCompanyLogo: boolean("show_company_logo").notNull().default(true),
    showBankDetails: boolean("show_bank_details").notNull().default(true),
    showQrCode: boolean("show_qr_code").notNull().default(false),
    showSignature: boolean("show_signature").notNull().default(false),
    roundOffEnabled: boolean("round_off_enabled").notNull().default(true),
    decimalPrecision: integer("decimal_precision").notNull().default(2),
    taxDisplayFormat: companyInvoiceTaxDisplayFormatEnum("tax_display_format").notNull().default("both"),
    invoiceTemplate: companyInvoiceTemplateEnum("invoice_template").notNull().default("gst_a4"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyUniqueIdx: uniqueIndex("company_invoice_settings_company_id_unique_idx").on(table.companyId),
    companyIdx: index("company_invoice_settings_company_id_idx").on(table.companyId)
  })
);

export const companyBranding = pgTable(
  "company_branding",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    logoUrl: text("logo_url"),
    invoiceLogoUrl: text("invoice_logo_url"),
    signatureUrl: text("signature_url"),
    stampUrl: text("stamp_url"),
    faviconUrl: text("favicon_url"),
    primaryColor: text("primary_color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyUniqueIdx: uniqueIndex("company_branding_company_id_unique_idx").on(table.companyId),
    companyIdx: index("company_branding_company_id_idx").on(table.companyId)
  })
);

export const companyBranches = pgTable(
  "company_branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    branchName: text("branch_name").notNull(),
    branchCode: text("branch_code").notNull(),
    gstNumber: text("gst_number"),
    email: text("email"),
    mobileNumber: text("mobile_number"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    managerName: text("manager_name"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("company_branches_company_id_idx").on(table.companyId),
    companyBranchCodeIdx: index("company_branches_company_branch_code_idx").on(table.companyId, table.branchCode),
    companyActiveIdx: index("company_branches_company_active_idx").on(table.companyId, table.isActive),
    gstIdx: index("company_branches_gst_number_idx").on(table.gstNumber),
    companyBranchCodeUniqueIdx: uniqueIndex("company_branches_company_branch_code_unique_idx")
      .on(table.companyId, table.branchCode)
      .where(sql`${table.deletedAt} is null`)
  })
);

export const companyPreferences = pgTable(
  "company_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    dateFormat: text("date_format").notNull().default("DD/MM/YYYY"),
    currencyFormat: text("currency_format").notNull().default("symbol_first"),
    numberFormat: text("number_format").notNull().default("indian"),
    decimalPrecision: integer("decimal_precision").notNull().default(2),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    language: text("language").notNull().default("en"),
    autoLogoutMinutes: integer("auto_logout_minutes").notNull().default(30),
    notificationEmailEnabled: boolean("notification_email_enabled").notNull().default(true),
    notificationSmsEnabled: boolean("notification_sms_enabled").notNull().default(false),
    notificationWhatsappEnabled: boolean("notification_whatsapp_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyUniqueIdx: uniqueIndex("company_preferences_company_id_unique_idx").on(table.companyId),
    companyIdx: index("company_preferences_company_id_idx").on(table.companyId)
  })
);
