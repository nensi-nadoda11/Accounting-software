CREATE TYPE "public"."sales_invoice_type" AS ENUM('gst_invoice', 'pos');--> statement-breakpoint
CREATE TYPE "public"."sales_invoice_status" AS ENUM('draft', 'posted', 'cancelled', 'returned', 'partially_returned');--> statement-breakpoint
CREATE TYPE "public"."sales_payment_status" AS ENUM('unpaid', 'partial', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."sales_payment_mode" AS ENUM('cash', 'bank', 'upi', 'card', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."sales_send_channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."sales_send_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint

CREATE TABLE "sales_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_type" "sales_invoice_type" DEFAULT 'gst_invoice' NOT NULL,
	"customer_id" uuid,
	"is_walk_in" boolean DEFAULT false NOT NULL,
	"walk_in_name" text,
	"walk_in_mobile" text,
	"customer_name_snapshot" text NOT NULL,
	"customer_gst_snapshot" text,
	"customer_pan_snapshot" text,
	"billing_address_snapshot" jsonb,
	"shipping_address_snapshot" jsonb,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"place_of_supply" text NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"price_tax_type" "product_price_tax_type" DEFAULT 'exclusive' NOT NULL,
	"invoice_status" "sales_invoice_status" DEFAULT 'draft' NOT NULL,
	"payment_status" "sales_payment_status" DEFAULT 'unpaid' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"item_discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"invoice_discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"delivery_charges" numeric(14, 2) DEFAULT '0' NOT NULL,
	"packing_charges" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_charges" numeric(14, 2) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cgst_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sgst_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"igst_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cess_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gst_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"round_off_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"due_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"payment_mode" "sales_payment_mode",
	"payment_reference" text,
	"bank_account_id" uuid,
	"notes" text,
	"terms_conditions" text,
	"accounting_event_created" boolean DEFAULT false NOT NULL,
	"posted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sales_invoices_subtotal_check" CHECK ("subtotal" >= 0),
	CONSTRAINT "sales_invoices_item_discount_total_check" CHECK ("item_discount_total" >= 0),
	CONSTRAINT "sales_invoices_invoice_discount_total_check" CHECK ("invoice_discount_total" >= 0),
	CONSTRAINT "sales_invoices_delivery_charges_check" CHECK ("delivery_charges" >= 0),
	CONSTRAINT "sales_invoices_packing_charges_check" CHECK ("packing_charges" >= 0),
	CONSTRAINT "sales_invoices_other_charges_check" CHECK ("other_charges" >= 0),
	CONSTRAINT "sales_invoices_taxable_amount_check" CHECK ("taxable_amount" >= 0),
	CONSTRAINT "sales_invoices_cgst_total_check" CHECK ("cgst_total" >= 0),
	CONSTRAINT "sales_invoices_sgst_total_check" CHECK ("sgst_total" >= 0),
	CONSTRAINT "sales_invoices_igst_total_check" CHECK ("igst_total" >= 0),
	CONSTRAINT "sales_invoices_cess_total_check" CHECK ("cess_total" >= 0),
	CONSTRAINT "sales_invoices_gst_total_check" CHECK ("gst_total" >= 0),
	CONSTRAINT "sales_invoices_grand_total_check" CHECK ("grand_total" >= 0),
	CONSTRAINT "sales_invoices_paid_amount_check" CHECK ("paid_amount" >= 0),
	CONSTRAINT "sales_invoices_due_amount_check" CHECK ("due_amount" >= 0)
);--> statement-breakpoint

CREATE TABLE "sales_invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"batch_id" uuid,
	"line_number" integer NOT NULL,
	"product_name_snapshot" text NOT NULL,
	"sku_snapshot" text NOT NULL,
	"hsn_sac_snapshot" text,
	"unit_snapshot" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"sale_rate" numeric(14, 2) NOT NULL,
	"mrp" numeric(14, 2) DEFAULT '0' NOT NULL,
	"price_tax_type" "product_price_tax_type" NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"cgst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sgst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"igst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cess_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"cess_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"returned_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_invoice_items_quantity_check" CHECK ("quantity" > 0),
	CONSTRAINT "sales_invoice_items_sale_rate_check" CHECK ("sale_rate" >= 0),
	CONSTRAINT "sales_invoice_items_mrp_check" CHECK ("mrp" >= 0),
	CONSTRAINT "sales_invoice_items_discount_percent_check" CHECK ("discount_percent" >= 0 AND "discount_percent" <= 100),
	CONSTRAINT "sales_invoice_items_discount_amount_check" CHECK ("discount_amount" >= 0),
	CONSTRAINT "sales_invoice_items_taxable_amount_check" CHECK ("taxable_amount" >= 0),
	CONSTRAINT "sales_invoice_items_gst_rate_check" CHECK ("gst_rate" >= 0 AND "gst_rate" <= 28),
	CONSTRAINT "sales_invoice_items_cess_rate_check" CHECK ("cess_rate" >= 0),
	CONSTRAINT "sales_invoice_items_line_total_check" CHECK ("line_total" >= 0),
	CONSTRAINT "sales_invoice_items_returned_quantity_check" CHECK ("returned_quantity" >= 0),
	CONSTRAINT "sales_invoice_items_line_number_check" CHECK ("line_number" > 0)
);--> statement-breakpoint

