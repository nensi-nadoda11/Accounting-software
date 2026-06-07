import { date, index, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { users } from "./users";

export const cashVerificationStatusEnum = pgEnum("cash_verification_status", ["matched", "short_cash", "excess_cash"]);
export const cashVerificationRecordStatusEnum = pgEnum("cash_verification_record_status", [
  "draft",
  "completed",
  "approved",
  "cancelled"
]);

export const cashVerifications = pgTable(
  "cash_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    verificationNo: text("verification_no").notNull(),
    verificationDate: date("verification_date").notNull(),
    expectedCash: numeric("expected_cash", { precision: 14, scale: 2 }).notNull(),
    actualCash: numeric("actual_cash", { precision: 14, scale: 2 }).notNull(),
    differenceAmount: numeric("difference_amount", { precision: 14, scale: 2 }).notNull(),
    status: cashVerificationStatusEnum("status").notNull(),
    remarks: text("remarks"),
    verifiedByUserId: uuid("verified_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    approvalDate: timestamp("approval_date", { withTimezone: true }),
    recordStatus: cashVerificationRecordStatusEnum("record_status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("cash_verifications_company_id_idx").on(table.companyId),
    verificationDateIdx: index("cash_verifications_verification_date_idx").on(table.verificationDate),
    statusIdx: index("cash_verifications_status_idx").on(table.status),
    recordStatusIdx: index("cash_verifications_record_status_idx").on(table.recordStatus),
    companyVerificationNoUniqueIdx: uniqueIndex("cash_verifications_company_verification_no_unique_idx").on(
      table.companyId,
      table.verificationNo
    )
  })
);
