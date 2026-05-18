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

import { companies } from "./companies";
import { companyFinancialYears } from "./company-settings";
import { users } from "./users";

export const accountTypeEnum = pgEnum("account_type", ["asset", "liability", "equity", "income", "expense"]);
export const accountNormalBalanceEnum = pgEnum("account_normal_balance", ["debit", "credit"]);
export const accountOpeningBalanceTypeEnum = pgEnum("account_opening_balance_type", ["debit", "credit", "none"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "inactive", "deleted"]);
export const journalVoucherTypeEnum = pgEnum("journal_voucher_type", [
  "journal",
  "sales",
  "purchase",
  "receipt",
  "payment",
  "contra",
  "debit_note",
  "credit_note",
  "expense",
  "payroll",
  "opening",
  "adjustment",
  "reversal"
]);
export const journalStatusEnum = pgEnum("journal_status", ["draft", "posted", "cancelled", "reversed"]);
export const journalPartyTypeEnum = pgEnum("journal_party_type", ["customer", "supplier"]);
export const financialLockTypeEnum = pgEnum("financial_lock_type", ["month", "quarter", "year"]);

export const chartOfAccounts = pgTable(
  "chart_of_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    accountCode: text("account_code").notNull(),
    accountName: text("account_name").notNull(),
    accountType: accountTypeEnum("account_type").notNull(),
    accountSubtype: text("account_subtype"),
    parentId: uuid("parent_id").references((): AnyPgColumn => chartOfAccounts.id, { onDelete: "restrict" }),
    isSystem: boolean("is_system").notNull().default(false),
    systemKey: text("system_key"),
    normalBalance: accountNormalBalanceEnum("normal_balance").notNull(),
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    openingBalanceType: accountOpeningBalanceTypeEnum("opening_balance_type").notNull().default("none"),
    currentBalance: numeric("current_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    status: accountStatusEnum("status").notNull().default("active"),
    description: text("description"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("chart_of_accounts_company_id_idx").on(table.companyId),
    companyTypeStatusIdx: index("chart_of_accounts_company_type_status_idx").on(table.companyId, table.accountType, table.status),
    companyParentIdx: index("chart_of_accounts_company_parent_id_idx").on(table.companyId, table.parentId),
    companyCodeUniqueIdx: uniqueIndex("chart_of_accounts_company_account_code_unique_idx")
      .on(table.companyId, table.accountCode)
      .where(sql`${table.deletedAt} IS NULL`),
    companySystemKeyUniqueIdx: uniqueIndex("chart_of_accounts_company_system_key_unique_idx")
      .on(table.companyId, table.systemKey)
      .where(sql`${table.systemKey} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    openingBalanceCheck: check("chart_of_accounts_opening_balance_check", sql`${table.openingBalance} >= 0`)
  })
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    financialYearId: uuid("financial_year_id").references(() => companyFinancialYears.id, { onDelete: "set null" }),
    journalNumber: text("journal_number").notNull(),
    entryDate: date("entry_date", { mode: "date" }).notNull(),
    voucherType: journalVoucherTypeEnum("voucher_type").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    referenceNumber: text("reference_number"),
    description: text("description").notNull(),
    status: journalStatusEnum("status").notNull().default("draft"),
    totalDebit: numeric("total_debit", { precision: 14, scale: 2 }).notNull().default("0"),
    totalCredit: numeric("total_credit", { precision: 14, scale: 2 }).notNull().default("0"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    reversedFromId: uuid("reversed_from_id").references((): AnyPgColumn => journalEntries.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyJournalNumberUniqueIdx: uniqueIndex("journal_entries_company_journal_number_unique_idx").on(
      table.companyId,
      table.journalNumber
    ),
    companyEntryDateIdx: index("journal_entries_company_entry_date_idx").on(table.companyId, table.entryDate),
    companyVoucherStatusIdx: index("journal_entries_company_voucher_status_idx").on(
      table.companyId,
      table.voucherType,
      table.status
    ),
    companyFinancialYearIdx: index("journal_entries_company_financial_year_idx").on(table.companyId, table.financialYearId),
    totalDebitCheck: check("journal_entries_total_debit_check", sql`${table.totalDebit} >= 0`),
    totalCreditCheck: check("journal_entries_total_credit_check", sql`${table.totalCredit} >= 0`)
  })
);

export const journalEntryLines = pgTable(
  "journal_entry_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    journalEntryId: uuid("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => chartOfAccounts.id, { onDelete: "restrict" }),
    lineNumber: integer("line_number").notNull(),
    description: text("description"),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
    balanceAfter: numeric("balance_after", { precision: 14, scale: 2 }),
    partyType: journalPartyTypeEnum("party_type"),
    partyId: uuid("party_id"),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyAccountCreatedIdx: index("journal_entry_lines_company_account_created_idx").on(
      table.companyId,
      table.accountId,
      table.createdAt
    ),
    companyJournalIdx: index("journal_entry_lines_company_journal_entry_idx").on(table.companyId, table.journalEntryId),
    companyPartyIdx: index("journal_entry_lines_company_party_idx").on(table.companyId, table.partyType, table.partyId),
    lineNumberCheck: check("journal_entry_lines_line_number_check", sql`${table.lineNumber} > 0`),
    debitCheck: check("journal_entry_lines_debit_check", sql`${table.debit} >= 0`),
    creditCheck: check("journal_entry_lines_credit_check", sql`${table.credit} >= 0`),
    oneSideCheck: check(
      "journal_entry_lines_one_side_check",
      sql`(
        (${table.debit} > 0 AND ${table.credit} = 0)
        OR (${table.credit} > 0 AND ${table.debit} = 0)
      )`
    )
  })
);

export const accountOpeningBalances = pgTable(
  "account_opening_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => chartOfAccounts.id, { onDelete: "restrict" }),
    financialYearId: uuid("financial_year_id").references(() => companyFinancialYears.id, { onDelete: "set null" }),
    openingDate: date("opening_date", { mode: "date" }).notNull(),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
    isLocked: boolean("is_locked").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyAccountIdx: index("account_opening_balances_company_account_idx").on(table.companyId, table.accountId),
    companyFinancialYearIdx: index("account_opening_balances_company_financial_year_idx").on(table.companyId, table.financialYearId),
    debitCheck: check("account_opening_balances_debit_check", sql`${table.debit} >= 0`),
    creditCheck: check("account_opening_balances_credit_check", sql`${table.credit} >= 0`),
    oneSideCheck: check(
      "account_opening_balances_one_side_check",
      sql`(
        (${table.debit} > 0 AND ${table.credit} = 0)
        OR (${table.credit} > 0 AND ${table.debit} = 0)
      )`
    )
  })
);

export const financialPeriodLocks = pgTable(
  "financial_period_locks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    financialYearId: uuid("financial_year_id").references(() => companyFinancialYears.id, { onDelete: "set null" }),
    periodStart: date("period_start", { mode: "date" }).notNull(),
    periodEnd: date("period_end", { mode: "date" }).notNull(),
    lockType: financialLockTypeEnum("lock_type").notNull(),
    isLocked: boolean("is_locked").notNull().default(true),
    lockedBy: uuid("locked_by").references(() => users.id, { onDelete: "set null" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyPeriodIdx: index("financial_period_locks_company_period_idx").on(table.companyId, table.periodStart, table.periodEnd),
    companyFinancialYearIdx: index("financial_period_locks_company_financial_year_idx").on(table.companyId, table.financialYearId),
    periodCheck: check("financial_period_locks_period_check", sql`${table.periodEnd} >= ${table.periodStart}`)
  })
);
