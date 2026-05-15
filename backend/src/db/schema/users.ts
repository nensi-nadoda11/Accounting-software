import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";

export const userRoleEnum = pgEnum("user_role", ["admin", "accountant", "staff", "auditor"]);
export const userStatusEnum = pgEnum("user_status", [
  "pending_verification",
  "invited",
  "active",
  "suspended",
  "disabled"
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    mobileNumber: text("mobile_number"),
    passwordHash: text("password_hash"),
    role: userRoleEnum("role").notNull().default("staff"),
    status: userStatusEnum("status").notNull().default("pending_verification"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    mobileVerifiedAt: timestamp("mobile_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_unique_idx").on(table.email),
    mobileIdx: uniqueIndex("users_mobile_number_unique_idx").on(table.mobileNumber),
    companyIdx: index("users_company_id_idx").on(table.companyId),
    roleIdx: index("users_role_idx").on(table.role)
  })
);
