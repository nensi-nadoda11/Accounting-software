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

export const customerTypeEnum = pgEnum("customer_type", ["individual", "business"]);
export const customerTaxTypeEnum = pgEnum("customer_tax_type", ["registered", "unregistered", "composition"]);
export const customerOpeningBalanceTypeEnum = pgEnum("customer_opening_balance_type", ["debit", "credit", "none"]);
export const customerStatusEnum = pgEnum("customer_status", ["active", "inactive", "deleted"]);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    customerCode: text("customer_code").notNull(),
    name: text("name").notNull(),
    customerType: customerTypeEnum("customer_type").notNull(),
    businessName: text("business_name"),
    contactPerson: text("contact_person"),
    mobile: text("mobile").notNull(),
    alternateMobile: text("alternate_mobile"),
    email: text("email"),
    gstNumber: text("gst_number"),
    panNumber: text("pan_number"),
    taxType: customerTaxTypeEnum("tax_type").notNull().default("unregistered"),
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
    sameAsBilling: boolean("same_as_billing").notNull().default(false),
    openingBalanceAmount: numeric("opening_balance_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    openingBalanceType: customerOpeningBalanceTypeEnum("opening_balance_type").notNull().default("none"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }).notNull().default("0"),
    creditDays: integer("credit_days").notNull().default(0),
    defaultDiscount: numeric("default_discount", { precision: 5, scale: 2 }).notNull().default("0"),
    status: customerStatusEnum("status").notNull().default("active"),
    isBlacklisted: boolean("is_blacklisted").notNull().default(false),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("customers_company_id_idx").on(table.companyId),
    companyNameIdx: index("customers_company_name_idx").on(table.companyId, table.name),
    companyStatusIdx: index("customers_company_status_idx").on(table.companyId, table.status),
    gstIdx: index("customers_gst_number_idx").on(table.gstNumber),
    companyCustomerCodeUniqueIdx: uniqueIndex("customers_company_customer_code_unique_idx").on(
      table.companyId,
      table.customerCode
    ),
    companyMobileUniqueIdx: uniqueIndex("customers_company_mobile_unique_idx")
      .on(table.companyId, table.mobile)
      .where(sql`${table.deletedAt} is null`),
    companyEmailUniqueIdx: uniqueIndex("customers_company_email_unique_idx")
      .on(table.companyId, table.email)
      .where(sql`${table.email} is not null AND ${table.deletedAt} is null`),
    openingBalanceAmountCheck: check(
      "customers_opening_balance_amount_check",
      sql`${table.openingBalanceAmount} >= 0`
    ),
    creditLimitCheck: check("customers_credit_limit_check", sql`${table.creditLimit} >= 0`),
    creditDaysCheck: check(
      "customers_credit_days_check",
      sql`${table.creditDays} >= 0 AND ${table.creditDays} <= 365`
    ),
    defaultDiscountCheck: check(
      "customers_default_discount_check",
      sql`${table.defaultDiscount} >= 0 AND ${table.defaultDiscount} <= 100`
    )
  })
);
