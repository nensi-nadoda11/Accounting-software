DO $$ BEGIN
  CREATE TYPE "site_audit_status" AS ENUM ('draft', 'completed', 'approved', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "site_audit_final_result" AS ENUM ('passed', 'issues_found', 'needs_review');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "site_audit_finding_severity" AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "site_audit_finding_status" AS ENUM ('open', 'resolved', 'ignored');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "site_audits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "audit_no" text NOT NULL,
  "audit_date" date NOT NULL,
  "warehouse_id" uuid,
  "auditor_user_id" uuid NOT NULL,
  "linked_stock_check_id" uuid,
  "linked_cash_verification_id" uuid,
  "status" "site_audit_status" DEFAULT 'draft' NOT NULL,
  "final_result" "site_audit_final_result" DEFAULT 'needs_review' NOT NULL,
  "overall_remarks" text,
  "approved_by_user_id" uuid,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_audit_checklist_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_audit_id" uuid NOT NULL,
  "checklist_key" text NOT NULL,
  "checklist_label" text NOT NULL,
  "is_checked" boolean DEFAULT false NOT NULL,
  "remarks" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_audit_findings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_audit_id" uuid NOT NULL,
  "finding_title" text NOT NULL,
  "finding_description" text,
  "severity" "site_audit_finding_severity" NOT NULL,
  "status" "site_audit_finding_status" DEFAULT 'open' NOT NULL,
  "related_module" text,
  "related_reference_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "site_audit_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "site_audit_id" uuid NOT NULL,
  "file_name" text NOT NULL,
  "original_name" text NOT NULL,
  "file_url" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "uploaded_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

DO $$ BEGIN
  ALTER TABLE "site_audits" ADD CONSTRAINT "site_audits_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "site_audits" ADD CONSTRAINT "site_audits_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "site_audits" ADD CONSTRAINT "site_audits_auditor_user_id_users_id_fk" FOREIGN KEY ("auditor_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "site_audits" ADD CONSTRAINT "site_audits_linked_stock_check_id_stock_checks_id_fk" FOREIGN KEY ("linked_stock_check_id") REFERENCES "stock_checks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "site_audits" ADD CONSTRAINT "site_audits_linked_cash_verification_id_cash_verifications_id_fk" FOREIGN KEY ("linked_cash_verification_id") REFERENCES "cash_verifications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "site_audits" ADD CONSTRAINT "site_audits_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "site_audit_checklist_items" ADD CONSTRAINT "site_audit_checklist_items_site_audit_id_site_audits_id_fk" FOREIGN KEY ("site_audit_id") REFERENCES "site_audits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "site_audit_findings" ADD CONSTRAINT "site_audit_findings_site_audit_id_site_audits_id_fk" FOREIGN KEY ("site_audit_id") REFERENCES "site_audits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "site_audit_attachments" ADD CONSTRAINT "site_audit_attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "site_audit_attachments" ADD CONSTRAINT "site_audit_attachments_site_audit_id_site_audits_id_fk" FOREIGN KEY ("site_audit_id") REFERENCES "site_audits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "site_audit_attachments" ADD CONSTRAINT "site_audit_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "site_audits_company_id_idx" ON "site_audits" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "site_audits_audit_no_idx" ON "site_audits" USING btree ("audit_no");
CREATE INDEX IF NOT EXISTS "site_audits_audit_date_idx" ON "site_audits" USING btree ("audit_date");
CREATE INDEX IF NOT EXISTS "site_audits_warehouse_id_idx" ON "site_audits" USING btree ("warehouse_id");
CREATE INDEX IF NOT EXISTS "site_audits_auditor_user_id_idx" ON "site_audits" USING btree ("auditor_user_id");
CREATE INDEX IF NOT EXISTS "site_audits_status_idx" ON "site_audits" USING btree ("status");
CREATE INDEX IF NOT EXISTS "site_audits_final_result_idx" ON "site_audits" USING btree ("final_result");
CREATE UNIQUE INDEX IF NOT EXISTS "site_audits_company_audit_no_unique_idx" ON "site_audits" USING btree ("company_id", "audit_no");
CREATE INDEX IF NOT EXISTS "site_audit_checklist_items_site_audit_id_idx" ON "site_audit_checklist_items" USING btree ("site_audit_id");
CREATE INDEX IF NOT EXISTS "site_audit_findings_site_audit_id_idx" ON "site_audit_findings" USING btree ("site_audit_id");
CREATE INDEX IF NOT EXISTS "site_audit_findings_severity_idx" ON "site_audit_findings" USING btree ("severity");
CREATE INDEX IF NOT EXISTS "site_audit_findings_status_idx" ON "site_audit_findings" USING btree ("status");
CREATE INDEX IF NOT EXISTS "site_audit_attachments_company_audit_idx" ON "site_audit_attachments" USING btree ("company_id", "site_audit_id");
CREATE INDEX IF NOT EXISTS "site_audit_attachments_company_created_idx" ON "site_audit_attachments" USING btree ("company_id", "created_at");
