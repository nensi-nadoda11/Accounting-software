import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
import { users } from "./users";

export const supplierTypeEnum = pgEnum("supplier_type", [
  "individual",
  "business",
  "manufacturer",
  "distributor",
  "wholesaler"
]);
export const supplierTaxTypeEnum = pgEnum("supplier_tax_type", ["registered", "unregistered", "composition"]);
export const supplierOpeningBalanceTypeEnum = pgEnum("supplier_opening_balance_type", ["debit", "credit", "none"]);
export const supplierStatusEnum = pgEnum("supplier_status", ["active", "inactive", "blocked", "deleted"]);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    supplierCode: text("supplier_code").notNull(),
    name: text("name").notNull(),
    supplierType: supplierTypeEnum("supplier_type").notNull(),
    businessName: text("business_name"),
    contactPerson: text("contact_person"),
    mobile: text("mobile").notNull(),
    alternateMobile: text("alternate_mobile"),
    email: text("email"),
    website: text("website"),
    gstNumber: text("gst_number"),
    panNumber: text("pan_number"),
    tanNumber: text("tan_number"),
    taxType: supplierTaxTypeEnum("tax_type").notNull().default("unregistered"),
    gstState: text("gst_state"),
    reverseChargeApplicable: boolean("reverse_charge_applicable").notNull().default(false),
    msmeRegistered: boolean("msme_registered").notNull().default(false),
    billingAddressLine1: text("billing_address_line1"),
    billingAddressLine2: text("billing_address_line2"),
    billingCity: text("billing_city"),
    billingState: text("billing_state"),
    billingPincode: text("billing_pincode"),
    billingCountry: text("billing_country").notNull().default("India"),
    shippingAddressLine1: text("shipping_address_line1"),
    shippingAddressLine2: text("shipping_address_line2"),
    shippingCity: text("shipping_city"),
    shippingState: text("shipping_state"),
    shippingPincode: text("shipping_pincode"),
    shippingCountry: text("shipping_country").notNull().default("India"),
    sameAsBilling: boolean("same_as_billing").notNull().default(true),
    openingBalanceAmount: numeric("opening_balance_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    openingBalanceType: supplierOpeningBalanceTypeEnum("opening_balance_type").notNull().default("none"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }).notNull().default("0"),
    creditDays: integer("credit_days").notNull().default(0),
    paymentTerms: text("payment_terms"),
    defaultGstRate: numeric("default_gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    defaultDiscount: numeric("default_discount", { precision: 5, scale: 2 }).notNull().default("0"),
    bankName: text("bank_name"),
    accountHolderName: text("account_holder_name"),
    accountNumber: text("account_number"),
    ifscCode: text("ifsc_code"),
    bankBranch: text("bank_branch"),
    upiId: text("upi_id"),
    status: supplierStatusEnum("status").notNull().default("active"),
    isBlacklisted: boolean("is_blacklisted").notNull().default(false),
    isPreferred: boolean("is_preferred").notNull().default(false),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("suppliers_company_id_idx").on(table.companyId),
    companyGstIdx: index("suppliers_company_gst_number_idx").on(table.companyId, table.gstNumber),
    companyNameIdx: index("suppliers_company_name_idx").on(table.companyId, table.name),
    companyStatusIdx: index("suppliers_company_status_idx").on(table.companyId, table.status),
    companySupplierTypeIdx: index("suppliers_company_supplier_type_idx").on(table.companyId, table.supplierType),
    companySupplierCodeUniqueIdx: uniqueIndex("suppliers_company_supplier_code_unique_idx").on(
      table.companyId,
      table.supplierCode
    ),
    companyMobileUniqueIdx: uniqueIndex("suppliers_company_mobile_unique_idx")
      .on(table.companyId, table.mobile)
      .where(sql`${table.deletedAt} is null`),
    companyEmailUniqueIdx: uniqueIndex("suppliers_company_email_unique_idx")
      .on(table.companyId, table.email)
      .where(sql`${table.email} is not null AND ${table.deletedAt} is null`),
    openingBalanceAmountCheck: check(
      "suppliers_opening_balance_amount_check",
      sql`${table.openingBalanceAmount} >= 0`
    ),
    creditLimitCheck: check("suppliers_credit_limit_check", sql`${table.creditLimit} >= 0`),
    creditDaysCheck: check(
      "suppliers_credit_days_check",
      sql`${table.creditDays} >= 0 AND ${table.creditDays} <= 365`
    ),
    defaultGstRateCheck: check(
      "suppliers_default_gst_rate_check",
      sql`${table.defaultGstRate} >= 0 AND ${table.defaultGstRate} <= 28`
    ),
    defaultDiscountCheck: check(
      "suppliers_default_discount_check",
      sql`${table.defaultDiscount} >= 0 AND ${table.defaultDiscount} <= 100`
    )
  })
);
