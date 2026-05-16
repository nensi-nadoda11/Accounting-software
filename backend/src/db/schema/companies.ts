import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const companyStatusEnum = pgEnum("company_status", [
  "setup_pending",
  "active",
  "suspended",
  "inactive"
]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  businessType: text("business_type"),
  industryType: text("industry_type"),
  gstNumber: text("gst_number"),
  panNumber: text("pan_number"),
  cinNumber: text("cin_number"),
  email: text("email"),
  mobileNumber: text("mobile_number"),
  website: text("website"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  country: text("country").notNull().default("India"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  currency: text("currency").notNull().default("INR"),
  language: text("language").notNull().default("en"),
  status: companyStatusEnum("status").notNull().default("setup_pending"),
  setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  gstIdx: index("companies_gst_number_idx").on(table.gstNumber),
  statusIdx: index("companies_status_idx").on(table.status)
}));
