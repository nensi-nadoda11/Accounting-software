DO $$
BEGIN
  CREATE TYPE "public"."gst_adjustment_type" AS ENUM('itc_reversal', 'itc_claim', 'output_tax_adjustment', 'late_fee', 'interest', 'rounding', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."gst_tax_component" AS ENUM('cgst', 'sgst', 'igst', 'cess');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."gst_adjustment_status" AS ENUM('active', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."gst_report_type" AS ENUM('sales_gst', 'purchase_gst', 'itc', 'output_tax', 'hsn_summary', 'tax_summary', 'gstr1', 'gstr3b');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."gst_itc_source_type" AS ENUM('purchase', 'expense', 'adjustment');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."gst_itc_eligibility_status" AS ENUM('eligible', 'blocked', 'reversed', 'pending');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."gst_itc_claim_status" AS ENUM('unclaimed', 'claimed', 'partially_claimed');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint

CREATE TABLE "gst_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "adjustment_number" text NOT NULL,
  "adjustment_date" date NOT NULL,
  "adjustment_type" "gst_adjustment_type" NOT NULL,
  "tax_component" "gst_tax_component" NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "reason" text NOT NULL,
  "reference_number" text,
  "notes" text,
  "status" "gst_adjustment_status" DEFAULT 'active' NOT NULL,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "gst_adjustments_amount_check" CHECK ("amount" > 0)
);--> statement-breakpoint

CREATE TABLE "gst_report_exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "report_type" "gst_report_type" NOT NULL,
  "date_from" date NOT NULL,
  "date_to" date NOT NULL,
  "filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "file_url" text,
  "exported_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "gst_report_exports_date_range_check" CHECK ("date_to" >= "date_from")
);--> statement-breakpoint

CREATE TABLE "gst_itc_status" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "source_type" "gst_itc_source_type" NOT NULL,
  "source_id" uuid NOT NULL,
  "source_number" text,
  "supplier_gstin" text,
  "invoice_date" date NOT NULL,
  "taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "cgst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "sgst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "igst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "cess_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "total_gst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "eligibility_status" "gst_itc_eligibility_status" DEFAULT 'eligible' NOT NULL,
  "claim_status" "gst_itc_claim_status" DEFAULT 'unclaimed' NOT NULL,
  "claimed_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "gst_itc_status_taxable_amount_check" CHECK ("taxable_amount" >= 0),
  CONSTRAINT "gst_itc_status_cgst_amount_check" CHECK ("cgst_amount" >= 0),
  CONSTRAINT "gst_itc_status_sgst_amount_check" CHECK ("sgst_amount" >= 0),
  CONSTRAINT "gst_itc_status_igst_amount_check" CHECK ("igst_amount" >= 0),
  CONSTRAINT "gst_itc_status_cess_amount_check" CHECK ("cess_amount" >= 0),
  CONSTRAINT "gst_itc_status_total_gst_amount_check" CHECK ("total_gst_amount" >= 0),
  CONSTRAINT "gst_itc_status_claimed_amount_check" CHECK ("claimed_amount" >= 0 AND "claimed_amount" <= "total_gst_amount")
);--> statement-breakpoint

CREATE TABLE "gst_monthly_summaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "period_month" date NOT NULL,
  "taxable_sales" numeric(14, 2) DEFAULT '0' NOT NULL,
  "output_gst" numeric(14, 2) DEFAULT '0' NOT NULL,
  "taxable_purchases" numeric(14, 2) DEFAULT '0' NOT NULL,
  "input_gst" numeric(14, 2) DEFAULT '0' NOT NULL,
  "expense_input_gst" numeric(14, 2) DEFAULT '0' NOT NULL,
  "sales_return_gst" numeric(14, 2) DEFAULT '0' NOT NULL,
  "purchase_return_gst" numeric(14, 2) DEFAULT '0' NOT NULL,
  "net_gst_payable" numeric(14, 2) DEFAULT '0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "gst_monthly_summaries_taxable_sales_check" CHECK ("taxable_sales" >= 0),
  CONSTRAINT "gst_monthly_summaries_output_gst_check" CHECK ("output_gst" >= 0),
  CONSTRAINT "gst_monthly_summaries_taxable_purchases_check" CHECK ("taxable_purchases" >= 0),
  CONSTRAINT "gst_monthly_summaries_input_gst_check" CHECK ("input_gst" >= 0),
  CONSTRAINT "gst_monthly_summaries_expense_input_gst_check" CHECK ("expense_input_gst" >= 0),
  CONSTRAINT "gst_monthly_summaries_sales_return_gst_check" CHECK ("sales_return_gst" >= 0),
  CONSTRAINT "gst_monthly_summaries_purchase_return_gst_check" CHECK ("purchase_return_gst" >= 0)
);--> statement-breakpoint

ALTER TABLE "gst_adjustments" ADD CONSTRAINT "gst_adjustments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_adjustments" ADD CONSTRAINT "gst_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_adjustments" ADD CONSTRAINT "gst_adjustments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "gst_report_exports" ADD CONSTRAINT "gst_report_exports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_report_exports" ADD CONSTRAINT "gst_report_exports_exported_by_users_id_fk" FOREIGN KEY ("exported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "gst_itc_status" ADD CONSTRAINT "gst_itc_status_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "gst_monthly_summaries" ADD CONSTRAINT "gst_monthly_summaries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "gst_adjustments_company_id_idx" ON "gst_adjustments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "gst_adjustments_adjustment_date_idx" ON "gst_adjustments" USING btree ("adjustment_date");--> statement-breakpoint
CREATE INDEX "gst_adjustments_status_idx" ON "gst_adjustments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gst_adjustments_type_idx" ON "gst_adjustments" USING btree ("adjustment_type");--> statement-breakpoint
CREATE UNIQUE INDEX "gst_adjustments_company_adjustment_number_unique_idx" ON "gst_adjustments" USING btree ("company_id","adjustment_number");--> statement-breakpoint

CREATE INDEX "gst_report_exports_company_id_idx" ON "gst_report_exports" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "gst_report_exports_report_type_idx" ON "gst_report_exports" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "gst_report_exports_created_at_idx" ON "gst_report_exports" USING btree ("created_at");--> statement-breakpoint

CREATE INDEX "gst_itc_status_company_id_idx" ON "gst_itc_status" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "gst_itc_status_source_type_source_id_idx" ON "gst_itc_status" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "gst_itc_status_eligibility_status_idx" ON "gst_itc_status" USING btree ("eligibility_status");--> statement-breakpoint
CREATE INDEX "gst_itc_status_claim_status_idx" ON "gst_itc_status" USING btree ("claim_status");--> statement-breakpoint
CREATE INDEX "gst_itc_status_invoice_date_idx" ON "gst_itc_status" USING btree ("invoice_date");--> statement-breakpoint
CREATE UNIQUE INDEX "gst_itc_status_company_source_unique_idx" ON "gst_itc_status" USING btree ("company_id","source_type","source_id");--> statement-breakpoint

CREATE INDEX "gst_monthly_summaries_company_id_idx" ON "gst_monthly_summaries" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "gst_monthly_summaries_period_month_idx" ON "gst_monthly_summaries" USING btree ("period_month");--> statement-breakpoint
CREATE UNIQUE INDEX "gst_monthly_summaries_company_period_month_unique_idx" ON "gst_monthly_summaries" USING btree ("company_id","period_month");
