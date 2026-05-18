DO $$
BEGIN
  CREATE TYPE "public"."payment_mode" AS ENUM('cash', 'bank', 'upi', 'card', 'cheque', 'neft', 'rtgs', 'imps', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'cash';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'bank';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'upi';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'card';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'cheque';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'neft';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'rtgs';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'imps';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE IF NOT EXISTS 'other';--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."cheque_status" AS ENUM('received', 'issued', 'deposited', 'cleared', 'bounced', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
ALTER TYPE "public"."cheque_status" ADD VALUE IF NOT EXISTS 'received';--> statement-breakpoint
ALTER TYPE "public"."cheque_status" ADD VALUE IF NOT EXISTS 'issued';--> statement-breakpoint
ALTER TYPE "public"."cheque_status" ADD VALUE IF NOT EXISTS 'deposited';--> statement-breakpoint
ALTER TYPE "public"."cheque_status" ADD VALUE IF NOT EXISTS 'cleared';--> statement-breakpoint
ALTER TYPE "public"."cheque_status" ADD VALUE IF NOT EXISTS 'bounced';--> statement-breakpoint
ALTER TYPE "public"."cheque_status" ADD VALUE IF NOT EXISTS 'cancelled';--> statement-breakpoint
CREATE TYPE "public"."expense_category_status" AS ENUM('active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('draft', 'posted', 'approved', 'cancelled', 'recurring_generated');--> statement-breakpoint
CREATE TYPE "public"."recurring_expense_frequency" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."recurring_expense_status" AS ENUM('active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."recurring_expense_create_status" AS ENUM('draft', 'posted');--> statement-breakpoint
CREATE TABLE "expense_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "category_code" text NOT NULL,
  "name" text NOT NULL,
  "parent_id" uuid,
  "default_account_id" uuid,
  "color" text,
  "icon" text,
  "description" text,
  "status" "expense_category_status" DEFAULT 'active' NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "recurring_expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "template_name" text NOT NULL,
  "category_id" uuid NOT NULL,
  "expense_account_id" uuid,
  "payee_name" text,
  "description" text NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "gst_applicable" boolean DEFAULT false NOT NULL,
  "gst_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
  "price_tax_type" "product_price_tax_type" NOT NULL,
  "payment_mode" "payment_mode" NOT NULL,
  "bank_account_id" uuid,
  "frequency" "recurring_expense_frequency" NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date,
  "next_run_date" date NOT NULL,
  "auto_create_enabled" boolean DEFAULT true NOT NULL,
  "create_as_status" "recurring_expense_create_status" DEFAULT 'draft' NOT NULL,
  "reminder_days_before" integer DEFAULT 0 NOT NULL,
  "last_run_at" timestamp with time zone,
  "status" "recurring_expense_status" DEFAULT 'active' NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "recurring_expenses_reminder_days_check" CHECK ("reminder_days_before" >= 0),
  CONSTRAINT "recurring_expenses_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "recurring_expenses_gst_rate_check" CHECK ("gst_rate" >= 0 AND "gst_rate" <= 28),
  CONSTRAINT "recurring_expenses_end_date_check" CHECK ("end_date" IS NULL OR "end_date" >= "start_date")
);--> statement-breakpoint
CREATE TABLE "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "expense_number" text NOT NULL,
  "expense_date" date NOT NULL,
  "category_id" uuid NOT NULL,
  "expense_account_id" uuid,
  "payee_name" text,
  "vendor_gst_number" text,
  "vendor_pan_number" text,
  "hsn_sac_code" text,
  "description" text NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "gst_applicable" boolean DEFAULT false NOT NULL,
  "gst_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
  "price_tax_type" "product_price_tax_type" NOT NULL,
  "taxable_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "cgst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "sgst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "igst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "gst_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "total_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "payment_mode" "payment_mode" NOT NULL,
  "bank_account_id" uuid,
  "reference_number" text,
  "cheque_number" text,
  "cheque_date" date,
  "cheque_status" "cheque_status",
  "status" "expense_status" DEFAULT 'draft' NOT NULL,
  "recurring_expense_id" uuid,
  "accounting_event_created" boolean DEFAULT false NOT NULL,
  "posted_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text,
  "notes" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "expenses_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "expenses_gst_rate_check" CHECK ("gst_rate" >= 0 AND "gst_rate" <= 28),
  CONSTRAINT "expenses_taxable_amount_check" CHECK ("taxable_amount" >= 0),
  CONSTRAINT "expenses_cgst_amount_check" CHECK ("cgst_amount" >= 0),
  CONSTRAINT "expenses_sgst_amount_check" CHECK ("sgst_amount" >= 0),
  CONSTRAINT "expenses_igst_amount_check" CHECK ("igst_amount" >= 0),
  CONSTRAINT "expenses_gst_amount_check" CHECK ("gst_amount" >= 0),
  CONSTRAINT "expenses_total_amount_check" CHECK ("total_amount" >= 0)
);--> statement-breakpoint
CREATE TABLE "expense_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "expense_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "original_name" text NOT NULL,
  "file_url" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "uploaded_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "expense_attachments_size_bytes_check" CHECK ("size_bytes" > 0)
);--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_parent_id_expense_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_default_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_expense_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_bank_account_id_company_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."company_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_expense_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("expense_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bank_account_id_company_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."company_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_expense_id_recurring_expenses_id_fk" FOREIGN KEY ("recurring_expense_id") REFERENCES "public"."recurring_expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_attachments" ADD CONSTRAINT "expense_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_categories_company_status_parent_idx" ON "expense_categories" USING btree ("company_id","status","parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_company_category_code_unique_idx" ON "expense_categories" USING btree ("company_id","category_code");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_company_name_unique_idx" ON "expense_categories" USING btree ("company_id","name") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "recurring_expenses_company_status_idx" ON "recurring_expenses" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "recurring_expenses_company_next_run_idx" ON "recurring_expenses" USING btree ("company_id","next_run_date");--> statement-breakpoint
CREATE INDEX "recurring_expenses_category_id_idx" ON "recurring_expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "expenses_company_id_idx" ON "expenses" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expenses_company_expense_number_unique_idx" ON "expenses" USING btree ("company_id","expense_number");--> statement-breakpoint
CREATE INDEX "expenses_expense_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "expenses_category_id_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "expenses_payment_mode_idx" ON "expenses" USING btree ("payment_mode");--> statement-breakpoint
CREATE INDEX "expenses_status_idx" ON "expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "expenses_recurring_expense_id_idx" ON "expenses" USING btree ("recurring_expense_id");--> statement-breakpoint
CREATE INDEX "expense_attachments_company_expense_idx" ON "expense_attachments" USING btree ("company_id","expense_id");--> statement-breakpoint
CREATE INDEX "expense_attachments_company_created_idx" ON "expense_attachments" USING btree ("company_id","created_at");--> statement-breakpoint
