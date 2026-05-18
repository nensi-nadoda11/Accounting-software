CREATE TYPE "public"."purchase_status" AS ENUM('draft', 'posted', 'cancelled', 'returned');--> statement-breakpoint
CREATE TYPE "public"."purchase_payment_status" AS ENUM('unpaid', 'partial', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."purchase_payment_mode" AS ENUM('cash', 'bank', 'upi', 'card', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."accounting_event_status" AS ENUM('pending', 'processed', 'failed', 'cancelled');--> statement-breakpoint

CREATE TABLE "purchase_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"purchase_number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_invoice_number" text,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"warehouse_id" uuid,
	"purchase_status" "purchase_status" DEFAULT 'draft' NOT NULL,
	"payment_status" "purchase_payment_status" DEFAULT 'unpaid' NOT NULL,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"item_discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"invoice_discount_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"additional_charges" numeric(14, 2) DEFAULT '0' NOT NULL,
	"freight_charges" numeric(14, 2) DEFAULT '0' NOT NULL,
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
	"payment_mode" "purchase_payment_mode",
	"payment_reference" text,
	"bank_account_id" uuid,
	"notes" text,
	"terms_conditions" text,
	"attachment_url" text,
	"accounting_event_created" boolean DEFAULT false NOT NULL,
	"posted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "purchase_invoices_subtotal_check" CHECK ("subtotal" >= 0),
	CONSTRAINT "purchase_invoices_item_discount_total_check" CHECK ("item_discount_total" >= 0),
	CONSTRAINT "purchase_invoices_invoice_discount_total_check" CHECK ("invoice_discount_total" >= 0),
	CONSTRAINT "purchase_invoices_additional_charges_check" CHECK ("additional_charges" >= 0),
	CONSTRAINT "purchase_invoices_freight_charges_check" CHECK ("freight_charges" >= 0),
	CONSTRAINT "purchase_invoices_taxable_amount_check" CHECK ("taxable_amount" >= 0),
	CONSTRAINT "purchase_invoices_cgst_total_check" CHECK ("cgst_total" >= 0),
	CONSTRAINT "purchase_invoices_sgst_total_check" CHECK ("sgst_total" >= 0),
	CONSTRAINT "purchase_invoices_igst_total_check" CHECK ("igst_total" >= 0),
	CONSTRAINT "purchase_invoices_cess_total_check" CHECK ("cess_total" >= 0),
	CONSTRAINT "purchase_invoices_gst_total_check" CHECK ("gst_total" >= 0),
	CONSTRAINT "purchase_invoices_grand_total_check" CHECK ("grand_total" >= 0),
	CONSTRAINT "purchase_invoices_paid_amount_check" CHECK ("paid_amount" >= 0),
	CONSTRAINT "purchase_invoices_due_amount_check" CHECK ("due_amount" >= 0)
);--> statement-breakpoint

CREATE TABLE "purchase_invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"purchase_invoice_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"batch_id" uuid,
	"line_number" integer NOT NULL,
	"product_name_snapshot" text NOT NULL,
	"sku_snapshot" text NOT NULL,
	"hsn_sac_snapshot" text,
	"unit_snapshot" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"free_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"purchase_rate" numeric(14, 2) NOT NULL,
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
	"manufacturing_date" date,
	"expiry_date" date,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_invoice_items_quantity_check" CHECK ("quantity" > 0),
	CONSTRAINT "purchase_invoice_items_free_quantity_check" CHECK ("free_quantity" >= 0),
	CONSTRAINT "purchase_invoice_items_purchase_rate_check" CHECK ("purchase_rate" >= 0),
	CONSTRAINT "purchase_invoice_items_discount_percent_check" CHECK ("discount_percent" >= 0 AND "discount_percent" <= 100),
	CONSTRAINT "purchase_invoice_items_discount_amount_check" CHECK ("discount_amount" >= 0),
	CONSTRAINT "purchase_invoice_items_taxable_amount_check" CHECK ("taxable_amount" >= 0),
	CONSTRAINT "purchase_invoice_items_gst_rate_check" CHECK ("gst_rate" >= 0 AND "gst_rate" <= 28),
	CONSTRAINT "purchase_invoice_items_cess_rate_check" CHECK ("cess_rate" >= 0),
	CONSTRAINT "purchase_invoice_items_line_total_check" CHECK ("line_total" >= 0),
	CONSTRAINT "purchase_invoice_items_line_number_check" CHECK ("line_number" > 0)
);--> statement-breakpoint

CREATE TABLE "purchase_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"purchase_invoice_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_mode" "purchase_payment_mode" NOT NULL,
	"bank_account_id" uuid,
	"reference_number" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_payments_amount_check" CHECK ("amount" > 0)
);--> statement-breakpoint

