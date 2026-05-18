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
import { customers } from "./customers";
import { productBatches, warehouses } from "./inventory";
import { products, productPriceTaxTypeEnum } from "./products";
import { users } from "./users";

export const salesInvoiceTypeEnum = pgEnum("sales_invoice_type", ["gst_invoice", "pos"]);
export const salesInvoiceStatusEnum = pgEnum("sales_invoice_status", [
  "draft",
  "posted",
  "cancelled",
  "returned",
  "partially_returned"
]);
export const salesPaymentStatusEnum = pgEnum("sales_payment_status", ["unpaid", "partial", "paid", "overdue"]);
export const salesPaymentModeEnum = pgEnum("sales_payment_mode", ["cash", "bank", "upi", "card", "cheque"]);
export const salesSendChannelEnum = pgEnum("sales_send_channel", ["email", "whatsapp"]);
export const salesSendStatusEnum = pgEnum("sales_send_status", ["pending", "sent", "failed"]);

export const salesInvoices = pgTable(
  "sales_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceType: salesInvoiceTypeEnum("invoice_type").notNull().default("gst_invoice"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    isWalkIn: boolean("is_walk_in").notNull().default(false),
    walkInName: text("walk_in_name"),
    walkInMobile: text("walk_in_mobile"),
    customerNameSnapshot: text("customer_name_snapshot").notNull(),
    customerGstSnapshot: text("customer_gst_snapshot"),
    customerPanSnapshot: text("customer_pan_snapshot"),
    billingAddressSnapshot: jsonb("billing_address_snapshot").$type<Record<string, string | null>>(),
    shippingAddressSnapshot: jsonb("shipping_address_snapshot").$type<Record<string, string | null>>(),
    invoiceDate: date("invoice_date", { mode: "date" }).notNull(),
    dueDate: date("due_date", { mode: "date" }),
    placeOfSupply: text("place_of_supply").notNull(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    priceTaxType: productPriceTaxTypeEnum("price_tax_type").notNull().default("exclusive"),
    invoiceStatus: salesInvoiceStatusEnum("invoice_status").notNull().default("draft"),
    paymentStatus: salesPaymentStatusEnum("payment_status").notNull().default("unpaid"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    itemDiscountTotal: numeric("item_discount_total", { precision: 14, scale: 2 }).notNull().default("0"),
    invoiceDiscountTotal: numeric("invoice_discount_total", { precision: 14, scale: 2 }).notNull().default("0"),
    deliveryCharges: numeric("delivery_charges", { precision: 14, scale: 2 }).notNull().default("0"),
    packingCharges: numeric("packing_charges", { precision: 14, scale: 2 }).notNull().default("0"),
    otherCharges: numeric("other_charges", { precision: 14, scale: 2 }).notNull().default("0"),
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
    paymentMode: salesPaymentModeEnum("payment_mode"),
    paymentReference: text("payment_reference"),
    bankAccountId: uuid("bank_account_id").references(() => companyBankAccounts.id, { onDelete: "restrict" }),
    notes: text("notes"),
    termsConditions: text("terms_conditions"),
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
    companyIdx: index("sales_invoices_company_id_idx").on(table.companyId),
    customerIdx: index("sales_invoices_customer_id_idx").on(table.customerId),
    invoiceDateIdx: index("sales_invoices_invoice_date_idx").on(table.invoiceDate),
    invoiceStatusIdx: index("sales_invoices_invoice_status_idx").on(table.invoiceStatus),
    paymentStatusIdx: index("sales_invoices_payment_status_idx").on(table.paymentStatus),
    companyInvoiceNumberUniqueIdx: uniqueIndex("sales_invoices_company_invoice_number_unique_idx").on(
      table.companyId,
      table.invoiceNumber
    ),
    subtotalCheck: check("sales_invoices_subtotal_check", sql`${table.subtotal} >= 0`),
    itemDiscountCheck: check("sales_invoices_item_discount_total_check", sql`${table.itemDiscountTotal} >= 0`),
    invoiceDiscountCheck: check("sales_invoices_invoice_discount_total_check", sql`${table.invoiceDiscountTotal} >= 0`),
    deliveryChargesCheck: check("sales_invoices_delivery_charges_check", sql`${table.deliveryCharges} >= 0`),
    packingChargesCheck: check("sales_invoices_packing_charges_check", sql`${table.packingCharges} >= 0`),
    otherChargesCheck: check("sales_invoices_other_charges_check", sql`${table.otherCharges} >= 0`),
    taxableAmountCheck: check("sales_invoices_taxable_amount_check", sql`${table.taxableAmount} >= 0`),
    cgstCheck: check("sales_invoices_cgst_total_check", sql`${table.cgstTotal} >= 0`),
    sgstCheck: check("sales_invoices_sgst_total_check", sql`${table.sgstTotal} >= 0`),
    igstCheck: check("sales_invoices_igst_total_check", sql`${table.igstTotal} >= 0`),
    cessCheck: check("sales_invoices_cess_total_check", sql`${table.cessTotal} >= 0`),
    gstCheck: check("sales_invoices_gst_total_check", sql`${table.gstTotal} >= 0`),
    grandTotalCheck: check("sales_invoices_grand_total_check", sql`${table.grandTotal} >= 0`),
    paidAmountCheck: check("sales_invoices_paid_amount_check", sql`${table.paidAmount} >= 0`),
    dueAmountCheck: check("sales_invoices_due_amount_check", sql`${table.dueAmount} >= 0`)
  })
);

