DO $$ BEGIN
  CREATE TYPE "audit_log_status" AS ENUM ('success', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "login_log_type" AS ENUM ('login', 'logout', 'failed_login', 'password_reset');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "backup_type" AS ENUM ('manual', 'scheduled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "backup_status" AS ENUM ('generating', 'completed', 'failed', 'restoring');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "restore_log_status" AS ENUM ('success', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "restore_mode" AS ENUM ('merge', 'replace');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_name_snapshot" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "user_role_snapshot" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "module" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "old_values" jsonb;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "new_values" jsonb;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "request_method" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "request_path" text;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "status" "audit_log_status" NOT NULL DEFAULT 'success';

UPDATE "audit_logs"
SET "module" = coalesce(nullif("entity_type", ''), split_part("action", '_', 1), 'system')
WHERE "module" IS NULL;

ALTER TABLE "audit_logs" ALTER COLUMN "module" SET NOT NULL;
ALTER TABLE "audit_logs" ALTER COLUMN "entity_type" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "audit_logs_module_idx" ON "audit_logs" ("module");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_status_idx" ON "audit_logs" ("status");

CREATE TABLE IF NOT EXISTS "login_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "email" text NOT NULL,
  "login_type" "login_log_type" NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "success" boolean NOT NULL,
  "failure_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "login_logs_company_id_idx" ON "login_logs" ("company_id");
CREATE INDEX IF NOT EXISTS "login_logs_user_id_idx" ON "login_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "login_logs_email_idx" ON "login_logs" ("email");
CREATE INDEX IF NOT EXISTS "login_logs_login_type_idx" ON "login_logs" ("login_type");
CREATE INDEX IF NOT EXISTS "login_logs_created_at_idx" ON "login_logs" ("created_at");

CREATE TABLE IF NOT EXISTS "backups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "backup_name" text NOT NULL,
  "backup_type" "backup_type" NOT NULL DEFAULT 'manual',
  "file_name" text NOT NULL,
  "file_url" text,
  "size_bytes" integer,
  "status" "backup_status" NOT NULL DEFAULT 'generating',
  "includes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "restore_started_at" timestamptz,
  "restored_at" timestamptz,
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "backups_company_id_idx" ON "backups" ("company_id");
CREATE INDEX IF NOT EXISTS "backups_status_idx" ON "backups" ("status");
CREATE INDEX IF NOT EXISTS "backups_backup_type_idx" ON "backups" ("backup_type");
CREATE INDEX IF NOT EXISTS "backups_created_at_idx" ON "backups" ("created_at");

CREATE TABLE IF NOT EXISTS "backup_restore_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "backup_id" uuid NOT NULL REFERENCES "backups"("id") ON DELETE CASCADE,
  "restored_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "status" "restore_log_status" NOT NULL,
  "restore_mode" "restore_mode" NOT NULL,
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "backup_restore_logs_company_id_idx" ON "backup_restore_logs" ("company_id");
CREATE INDEX IF NOT EXISTS "backup_restore_logs_backup_id_idx" ON "backup_restore_logs" ("backup_id");
CREATE INDEX IF NOT EXISTS "backup_restore_logs_status_idx" ON "backup_restore_logs" ("status");
CREATE INDEX IF NOT EXISTS "backup_restore_logs_created_at_idx" ON "backup_restore_logs" ("created_at");