CREATE TABLE "purchase_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"return_number" text NOT NULL,
	"purchase_invoice_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"return_date" date NOT NULL,
	"warehouse_id" uuid,
	"subtotal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gst_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"round_off_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"accounting_event_created" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_returns_subtotal_check" CHECK ("subtotal" >= 0),
	CONSTRAINT "purchase_returns_gst_total_check" CHECK ("gst_total" >= 0),
	CONSTRAINT "purchase_returns_grand_total_check" CHECK ("grand_total" >= 0)
);--> statement-breakpoint

CREATE TABLE "purchase_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"purchase_return_id" uuid NOT NULL,
	"purchase_invoice_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" numeric(14, 3) NOT NULL,
	"return_rate" numeric(14, 2) NOT NULL,
	"taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"gst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"line_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "purchase_return_items_quantity_check" CHECK ("quantity" > 0),
	CONSTRAINT "purchase_return_items_return_rate_check" CHECK ("return_rate" >= 0),
	CONSTRAINT "purchase_return_items_taxable_amount_check" CHECK ("taxable_amount" >= 0),
	CONSTRAINT "purchase_return_items_gst_rate_check" CHECK ("gst_rate" >= 0 AND "gst_rate" <= 28),
	CONSTRAINT "purchase_return_items_gst_amount_check" CHECK ("gst_amount" >= 0),
	CONSTRAINT "purchase_return_items_line_total_check" CHECK ("line_total" >= 0)
);--> statement-breakpoint

CREATE TABLE "accounting_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "accounting_event_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_bank_account_id_company_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."company_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_purchase_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_purchase_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_bank_account_id_company_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."company_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_invoice_id_purchase_invoices_id_fk" FOREIGN KEY ("purchase_invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_purchase_return_id_purchase_returns_id_fk" FOREIGN KEY ("purchase_return_id") REFERENCES "public"."purchase_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_purchase_invoice_item_id_purchase_invoice_items_id_fk" FOREIGN KEY ("purchase_invoice_item_id") REFERENCES "public"."purchase_invoice_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "accounting_events" ADD CONSTRAINT "accounting_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "purchase_invoices_company_id_idx" ON "purchase_invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "purchase_invoices_supplier_id_idx" ON "purchase_invoices" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_invoices_invoice_date_idx" ON "purchase_invoices" USING btree ("invoice_date");--> statement-breakpoint
CREATE INDEX "purchase_invoices_payment_status_idx" ON "purchase_invoices" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "purchase_invoices_purchase_status_idx" ON "purchase_invoices" USING btree ("purchase_status");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_invoices_company_purchase_number_unique_idx" ON "purchase_invoices" USING btree ("company_id","purchase_number");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_invoices_company_supplier_supplier_invoice_unique_idx" ON "purchase_invoices" USING btree ("company_id","supplier_id","supplier_invoice_number") WHERE "supplier_invoice_number" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint

CREATE INDEX "purchase_invoice_items_company_id_idx" ON "purchase_invoice_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "purchase_invoice_items_purchase_invoice_id_idx" ON "purchase_invoice_items" USING btree ("purchase_invoice_id");--> statement-breakpoint
CREATE INDEX "purchase_invoice_items_product_id_idx" ON "purchase_invoice_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchase_invoice_items_warehouse_id_idx" ON "purchase_invoice_items" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "purchase_invoice_items_batch_id_idx" ON "purchase_invoice_items" USING btree ("batch_id");--> statement-breakpoint

CREATE INDEX "purchase_payments_company_id_idx" ON "purchase_payments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "purchase_payments_purchase_invoice_id_idx" ON "purchase_payments" USING btree ("purchase_invoice_id");--> statement-breakpoint
CREATE INDEX "purchase_payments_supplier_id_idx" ON "purchase_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_payments_payment_date_idx" ON "purchase_payments" USING btree ("payment_date");--> statement-breakpoint

CREATE INDEX "purchase_returns_company_id_idx" ON "purchase_returns" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_return_date_idx" ON "purchase_returns" USING btree ("return_date");--> statement-breakpoint
CREATE INDEX "purchase_returns_purchase_invoice_id_idx" ON "purchase_returns" USING btree ("purchase_invoice_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_supplier_id_idx" ON "purchase_returns" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_returns_company_return_number_unique_idx" ON "purchase_returns" USING btree ("company_id","return_number");--> statement-breakpoint

CREATE INDEX "purchase_return_items_company_id_idx" ON "purchase_return_items" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "purchase_return_items_purchase_return_id_idx" ON "purchase_return_items" USING btree ("purchase_return_id");--> statement-breakpoint
CREATE INDEX "purchase_return_items_purchase_invoice_item_id_idx" ON "purchase_return_items" USING btree ("purchase_invoice_item_id");--> statement-breakpoint
CREATE INDEX "purchase_return_items_product_id_idx" ON "purchase_return_items" USING btree ("product_id");--> statement-breakpoint

CREATE INDEX "accounting_events_company_id_idx" ON "accounting_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "accounting_events_event_type_idx" ON "accounting_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "accounting_events_reference_idx" ON "accounting_events" USING btree ("reference_type","reference_id");--> statement-breakpoint