export const salesInvoiceItems = pgTable(
  "sales_invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
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
    saleRate: numeric("sale_rate", { precision: 14, scale: 2 }).notNull(),
    mrp: numeric("mrp", { precision: 14, scale: 2 }).notNull().default("0"),
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
    returnedQuantity: numeric("returned_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("sales_invoice_items_company_id_idx").on(table.companyId),
    invoiceIdx: index("sales_invoice_items_sales_invoice_id_idx").on(table.salesInvoiceId),
    productIdx: index("sales_invoice_items_product_id_idx").on(table.productId),
    warehouseIdx: index("sales_invoice_items_warehouse_id_idx").on(table.warehouseId),
    batchIdx: index("sales_invoice_items_batch_id_idx").on(table.batchId),
    quantityCheck: check("sales_invoice_items_quantity_check", sql`${table.quantity} > 0`),
    saleRateCheck: check("sales_invoice_items_sale_rate_check", sql`${table.saleRate} >= 0`),
    mrpCheck: check("sales_invoice_items_mrp_check", sql`${table.mrp} >= 0`),
    discountPercentCheck: check(
      "sales_invoice_items_discount_percent_check",
      sql`${table.discountPercent} >= 0 AND ${table.discountPercent} <= 100`
    ),
    discountAmountCheck: check("sales_invoice_items_discount_amount_check", sql`${table.discountAmount} >= 0`),
    taxableAmountCheck: check("sales_invoice_items_taxable_amount_check", sql`${table.taxableAmount} >= 0`),
    gstRateCheck: check("sales_invoice_items_gst_rate_check", sql`${table.gstRate} >= 0 AND ${table.gstRate} <= 28`),
    cessRateCheck: check("sales_invoice_items_cess_rate_check", sql`${table.cessRate} >= 0`),
    lineTotalCheck: check("sales_invoice_items_line_total_check", sql`${table.lineTotal} >= 0`),
    returnedQuantityCheck: check("sales_invoice_items_returned_quantity_check", sql`${table.returnedQuantity} >= 0`),
    lineNumberCheck: check("sales_invoice_items_line_number_check", sql`${table.lineNumber} > 0`)
  })
);

