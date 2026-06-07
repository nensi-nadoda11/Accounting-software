DO $$ BEGIN
  CREATE TYPE "cash_verification_status" AS ENUM ('matched', 'short_cash', 'excess_cash');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "cash_verification_record_status" AS ENUM ('draft', 'completed', 'approved', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "cash_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "verification_no" text NOT NULL,
  "verification_date" date NOT NULL,
  "expected_cash" numeric(14, 2) NOT NULL,
  "actual_cash" numeric(14, 2) NOT NULL,
  "difference_amount" numeric(14, 2) NOT NULL,
  "status" "cash_verification_status" NOT NULL,
  "remarks" text,
  "verified_by_user_id" uuid NOT NULL,
  "approved_by_user_id" uuid,
  "approval_date" timestamp with time zone,
  "record_status" "cash_verification_record_status" DEFAULT 'draft' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "cash_verifications" ADD CONSTRAINT "cash_verifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "cash_verifications" ADD CONSTRAINT "cash_verifications_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "cash_verifications" ADD CONSTRAINT "cash_verifications_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "cash_verifications_company_id_idx" ON "cash_verifications" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "cash_verifications_verification_date_idx" ON "cash_verifications" USING btree ("verification_date");
CREATE INDEX IF NOT EXISTS "cash_verifications_status_idx" ON "cash_verifications" USING btree ("status");
CREATE INDEX IF NOT EXISTS "cash_verifications_record_status_idx" ON "cash_verifications" USING btree ("record_status");
CREATE UNIQUE INDEX IF NOT EXISTS "cash_verifications_company_verification_no_unique_idx" ON "cash_verifications" USING btree ("company_id", "verification_no");
