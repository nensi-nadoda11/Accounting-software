import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { companyBankAccounts } from "./company-settings";
import { users } from "./users";

export const paymentTypeEnum = pgEnum("payment_type", ["customer_receive", "supplier_pay"]);
export const paymentPartyTypeEnum = pgEnum("payment_party_type", ["customer", "supplier"]);
export const paymentModeEnum = pgEnum("payment_mode", [
  "cash",
  "bank",
  "upi",
  "card",
  "cheque",
  "neft",
  "rtgs",
  "imps",
  "other"
]);
export const paymentStatusEnum = pgEnum("payment_status", ["draft", "completed", "cancelled", "bounced", "reversed"]);
export const paymentAllocationTypeEnum = pgEnum("payment_allocation_type", [
  "sales_invoice",
  "purchase_invoice",
  "advance_adjustment"
]);
export const paymentReceiptTypeEnum = pgEnum("payment_receipt_type", ["customer_receipt", "supplier_voucher"]);
export const paymentReminderReferenceTypeEnum = pgEnum("payment_reminder_reference_type", [
  "sales_invoice",
  "purchase_invoice",
  "advance",
  "manual"
]);
export const paymentReminderChannelEnum = pgEnum("payment_reminder_channel", ["in_app", "email", "whatsapp"]);
export const paymentReminderStatusEnum = pgEnum("payment_reminder_status", ["pending", "sent", "failed", "cancelled"]);
export const chequeStatusEnum = pgEnum("cheque_status", [
  "received",
  "issued",
  "deposited",
  "cleared",
  "bounced",
  "cancelled"
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    paymentNumber: text("payment_number").notNull(),
    paymentType: paymentTypeEnum("payment_type").notNull(),
    partyType: paymentPartyTypeEnum("party_type").notNull(),
    partyId: uuid("party_id").notNull(),
    paymentDate: date("payment_date", { mode: "date" }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    allocatedAmount: numeric("allocated_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    unallocatedAmount: numeric("unallocated_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    paymentMode: paymentModeEnum("payment_mode").notNull(),
    bankAccountId: uuid("bank_account_id").references(() => companyBankAccounts.id, { onDelete: "restrict" }),
    referenceNumber: text("reference_number"),
    notes: text("notes"),
    status: paymentStatusEnum("status").notNull().default("draft"),
    isAdvance: boolean("is_advance").notNull().default(false),
    chequeNumber: text("cheque_number"),
    chequeDate: date("cheque_date", { mode: "date" }),
    chequeBankName: text("cheque_bank_name"),
    chequeStatus: chequeStatusEnum("cheque_status"),
    receiptNumber: text("receipt_number"),
    receiptGeneratedAt: timestamp("receipt_generated_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    accountingEventCreated: boolean("accounting_event_created").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("payments_company_id_idx").on(table.companyId),
    companyPaymentNumberUniqueIdx: uniqueIndex("payments_company_payment_number_unique_idx").on(
      table.companyId,
      table.paymentNumber
    ),
    partyIdx: index("payments_company_party_idx").on(table.companyId, table.partyType, table.partyId),
    paymentDateIdx: index("payments_company_payment_date_idx").on(table.companyId, table.paymentDate),
    paymentModeIdx: index("payments_company_payment_mode_idx").on(table.companyId, table.paymentMode),
    statusIdx: index("payments_company_status_idx").on(table.companyId, table.status),
    receiptNumberIdx: index("payments_company_receipt_number_idx").on(table.companyId, table.receiptNumber),
    amountCheck: check("payments_amount_check", sql`${table.amount} > 0`),
    allocatedAmountCheck: check("payments_allocated_amount_check", sql`${table.allocatedAmount} >= 0`),
    unallocatedAmountCheck: check("payments_unallocated_amount_check", sql`${table.unallocatedAmount} >= 0`)
  })
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    allocationType: paymentAllocationTypeEnum("allocation_type").notNull(),
    referenceId: uuid("reference_id"),
    referenceNumber: text("reference_number"),
    partyType: paymentPartyTypeEnum("party_type").notNull(),
    partyId: uuid("party_id").notNull(),
    allocatedAmount: numeric("allocated_amount", { precision: 14, scale: 2 }).notNull(),
    allocationDate: date("allocation_date", { mode: "date" }).notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    paymentIdx: index("payment_allocations_company_payment_idx").on(table.companyId, table.paymentId),
    referenceIdx: index("payment_allocations_company_reference_idx").on(
      table.companyId,
      table.referenceId,
      table.allocationType
    ),
    allocatedAmountCheck: check("payment_allocations_allocated_amount_check", sql`${table.allocatedAmount} > 0`)
  })
);

export const paymentReceipts = pgTable(
  "payment_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    receiptNumber: text("receipt_number").notNull(),
    receiptType: paymentReceiptTypeEnum("receipt_type").notNull(),
    receiptData: jsonb("receipt_data").$type<Record<string, unknown>>().notNull().default({}),
    pdfUrl: text("pdf_url"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    paymentUniqueIdx: uniqueIndex("payment_receipts_payment_id_unique_idx").on(table.paymentId),
    receiptNumberUniqueIdx: uniqueIndex("payment_receipts_company_receipt_number_unique_idx").on(
      table.companyId,
      table.receiptNumber
    )
  })
);

export const paymentReminders = pgTable(
  "payment_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    partyType: paymentPartyTypeEnum("party_type").notNull(),
    partyId: uuid("party_id").notNull(),
    referenceType: paymentReminderReferenceTypeEnum("reference_type").notNull(),
    referenceId: uuid("reference_id"),
    referenceNumber: text("reference_number"),
    dueDate: date("due_date", { mode: "date" }).notNull(),
    amountDue: numeric("amount_due", { precision: 14, scale: 2 }).notNull(),
    channel: paymentReminderChannelEnum("channel").notNull(),
    status: paymentReminderStatusEnum("status").notNull().default("pending"),
    message: text("message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    partyStatusIdx: index("payment_reminders_company_party_status_idx").on(
      table.companyId,
      table.partyType,
      table.partyId,
      table.status
    ),
    dueDateIdx: index("payment_reminders_company_due_date_idx").on(table.companyId, table.dueDate),
    amountDueCheck: check("payment_reminders_amount_due_check", sql`${table.amountDue} > 0`)
  })
);

export const chequeTransactions = pgTable(
  "cheque_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    chequeNumber: text("cheque_number").notNull(),
    chequeDate: date("cheque_date", { mode: "date" }).notNull(),
    bankName: text("bank_name").notNull(),
    status: chequeStatusEnum("status").notNull(),
    statusDate: date("status_date", { mode: "date" }).notNull(),
    remarks: text("remarks"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    paymentIdx: index("cheque_transactions_company_payment_idx").on(table.companyId, table.paymentId)
  })
);
