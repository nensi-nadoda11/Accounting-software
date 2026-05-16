CREATE TYPE "public"."company_gst_type" AS ENUM('regular', 'composition', 'unregistered');--> statement-breakpoint
CREATE TYPE "public"."company_gst_filing_frequency" AS ENUM('monthly', 'quarterly', 'annually');--> statement-breakpoint
CREATE TYPE "public"."company_bank_account_type" AS ENUM('current', 'savings', 'cash_credit', 'overdraft', 'other');--> statement-breakpoint
CREATE TYPE "public"."company_invoice_tax_display_format" AS ENUM('item_wise', 'summary', 'both');--> statement-breakpoint
CREATE TYPE "public"."company_invoice_template" AS ENUM('gst_a4', 'pos', 'thermal');--> statement-breakpoint

ALTER TABLE "companies" RENAME COLUMN "address_line_1" TO "address_line1";--> statement-breakpoint
ALTER TABLE "companies" RENAME COLUMN "address_line_2" TO "address_line2";--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "industry_type" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "pan_number" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "cin_number" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "mobile_number" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "pincode" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "country" text DEFAULT 'India' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "timezone" text DEFAULT 'Asia/Kolkata' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "setup_completed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "companies_gst_number_idx" ON "companies" USING btree ("gst_number");--> statement-breakpoint
CREATE INDEX "companies_status_idx" ON "companies" USING btree ("status");--> statement-breakpoint

CREATE TABLE "company_tax_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"gst_enabled" boolean DEFAULT false NOT NULL,
	"gst_type" "company_gst_type" DEFAULT 'unregistered' NOT NULL,
	"composition_scheme" boolean DEFAULT false NOT NULL,
	"tax_inclusive_pricing" boolean DEFAULT false NOT NULL,
	"default_gst_rate" numeric(5, 2),
	"hsn_sac_enabled" boolean DEFAULT false NOT NULL,
	"e_invoice_enabled" boolean DEFAULT false NOT NULL,
	"e_way_bill_enabled" boolean DEFAULT false NOT NULL,
	"gst_filing_frequency" "company_gst_filing_frequency" DEFAULT 'monthly' NOT NULL,
	"tan_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_tax_settings" ADD CONSTRAINT "company_tax_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_tax_settings_company_id_unique_idx" ON "company_tax_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_tax_settings_company_id_idx" ON "company_tax_settings" USING btree ("company_id");--> statement-breakpoint

CREATE TABLE "company_financial_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_financial_years_date_check" CHECK ("end_date" > "start_date")
);
--> statement-breakpoint
ALTER TABLE "company_financial_years" ADD CONSTRAINT "company_financial_years_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_financial_years_company_id_idx" ON "company_financial_years" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_financial_years_company_active_idx" ON "company_financial_years" USING btree ("company_id", "is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "company_financial_years_active_company_unique_idx" ON "company_financial_years" USING btree ("company_id") WHERE "is_active" = true;--> statement-breakpoint

CREATE TABLE "company_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_holder_name" text NOT NULL,
	"account_number" text NOT NULL,
	"ifsc_code" text NOT NULL,
	"branch_name" text,
	"upi_id" text,
	"qr_image_url" text,
	"opening_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"account_type" "company_bank_account_type" DEFAULT 'current' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "company_bank_accounts" ADD CONSTRAINT "company_bank_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_bank_accounts_company_id_idx" ON "company_bank_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_bank_accounts_company_active_idx" ON "company_bank_accounts" USING btree ("company_id", "is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "company_bank_accounts_default_active_unique_idx" ON "company_bank_accounts" USING btree ("company_id") WHERE "is_default" = true AND "is_active" = true AND "deleted_at" IS NULL;--> statement-breakpoint

CREATE TABLE "company_invoice_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"purchase_invoice_prefix" text DEFAULT 'PUR' NOT NULL,
	"credit_note_prefix" text DEFAULT 'CN' NOT NULL,
	"debit_note_prefix" text DEFAULT 'DN' NOT NULL,
	"auto_numbering" boolean DEFAULT true NOT NULL,
	"next_sales_invoice_number" integer DEFAULT 1 NOT NULL,
	"next_purchase_invoice_number" integer DEFAULT 1 NOT NULL,
	"number_padding" integer DEFAULT 4 NOT NULL,
	"terms_and_conditions" text,
	"footer_note" text,
	"show_company_logo" boolean DEFAULT true NOT NULL,
	"show_bank_details" boolean DEFAULT true NOT NULL,
	"show_qr_code" boolean DEFAULT false NOT NULL,
	"show_signature" boolean DEFAULT false NOT NULL,
	"round_off_enabled" boolean DEFAULT true NOT NULL,
	"decimal_precision" integer DEFAULT 2 NOT NULL,
	"tax_display_format" "company_invoice_tax_display_format" DEFAULT 'both' NOT NULL,
	"invoice_template" "company_invoice_template" DEFAULT 'gst_a4' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_invoice_settings" ADD CONSTRAINT "company_invoice_settings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_invoice_settings_company_id_unique_idx" ON "company_invoice_settings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_invoice_settings_company_id_idx" ON "company_invoice_settings" USING btree ("company_id");--> statement-breakpoint

CREATE TABLE "company_branding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"logo_url" text,
	"invoice_logo_url" text,
	"signature_url" text,
	"stamp_url" text,
	"favicon_url" text,
	"primary_color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_branding" ADD CONSTRAINT "company_branding_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_branding_company_id_unique_idx" ON "company_branding" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_branding_company_id_idx" ON "company_branding" USING btree ("company_id");--> statement-breakpoint

CREATE TABLE "company_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_name" text NOT NULL,
	"branch_code" text NOT NULL,
	"gst_number" text,
	"email" text,
	"mobile_number" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"pincode" text,
	"manager_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "company_branches" ADD CONSTRAINT "company_branches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_branches_company_id_idx" ON "company_branches" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_branches_company_branch_code_idx" ON "company_branches" USING btree ("company_id", "branch_code");--> statement-breakpoint
CREATE INDEX "company_branches_company_active_idx" ON "company_branches" USING btree ("company_id", "is_active");--> statement-breakpoint
CREATE INDEX "company_branches_gst_number_idx" ON "company_branches" USING btree ("gst_number");--> statement-breakpoint
CREATE UNIQUE INDEX "company_branches_company_branch_code_unique_idx" ON "company_branches" USING btree ("company_id", "branch_code") WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE TABLE "company_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"date_format" text DEFAULT 'DD/MM/YYYY' NOT NULL,
	"currency_format" text DEFAULT 'symbol_first' NOT NULL,
	"number_format" text DEFAULT 'indian' NOT NULL,
	"decimal_precision" integer DEFAULT 2 NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"auto_logout_minutes" integer DEFAULT 30 NOT NULL,
	"notification_email_enabled" boolean DEFAULT true NOT NULL,
	"notification_sms_enabled" boolean DEFAULT false NOT NULL,
	"notification_whatsapp_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_preferences" ADD CONSTRAINT "company_preferences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_preferences_company_id_unique_idx" ON "company_preferences" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_preferences_company_id_idx" ON "company_preferences" USING btree ("company_id");--> statement-breakpoint
