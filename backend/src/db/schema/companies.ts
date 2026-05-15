import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const companyStatusEnum = pgEnum("company_status", [
  "setup_pending",
  "active",
  "suspended",
  "inactive"
]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  gstNumber: text("gst_number"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  status: companyStatusEnum("status").notNull().default("setup_pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});