CREATE TABLE "sales_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"customer_id" uuid,
	"payment_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_mode" "sales_payment_mode" NOT NULL,
	"bank_account_id" uuid,
	"reference_number" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_payments_amount_check" CHECK ("amount" > 0)
);--> statement-breakpoint

CREATE TABLE "sales_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"return_number" text NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"customer_id" uuid,
	"return_date" date NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gst_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"round_off_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"accounting_event_created" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_returns_subtotal_check" CHECK ("subtotal" >= 0),
	CONSTRAINT "sales_returns_gst_total_check" CHECK ("gst_total" >= 0),
	CONSTRAINT "sales_returns_grand_total_check" CHECK ("grand_total" >= 0)
);--> statement-breakpoint

CREATE TABLE "sales_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_return_id" uuid NOT NULL,
	"sales_invoice_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" numeric(14, 3) NOT NULL,
	"return_rate" numeric(14, 2) NOT NULL,
	"taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "sales_return_items_quantity_check" CHECK ("quantity" > 0),
	CONSTRAINT "sales_return_items_return_rate_check" CHECK ("return_rate" >= 0),
	CONSTRAINT "sales_return_items_taxable_amount_check" CHECK ("taxable_amount" >= 0),
	CONSTRAINT "sales_return_items_gst_rate_check" CHECK ("gst_rate" >= 0 AND "gst_rate" <= 28),
	CONSTRAINT "sales_return_items_gst_amount_check" CHECK ("gst_amount" >= 0),
	CONSTRAINT "sales_return_items_line_total_check" CHECK ("line_total" >= 0)
);--> statement-breakpoint

CREATE TABLE "sales_invoice_send_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"channel" "sales_send_channel" NOT NULL,
	"sent_to" text NOT NULL,
	"status" "sales_send_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_bank_account_id_company_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."company_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_sales_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_sales_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_bank_account_id_company_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."company_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_payments" ADD CONSTRAINT "sales_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_sales_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_sales_return_id_sales_returns_id_fk" FOREIGN KEY ("sales_return_id") REFERENCES "public"."sales_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_sales_invoice_item_id_sales_invoice_items_id_fk" FOREIGN KEY ("sales_invoice_item_id") REFERENCES "public"."sales_invoice_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "sales_invoice_send_logs" ADD CONSTRAINT "sales_invoice_send_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_send_logs" ADD CONSTRAINT "sales_invoice_send_logs_sales_invoice_id_sales_invoices_id_fk" FOREIGN KEY ("sales_invoice_id") REFERENCES "public"."sales_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_send_logs" ADD CONSTRAINT "sales_invoice_send_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "sales_invoices_company_id_idx" ON "sales_invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_customer_id_idx" ON "sales_invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_invoices_invoice_date_idx" ON "sales_invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "sales_invoices_invoice_status_idx" ON "sales_invoices" USING btree ("invoice_status");--> statement-breakpoint
CREATE INDEX "sales_invoices_payment_status_idx" ON "sales_invoices" USING btree ("payment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_invoices_company_invoice_number_unique_idx" ON "sales_invoices" USING btree ("company_id","invoice_number");--> statement-breakpoint

CREATE INDEX "sales_invoice_items_company_id_idx" ON "sales_invoice_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sales_invoice_items_sales_invoice_id_idx" ON "sales_invoice_items" USING btree ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "sales_invoice_items_product_id_idx" ON "sales_invoice_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sales_invoice_items_warehouse_id_idx" ON "sales_invoice_items" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "sales_invoice_items_batch_id_idx" ON "sales_invoice_items" USING btree ("batch_id");--> statement-breakpoint

CREATE INDEX "sales_payments_company_id_idx" ON "sales_payments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sales_payments_sales_invoice_id_idx" ON "sales_payments" USING btree ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "sales_payments_customer_id_idx" ON "sales_payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_payments_payment_date_idx" ON "sales_payments" USING btree ("payment_date");--> statement-breakpoint

CREATE INDEX "sales_returns_company_id_idx" ON "sales_returns" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sales_returns_return_date_idx" ON "sales_returns" USING btree ("return_date");--> statement-breakpoint
CREATE INDEX "sales_returns_sales_invoice_id_idx" ON "sales_returns" USING btree ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "sales_returns_customer_id_idx" ON "sales_returns" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_returns_company_return_number_unique_idx" ON "sales_returns" USING btree ("company_id","return_number");--> statement-breakpoint

CREATE INDEX "sales_return_items_company_id_idx" ON "sales_return_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sales_return_items_sales_return_id_idx" ON "sales_return_items" USING btree ("sales_return_id");--> statement-breakpoint
CREATE INDEX "sales_return_items_sales_invoice_item_id_idx" ON "sales_return_items" USING btree ("sales_invoice_item_id");--> statement-breakpoint
CREATE INDEX "sales_return_items_product_id_idx" ON "sales_return_items" USING btree ("product_id");--> statement-breakpoint

CREATE INDEX "sales_invoice_send_logs_company_id_idx" ON "sales_invoice_send_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sales_invoice_send_logs_sales_invoice_id_idx" ON "sales_invoice_send_logs" USING btree ("sales_invoice_id");--> statement-breakpoint
CREATE INDEX "sales_invoice_send_logs_channel_idx" ON "sales_invoice_send_logs" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "sales_invoice_send_logs_status_idx" ON "sales_invoice_send_logs" USING btree ("status");--> statement-breakpoint
