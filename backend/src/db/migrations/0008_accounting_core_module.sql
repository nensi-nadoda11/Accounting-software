CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."account_normal_balance" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."account_opening_balance_type" AS ENUM('debit', 'credit', 'none');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."journal_voucher_type" AS ENUM('journal', 'sales', 'purchase', 'receipt', 'payment', 'contra', 'debit_note', 'credit_note', 'expense', 'payroll', 'opening', 'adjustment', 'reversal');--> statement-breakpoint
CREATE TYPE "public"."journal_status" AS ENUM('draft', 'posted', 'cancelled', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."journal_party_type" AS ENUM('customer', 'supplier');--> statement-breakpoint
CREATE TYPE "public"."financial_lock_type" AS ENUM('month', 'quarter', 'year');--> statement-breakpoint

CREATE TABLE "chart_of_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "account_code" text NOT NULL,
  "account_name" text NOT NULL,
  "account_type" "account_type" NOT NULL,
  "account_subtype" text,
  "parent_id" uuid,
  "is_system" boolean DEFAULT false NOT NULL,
  "system_key" text,
  "normal_balance" "account_normal_balance" NOT NULL,
  "opening_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
  "opening_balance_type" "account_opening_balance_type" DEFAULT 'none' NOT NULL,
  "current_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
  "status" "account_status" DEFAULT 'active' NOT NULL,
  "description" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "chart_of_accounts_opening_balance_check" CHECK ("opening_balance" >= 0)
);--> statement-breakpoint

CREATE TABLE "journal_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "financial_year_id" uuid,
  "journal_number" text NOT NULL,
  "entry_date" date NOT NULL,
  "voucher_type" "journal_voucher_type" NOT NULL,
  "reference_type" text,
  "reference_id" uuid,
  "reference_number" text,
  "description" text NOT NULL,
  "status" "journal_status" DEFAULT 'draft' NOT NULL,
  "total_debit" numeric(14, 2) DEFAULT '0' NOT NULL,
  "total_credit" numeric(14, 2) DEFAULT '0' NOT NULL,
  "posted_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "reversed_from_id" uuid,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "journal_entries_total_debit_check" CHECK ("total_debit" >= 0),
  CONSTRAINT "journal_entries_total_credit_check" CHECK ("total_credit" >= 0)
);--> statement-breakpoint