export const salesPayments = pgTable(
  "sales_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    paymentDate: date("payment_date", { mode: "date" }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMode: salesPaymentModeEnum("payment_mode").notNull(),
    bankAccountId: uuid("bank_account_id").references(() => companyBankAccounts.id, { onDelete: "restrict" }),
    referenceNumber: text("reference_number"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("sales_payments_company_id_idx").on(table.companyId),
    invoiceIdx: index("sales_payments_sales_invoice_id_idx").on(table.salesInvoiceId),
    customerIdx: index("sales_payments_customer_id_idx").on(table.customerId),
    paymentDateIdx: index("sales_payments_payment_date_idx").on(table.paymentDate),
    amountCheck: check("sales_payments_amount_check", sql`${table.amount} > 0`)
  })
);

export const salesReturns = pgTable(
  "sales_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    returnNumber: text("return_number").notNull(),
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    returnDate: date("return_date", { mode: "date" }).notNull(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    gstTotal: numeric("gst_total", { precision: 14, scale: 2 }).notNull().default("0"),
    roundOffAmount: numeric("round_off_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 14, scale: 2 }).notNull().default("0"),
    reason: text("reason").notNull(),
    notes: text("notes"),
    accountingEventCreated: boolean("accounting_event_created").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("sales_returns_company_id_idx").on(table.companyId),
    returnDateIdx: index("sales_returns_return_date_idx").on(table.returnDate),
    invoiceIdx: index("sales_returns_sales_invoice_id_idx").on(table.salesInvoiceId),
    customerIdx: index("sales_returns_customer_id_idx").on(table.customerId),
    companyReturnNumberUniqueIdx: uniqueIndex("sales_returns_company_return_number_unique_idx").on(
      table.companyId,
      table.returnNumber
    ),
    subtotalCheck: check("sales_returns_subtotal_check", sql`${table.subtotal} >= 0`),
    gstTotalCheck: check("sales_returns_gst_total_check", sql`${table.gstTotal} >= 0`),
    grandTotalCheck: check("sales_returns_grand_total_check", sql`${table.grandTotal} >= 0`)
  })
);

export const salesReturnItems = pgTable(
  "sales_return_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    salesReturnId: uuid("sales_return_id")
      .notNull()
      .references(() => salesReturns.id, { onDelete: "cascade" }),
    salesInvoiceItemId: uuid("sales_invoice_item_id")
      .notNull()
      .references(() => salesInvoiceItems.id, { onDelete: "restrict" }),
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
    companyIdx: index("sales_return_items_company_id_idx").on(table.companyId),
    returnIdx: index("sales_return_items_sales_return_id_idx").on(table.salesReturnId),
    invoiceItemIdx: index("sales_return_items_sales_invoice_item_id_idx").on(table.salesInvoiceItemId),
    productIdx: index("sales_return_items_product_id_idx").on(table.productId),
    quantityCheck: check("sales_return_items_quantity_check", sql`${table.quantity} > 0`),
    returnRateCheck: check("sales_return_items_return_rate_check", sql`${table.returnRate} >= 0`),
    taxableAmountCheck: check("sales_return_items_taxable_amount_check", sql`${table.taxableAmount} >= 0`),
    gstRateCheck: check("sales_return_items_gst_rate_check", sql`${table.gstRate} >= 0 AND ${table.gstRate} <= 28`),
    gstAmountCheck: check("sales_return_items_gst_amount_check", sql`${table.gstAmount} >= 0`),
    lineTotalCheck: check("sales_return_items_line_total_check", sql`${table.lineTotal} >= 0`)
  })
);

export const salesInvoiceSendLogs = pgTable(
  "sales_invoice_send_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    salesInvoiceId: uuid("sales_invoice_id")
      .notNull()
      .references(() => salesInvoices.id, { onDelete: "cascade" }),
    channel: salesSendChannelEnum("channel").notNull(),
    sentTo: text("sent_to").notNull(),
    status: salesSendStatusEnum("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("sales_invoice_send_logs_company_id_idx").on(table.companyId),
    invoiceIdx: index("sales_invoice_send_logs_sales_invoice_id_idx").on(table.salesInvoiceId),
    channelIdx: index("sales_invoice_send_logs_channel_idx").on(table.channel),
    statusIdx: index("sales_invoice_send_logs_status_idx").on(table.status)
  })
);
