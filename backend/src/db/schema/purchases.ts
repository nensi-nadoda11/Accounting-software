import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
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
import { productBatches, warehouses } from "./inventory";
import { products, productPriceTaxTypeEnum } from "./products";
import { suppliers } from "./suppliers";
import { users } from "./users";

export const purchaseStatusEnum = pgEnum("purchase_status", ["draft", "posted", "cancelled", "returned"]);
export const purchasePaymentStatusEnum = pgEnum("purchase_payment_status", ["unpaid", "partial", "paid", "overdue"]);
export const purchasePaymentModeEnum = pgEnum("purchase_payment_mode", ["cash", "bank", "upi", "card", "cheque"]);
export const accountingEventStatusEnum = pgEnum("accounting_event_status", ["pending", "processed", "failed", "cancelled"]);

export const purchaseInvoices = pgTable(
  "purchase_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    purchaseNumber: text("purchase_number").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    supplierInvoiceNumber: text("supplier_invoice_number"),
    invoiceDate: date("invoice_date", { mode: "date" }).notNull(),
    dueDate: date("due_date", { mode: "date" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "restrict" }),
    purchaseStatus: purchaseStatusEnum("purchase_status").notNull().default("draft"),
    paymentStatus: purchasePaymentStatusEnum("payment_status").notNull().default("unpaid"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    itemDiscountTotal: numeric("item_discount_total", { precision: 14, scale: 2 }).notNull().default("0"),
    invoiceDiscountTotal: numeric("invoice_discount_total", { precision: 14, scale: 2 }).notNull().default("0"),
    additionalCharges: numeric("additional_charges", { precision: 14, scale: 2 }).notNull().default("0"),
    freightCharges: numeric("freight_charges", { precision: 14, scale: 2 }).notNull().default("0"),
    taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    cgstTotal: numeric("cgst_total", { precision: 14, scale: 2 }).notNull().default("0"),
    sgstTotal: numeric("sgst_total", { precision: 14, scale: 2 }).notNull().default("0"),
    igstTotal: numeric("igst_total", { precision: 14, scale: 2 }).notNull().default("0"),
    cessTotal: numeric("cess_total", { precision: 14, scale: 2 }).notNull().default("0"),
    gstTotal: numeric("gst_total", { precision: 14, scale: 2 }).notNull().default("0"),
    roundOffAmount: numeric("round_off_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull().default("0"),
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    dueAmount: numeric("due_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    paymentMode: purchasePaymentModeEnum("payment_mode"),
    paymentReference: text("payment_reference"),
    bankAccountId: uuid("bank_account_id").references(() => companyBankAccounts.id, { onDelete: "restrict" }),
    notes: text("notes"),
    termsConditions: text("terms_conditions"),
    attachmentUrl: text("attachment_url"),
    accountingEventCreated: boolean("accounting_event_created").notNull().default(false),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("purchase_invoices_company_id_idx").on(table.companyId),
    supplierIdx: index("purchase_invoices_supplier_id_idx").on(table.supplierId),
    invoiceDateIdx: index("purchase_invoices_invoice_date_idx").on(table.invoiceDate),
    paymentStatusIdx: index("purchase_invoices_payment_status_idx").on(table.paymentStatus),
    purchaseStatusIdx: index("purchase_invoices_purchase_status_idx").on(table.purchaseStatus),
    companyPurchaseNumberUniqueIdx: uniqueIndex("purchase_invoices_company_purchase_number_unique_idx").on(
      table.companyId,
      table.purchaseNumber
    ),
    companySupplierInvoiceUniqueIdx: uniqueIndex("purchase_invoices_company_supplier_supplier_invoice_unique_idx")
      .on(table.companyId, table.supplierId, table.supplierInvoiceNumber)
      .where(sql`${table.supplierInvoiceNumber} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    subtotalCheck: check("purchase_invoices_subtotal_check", sql`${table.subtotal} >= 0`),
    itemDiscountCheck: check("purchase_invoices_item_discount_total_check", sql`${table.itemDiscountTotal} >= 0`),
    invoiceDiscountCheck: check(
      "purchase_invoices_invoice_discount_total_check",
      sql`${table.invoiceDiscountTotal} >= 0`
    ),
    additionalChargesCheck: check(
      "purchase_invoices_additional_charges_check",
      sql`${table.additionalCharges} >= 0`
    ),
    freightChargesCheck: check("purchase_invoices_freight_charges_check", sql`${table.freightCharges} >= 0`),
    taxableAmountCheck: check("purchase_invoices_taxable_amount_check", sql`${table.taxableAmount} >= 0`),
    cgstCheck: check("purchase_invoices_cgst_total_check", sql`${table.cgstTotal} >= 0`),
    sgstCheck: check("purchase_invoices_sgst_total_check", sql`${table.sgstTotal} >= 0`),
    igstCheck: check("purchase_invoices_igst_total_check", sql`${table.igstTotal} >= 0`),
    cessCheck: check("purchase_invoices_cess_total_check", sql`${table.cessTotal} >= 0`),
    gstCheck: check("purchase_invoices_gst_total_check", sql`${table.gstTotal} >= 0`),
    grandTotalCheck: check("purchase_invoices_grand_total_check", sql`${table.grandTotal} >= 0`),
    paidAmountCheck: check("purchase_invoices_paid_amount_check", sql`${table.paidAmount} >= 0`),
    dueAmountCheck: check("purchase_invoices_due_amount_check", sql`${table.dueAmount} >= 0`)
  })
);

export const purchaseInvoiceItems = pgTable(
  "purchase_invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    purchaseInvoiceId: uuid("purchase_invoice_id")
      .notNull()
      .references(() => purchaseInvoices.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id").references(() => productBatches.id, { onDelete: "set null" }),
    lineNumber: integer("line_number").notNull(),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot").notNull(),
    hsnSacSnapshot: text("hsn_sac_snapshot"),
    unitSnapshot: text("unit_snapshot").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    freeQuantity: numeric("free_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    purchaseRate: numeric("purchase_rate", { precision: 14, scale: 2 }).notNull(),
    priceTaxType: productPriceTaxTypeEnum("price_tax_type").notNull(),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    cessRate: numeric("cess_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    cessAmount: numeric("cess_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
    manufacturingDate: date("manufacturing_date", { mode: "date" }),
    expiryDate: date("expiry_date", { mode: "date" }),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("purchase_invoice_items_company_id_idx").on(table.companyId),
    invoiceIdx: index("purchase_invoice_items_purchase_invoice_id_idx").on(table.purchaseInvoiceId),
    productIdx: index("purchase_invoice_items_product_id_idx").on(table.productId),
    warehouseIdx: index("purchase_invoice_items_warehouse_id_idx").on(table.warehouseId),
    batchIdx: index("purchase_invoice_items_batch_id_idx").on(table.batchId),
    quantityCheck: check("purchase_invoice_items_quantity_check", sql`${table.quantity} > 0`),
    freeQuantityCheck: check("purchase_invoice_items_free_quantity_check", sql`${table.freeQuantity} >= 0`),
    purchaseRateCheck: check("purchase_invoice_items_purchase_rate_check", sql`${table.purchaseRate} >= 0`),
    discountPercentCheck: check(
      "purchase_invoice_items_discount_percent_check",
      sql`${table.discountPercent} >= 0 AND ${table.discountPercent} <= 100`
    ),
    discountAmountCheck: check("purchase_invoice_items_discount_amount_check", sql`${table.discountAmount} >= 0`),
    taxableAmountCheck: check("purchase_invoice_items_taxable_amount_check", sql`${table.taxableAmount} >= 0`),
    gstRateCheck: check("purchase_invoice_items_gst_rate_check", sql`${table.gstRate} >= 0 AND ${table.gstRate} <= 28`),
    cessRateCheck: check("purchase_invoice_items_cess_rate_check", sql`${table.cessRate} >= 0`),
    lineTotalCheck: check("purchase_invoice_items_line_total_check", sql`${table.lineTotal} >= 0`),
    lineNumberCheck: check("purchase_invoice_items_line_number_check", sql`${table.lineNumber} > 0`)
  })
);

export const purchasePayments = pgTable(
  "purchase_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    purchaseInvoiceId: uuid("purchase_invoice_id")
      .notNull()
      .references(() => purchaseInvoices.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    paymentDate: date("payment_date", { mode: "date" }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMode: purchasePaymentModeEnum("payment_mode").notNull(),
    bankAccountId: uuid("bank_account_id").references(() => companyBankAccounts.id, { onDelete: "restrict" }),
    referenceNumber: text("reference_number"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("purchase_payments_company_id_idx").on(table.companyId),
    invoiceIdx: index("purchase_payments_purchase_invoice_id_idx").on(table.purchaseInvoiceId),
    supplierIdx: index("purchase_payments_supplier_id_idx").on(table.supplierId),
    paymentDateIdx: index("purchase_payments_payment_date_idx").on(table.paymentDate),
    amountCheck: check("purchase_payments_amount_check", sql`${table.amount} > 0`)
  })
);

export const purchaseReturns = pgTable(
  "purchase_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    returnNumber: text("return_number").notNull(),
    purchaseInvoiceId: uuid("purchase_invoice_id")
      .notNull()
      .references(() => purchaseInvoices.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    returnDate: date("return_date", { mode: "date" }).notNull(),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "restrict" }),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    gstTotal: numeric("gst_total", { precision: 14, scale: 2 }).notNull().default("0"),
    roundOffAmount: numeric("round_off_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    accountingEventCreated: boolean("accounting_event_created").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("purchase_returns_company_id_idx").on(table.companyId),
    returnDateIdx: index("purchase_returns_return_date_idx").on(table.returnDate),
    invoiceIdx: index("purchase_returns_purchase_invoice_id_idx").on(table.purchaseInvoiceId),
    supplierIdx: index("purchase_returns_supplier_id_idx").on(table.supplierId),
    companyReturnNumberUniqueIdx: uniqueIndex("purchase_returns_company_return_number_unique_idx").on(
      table.companyId,
      table.returnNumber
    ),
    subtotalCheck: check("purchase_returns_subtotal_check", sql`${table.subtotal} >= 0`),
    gstTotalCheck: check("purchase_returns_gst_total_check", sql`${table.gstTotal} >= 0`),
    grandTotalCheck: check("purchase_returns_grand_total_check", sql`${table.grandTotal} >= 0`)
  })
);

export const purchaseReturnItems = pgTable(
  "purchase_return_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    purchaseReturnId: uuid("purchase_return_id")
      .notNull()
      .references(() => purchaseReturns.id, { onDelete: "cascade" }),
    purchaseInvoiceItemId: uuid("purchase_invoice_item_id")
      .notNull()
      .references(() => purchaseInvoiceItems.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id").references(() => productBatches.id, { onDelete: "set null" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    returnRate: numeric("return_rate", { precision: 14, scale: 2 }).notNull(),
    taxableAmount: numeric("taxable_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0")
  },
  (table) => ({
    companyIdx: index("purchase_return_items_company_id_idx").on(table.companyId),
    returnIdx: index("purchase_return_items_purchase_return_id_idx").on(table.purchaseReturnId),
    invoiceItemIdx: index("purchase_return_items_purchase_invoice_item_id_idx").on(table.purchaseInvoiceItemId),
    productIdx: index("purchase_return_items_product_id_idx").on(table.productId),
    quantityCheck: check("purchase_return_items_quantity_check", sql`${table.quantity} > 0`),
    returnRateCheck: check("purchase_return_items_return_rate_check", sql`${table.returnRate} >= 0`),
    taxableAmountCheck: check("purchase_return_items_taxable_amount_check", sql`${table.taxableAmount} >= 0`),
    gstRateCheck: check("purchase_return_items_gst_rate_check", sql`${table.gstRate} >= 0 AND ${table.gstRate} <= 28`),
    gstAmountCheck: check("purchase_return_items_gst_amount_check", sql`${table.gstAmount} >= 0`),
    lineTotalCheck: check("purchase_return_items_line_total_check", sql`${table.lineTotal} >= 0`)
  })
);

export const accountingEvents = pgTable(
  "accounting_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: accountingEventStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("accounting_events_company_id_idx").on(table.companyId),
    eventTypeIdx: index("accounting_events_event_type_idx").on(table.eventType),
    referenceIdx: index("accounting_events_reference_idx").on(table.referenceType, table.referenceId)
  })
);
