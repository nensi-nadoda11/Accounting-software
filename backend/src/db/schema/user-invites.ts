import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { userRoleEnum, users } from "./users";

export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "expired", "revoked"]);

export const userInvites = pgTable(
  "user_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    mobileNumber: text("mobile_number"),
    role: userRoleEnum("role").notNull(),
    permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
    tokenHash: text("token_hash").notNull(),
    status: inviteStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tokenIdx: index("user_invites_token_hash_idx").on(table.tokenHash),
    companyIdx: index("user_invites_company_id_idx").on(table.companyId)
  })
);
