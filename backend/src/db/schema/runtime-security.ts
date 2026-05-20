import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const requestRateLimits = pgTable(
  "request_rate_limits",
  {
    key: text("key").primaryKey(),
    scope: text("scope").notNull(),
    identifier: text("identifier").notNull(),
    hitCount: integer("hit_count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
    windowEndsAt: timestamp("window_ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    scopeIdentifierIdx: index("request_rate_limits_scope_identifier_idx").on(table.scope, table.identifier),
    windowEndsAtIdx: index("request_rate_limits_window_ends_at_idx").on(table.windowEndsAt)
  })
);

export const loginAttemptLocks = pgTable(
  "login_attempt_locks",
  {
    key: text("key").primaryKey(),
    identifier: text("identifier").notNull(),
    failedCount: integer("failed_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    identifierIdx: index("login_attempt_locks_identifier_idx").on(table.identifier),
    expiresAtIdx: index("login_attempt_locks_expires_at_idx").on(table.expiresAt),
    lockedUntilIdx: index("login_attempt_locks_locked_until_idx").on(table.lockedUntil)
  })
);
