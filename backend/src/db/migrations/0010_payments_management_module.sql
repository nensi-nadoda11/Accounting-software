DO $$
BEGIN
  CREATE TYPE "public"."payment_type" AS ENUM('customer_receive', 'supplier_pay');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payment_party_type" AS ENUM('customer', 'supplier');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
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
  CREATE TYPE "public"."payment_status" AS ENUM('draft', 'completed', 'cancelled', 'bounced', 'reversed');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payment_allocation_type" AS ENUM('sales_invoice', 'purchase_invoice', 'advance_adjustment');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payment_receipt_type" AS ENUM('customer_receipt', 'supplier_voucher');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payment_reminder_reference_type" AS ENUM('sales_invoice', 'purchase_invoice', 'advance', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payment_reminder_channel" AS ENUM('in_app', 'email', 'whatsapp');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payment_reminder_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
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

CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "payment_number" text NOT NULL,
  "payment_type" "payment_type" NOT NULL,
  "party_type" "payment_party_type" NOT NULL,
  "party_id" uuid NOT NULL,
  "payment_date" date NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "allocated_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "unallocated_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "payment_mode" "payment_mode" NOT NULL,
  "bank_account_id" uuid,
  "reference_number" text,
  "notes" text,
  "status" "payment_status" DEFAULT 'draft' NOT NULL,
  "is_advance" boolean DEFAULT false NOT NULL,
  "cheque_number" text,
  "cheque_date" date,
  "cheque_bank_name" text,
  "cheque_status" "cheque_status",
  "receipt_number" text,
  "receipt_generated_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text,
  "accounting_event_created" boolean DEFAULT false NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payments_allocated_amount_check" CHECK ("allocated_amount" >= 0),
  CONSTRAINT "payments_unallocated_amount_check" CHECK ("unallocated_amount" >= 0)
);--> statement-breakpoint

CREATE TABLE "payment_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "allocation_type" "payment_allocation_type" NOT NULL,
  "reference_id" uuid,
  "reference_number" text,
  "party_type" "payment_party_type" NOT NULL,
  "party_id" uuid NOT NULL,
  "allocated_amount" numeric(14, 2) NOT NULL,
  "allocation_date" date NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_allocations_allocated_amount_check" CHECK ("allocated_amount" > 0)
);--> statement-breakpoint

CREATE TABLE "payment_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "receipt_number" text NOT NULL,
  "receipt_type" "payment_receipt_type" NOT NULL,
  "receipt_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "pdf_url" text,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "payment_reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "party_type" "payment_party_type" NOT NULL,
  "party_id" uuid NOT NULL,
  "reference_type" "payment_reminder_reference_type" NOT NULL,
  "reference_id" uuid,
  "reference_number" text,
  "due_date" date NOT NULL,
  "amount_due" numeric(14, 2) NOT NULL,
  "channel" "payment_reminder_channel" NOT NULL,
  "status" "payment_reminder_status" DEFAULT 'pending' NOT NULL,
  "message" text,
  "sent_at" timestamp with time zone,
  "error_message" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_reminders_amount_due_check" CHECK ("amount_due" > 0)
);--> statement-breakpoint

CREATE TABLE "cheque_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "cheque_number" text NOT NULL,
  "cheque_date" date NOT NULL,
  "bank_name" text NOT NULL,
  "status" "cheque_status" NOT NULL,
  "status_date" date NOT NULL,
  "remarks" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_company_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."company_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "cheque_transactions" ADD CONSTRAINT "cheque_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_transactions" ADD CONSTRAINT "cheque_transactions_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheque_transactions" ADD CONSTRAINT "cheque_transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "payments_company_id_idx" ON "payments" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_company_payment_number_unique_idx" ON "payments" USING btree ("company_id","payment_number");--> statement-breakpoint
CREATE INDEX "payments_company_party_idx" ON "payments" USING btree ("company_id","party_type","party_id");--> statement-breakpoint
CREATE INDEX "payments_company_payment_date_idx" ON "payments" USING btree ("company_id","payment_date");--> statement-breakpoint
CREATE INDEX "payments_company_payment_mode_idx" ON "payments" USING btree ("company_id","payment_mode");--> statement-breakpoint
CREATE INDEX "payments_company_status_idx" ON "payments" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "payments_company_receipt_number_idx" ON "payments" USING btree ("company_id","receipt_number");--> statement-breakpoint

CREATE INDEX "payment_allocations_company_payment_idx" ON "payment_allocations" USING btree ("company_id","payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_company_reference_idx" ON "payment_allocations" USING btree ("company_id","reference_id","allocation_type");--> statement-breakpoint

CREATE UNIQUE INDEX "payment_receipts_payment_id_unique_idx" ON "payment_receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_receipts_company_receipt_number_unique_idx" ON "payment_receipts" USING btree ("company_id","receipt_number");--> statement-breakpoint

CREATE INDEX "payment_reminders_company_party_status_idx" ON "payment_reminders" USING btree ("company_id","party_type","party_id","status");--> statement-breakpoint
CREATE INDEX "payment_reminders_company_due_date_idx" ON "payment_reminders" USING btree ("company_id","due_date");--> statement-breakpoint

CREATE INDEX "cheque_transactions_company_payment_idx" ON "cheque_transactions" USING btree ("company_id","payment_id");--> statement-breakpoint