CREATE TABLE "journal_entry_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "journal_entry_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "line_number" integer NOT NULL,
  "description" text,
  "debit" numeric(14, 2) DEFAULT '0' NOT NULL,
  "credit" numeric(14, 2) DEFAULT '0' NOT NULL,
  "balance_after" numeric(14, 2),
  "party_type" "journal_party_type",
  "party_id" uuid,
  "reference_type" text,
  "reference_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "journal_entry_lines_line_number_check" CHECK ("line_number" > 0),
  CONSTRAINT "journal_entry_lines_debit_check" CHECK ("debit" >= 0),
  CONSTRAINT "journal_entry_lines_credit_check" CHECK ("credit" >= 0),
  CONSTRAINT "journal_entry_lines_one_side_check" CHECK ((("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)))
);--> statement-breakpoint

CREATE TABLE "account_opening_balances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "financial_year_id" uuid,
  "opening_date" date NOT NULL,
  "debit" numeric(14, 2) DEFAULT '0' NOT NULL,
  "credit" numeric(14, 2) DEFAULT '0' NOT NULL,
  "is_locked" boolean DEFAULT false NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "account_opening_balances_debit_check" CHECK ("debit" >= 0),
  CONSTRAINT "account_opening_balances_credit_check" CHECK ("credit" >= 0),
  CONSTRAINT "account_opening_balances_one_side_check" CHECK ((("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)))
);--> statement-breakpoint

CREATE TABLE "financial_period_locks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "financial_year_id" uuid,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "lock_type" "financial_lock_type" NOT NULL,
  "is_locked" boolean DEFAULT true NOT NULL,
  "locked_by" uuid,
  "locked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "financial_period_locks_period_check" CHECK ("period_end" >= "period_start")
);--> statement-breakpoint

ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_parent_id_chart_of_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_financial_year_id_company_financial_years_id_fk" FOREIGN KEY ("financial_year_id") REFERENCES "public"."company_financial_years"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversed_from_id_journal_entries_id_fk" FOREIGN KEY ("reversed_from_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "account_opening_balances" ADD CONSTRAINT "account_opening_balances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_opening_balances" ADD CONSTRAINT "account_opening_balances_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_opening_balances" ADD CONSTRAINT "account_opening_balances_financial_year_id_company_financial_years_id_fk" FOREIGN KEY ("financial_year_id") REFERENCES "public"."company_financial_years"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_opening_balances" ADD CONSTRAINT "account_opening_balances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_opening_balances" ADD CONSTRAINT "account_opening_balances_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "financial_period_locks" ADD CONSTRAINT "financial_period_locks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_period_locks" ADD CONSTRAINT "financial_period_locks_financial_year_id_company_financial_years_id_fk" FOREIGN KEY ("financial_year_id") REFERENCES "public"."company_financial_years"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_period_locks" ADD CONSTRAINT "financial_period_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "chart_of_accounts_company_id_idx" ON "chart_of_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_company_type_status_idx" ON "chart_of_accounts" USING btree ("company_id", "account_type", "status");--> statement-breakpoint
CREATE INDEX "chart_of_accounts_company_parent_id_idx" ON "chart_of_accounts" USING btree ("company_id", "parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chart_of_accounts_company_account_code_unique_idx" ON "chart_of_accounts" USING btree ("company_id", "account_code") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chart_of_accounts_company_system_key_unique_idx" ON "chart_of_accounts" USING btree ("company_id", "system_key") WHERE "system_key" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint

CREATE UNIQUE INDEX "journal_entries_company_journal_number_unique_idx" ON "journal_entries" USING btree ("company_id", "journal_number");--> statement-breakpoint
CREATE INDEX "journal_entries_company_entry_date_idx" ON "journal_entries" USING btree ("company_id", "entry_date");--> statement-breakpoint
CREATE INDEX "journal_entries_company_voucher_status_idx" ON "journal_entries" USING btree ("company_id", "voucher_type", "status");--> statement-breakpoint
CREATE INDEX "journal_entries_company_financial_year_idx" ON "journal_entries" USING btree ("company_id", "financial_year_id");--> statement-breakpoint

CREATE INDEX "journal_entry_lines_company_account_created_idx" ON "journal_entry_lines" USING btree ("company_id", "account_id", "created_at");--> statement-breakpoint
CREATE INDEX "journal_entry_lines_company_journal_entry_idx" ON "journal_entry_lines" USING btree ("company_id", "journal_entry_id");--> statement-breakpoint
CREATE INDEX "journal_entry_lines_company_party_idx" ON "journal_entry_lines" USING btree ("company_id", "party_type", "party_id");--> statement-breakpoint

CREATE INDEX "account_opening_balances_company_account_idx" ON "account_opening_balances" USING btree ("company_id", "account_id");--> statement-breakpoint
CREATE INDEX "account_opening_balances_company_financial_year_idx" ON "account_opening_balances" USING btree ("company_id", "financial_year_id");--> statement-breakpoint

CREATE INDEX "financial_period_locks_company_period_idx" ON "financial_period_locks" USING btree ("company_id", "period_start", "period_end");--> statement-breakpoint
CREATE INDEX "financial_period_locks_company_financial_year_idx" ON "financial_period_locks" USING btree ("company_id", "financial_year_id");--> statement-breakpoint

ALTER TYPE "public"."accounting_event_status" RENAME VALUE 'processed' TO 'posted';--> statement-breakpoint
ALTER TYPE "public"."accounting_event_status" RENAME VALUE 'cancelled' TO 'ignored';--> statement-breakpoint

ALTER TABLE "accounting_events" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "accounting_events" ADD COLUMN "journal_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "accounting_events" ADD COLUMN "posted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounting_events" ADD CONSTRAINT "accounting_events_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounting_events_company_status_idx" ON "accounting_events" USING btree ("company_id", "status");--> statement-breakpoint
CREATE INDEX "accounting_events_journal_entry_id_idx" ON "accounting_events" USING btree ("journal_entry_id");--> statement-breakpoint
