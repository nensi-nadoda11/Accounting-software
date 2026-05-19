DO $$ BEGIN
  CREATE TYPE "report_export_format" AS ENUM ('csv', 'xlsx', 'pdf');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "report_export_status" AS ENUM ('generated', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "report_exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "report_type" text NOT NULL,
  "export_format" "report_export_format" NOT NULL,
  "filters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "file_url" text,
  "status" "report_export_status" NOT NULL DEFAULT 'generated',
  "generated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "report_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "snapshot_type" text NOT NULL,
  "period_start" timestamptz NOT NULL,
  "period_end" timestamptz NOT NULL,
  "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "report_snapshots_period_check" CHECK ("period_end" >= "period_start")
);

CREATE INDEX IF NOT EXISTS "report_exports_company_id_idx" ON "report_exports" ("company_id");
CREATE INDEX IF NOT EXISTS "report_exports_company_created_at_idx" ON "report_exports" ("company_id", "created_at");
CREATE INDEX IF NOT EXISTS "report_exports_report_type_idx" ON "report_exports" ("report_type");
CREATE INDEX IF NOT EXISTS "report_exports_status_idx" ON "report_exports" ("status");
CREATE INDEX IF NOT EXISTS "report_snapshots_company_id_idx" ON "report_snapshots" ("company_id");
CREATE INDEX IF NOT EXISTS "report_snapshots_company_snapshot_type_idx" ON "report_snapshots" ("company_id", "snapshot_type");
