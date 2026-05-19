DO $$ BEGIN
  CREATE TYPE "notification_type" AS ENUM ('payment_due', 'supplier_due', 'low_stock', 'expiry', 'invoice', 'payroll', 'gst', 'system', 'warning');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "notification_priority" AS ENUM ('info', 'success', 'warning', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "notification_channel" AS ENUM ('in_app', 'email', 'whatsapp', 'sms');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "notification_frequency" AS ENUM ('instant', 'daily', 'weekly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "notification_log_status" AS ENUM ('pending', 'sent', 'failed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "scheduled_notification_status" AS ENUM ('pending', 'sent', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "type" "notification_type" NOT NULL,
  "priority" "notification_priority" NOT NULL DEFAULT 'info',
  "channel" "notification_channel" NOT NULL,
  "entity_type" text,
  "entity_id" uuid,
  "action_url" text,
  "is_read" boolean NOT NULL DEFAULT false,
  "read_at" timestamptz,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "in_app_enabled" boolean NOT NULL DEFAULT true,
  "email_enabled" boolean NOT NULL DEFAULT true,
  "whatsapp_enabled" boolean NOT NULL DEFAULT false,
  "sms_enabled" boolean NOT NULL DEFAULT false,
  "payment_reminders" boolean NOT NULL DEFAULT true,
  "supplier_reminders" boolean NOT NULL DEFAULT true,
  "low_stock_alerts" boolean NOT NULL DEFAULT true,
  "expiry_alerts" boolean NOT NULL DEFAULT true,
  "invoice_reminders" boolean NOT NULL DEFAULT true,
  "payroll_alerts" boolean NOT NULL DEFAULT true,
  "gst_alerts" boolean NOT NULL DEFAULT true,
  "frequency" "notification_frequency" NOT NULL DEFAULT 'instant',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notification_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "template_key" text NOT NULL,
  "type" "notification_type" NOT NULL,
  "channel" "notification_channel" NOT NULL,
  "subject" text,
  "body" text NOT NULL,
  "variables" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_system" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notification_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "notification_id" uuid REFERENCES "notifications"("id") ON DELETE SET NULL,
  "channel" "notification_channel" NOT NULL,
  "recipient" text NOT NULL,
  "status" "notification_log_status" NOT NULL DEFAULT 'pending',
  "error_message" text,
  "sent_at" timestamptz,
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "scheduled_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "type" "notification_type" NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "scheduled_for" timestamptz NOT NULL,
  "status" "scheduled_notification_status" NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_company_user_unique_idx" ON "notification_preferences" ("company_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "notification_templates_company_key_channel_unique_idx" ON "notification_templates" ("company_id", "template_key", "channel");

CREATE INDEX IF NOT EXISTS "notifications_company_id_idx" ON "notifications" ("company_id");
CREATE INDEX IF NOT EXISTS "notifications_company_user_id_idx" ON "notifications" ("company_id", "user_id");
CREATE INDEX IF NOT EXISTS "notifications_company_type_idx" ON "notifications" ("company_id", "type");
CREATE INDEX IF NOT EXISTS "notifications_company_priority_idx" ON "notifications" ("company_id", "priority");
CREATE INDEX IF NOT EXISTS "notifications_company_is_read_idx" ON "notifications" ("company_id", "is_read");
CREATE INDEX IF NOT EXISTS "notifications_company_channel_read_idx" ON "notifications" ("company_id", "channel", "is_read");
CREATE INDEX IF NOT EXISTS "notifications_company_created_at_idx" ON "notifications" ("company_id", "created_at");

CREATE INDEX IF NOT EXISTS "notification_preferences_company_id_idx" ON "notification_preferences" ("company_id");
CREATE INDEX IF NOT EXISTS "notification_templates_company_id_idx" ON "notification_templates" ("company_id");
CREATE INDEX IF NOT EXISTS "notification_templates_company_type_idx" ON "notification_templates" ("company_id", "type");
CREATE INDEX IF NOT EXISTS "notification_templates_company_channel_idx" ON "notification_templates" ("company_id", "channel");

CREATE INDEX IF NOT EXISTS "notification_logs_company_id_idx" ON "notification_logs" ("company_id");
CREATE INDEX IF NOT EXISTS "notification_logs_channel_idx" ON "notification_logs" ("channel");
CREATE INDEX IF NOT EXISTS "notification_logs_status_idx" ON "notification_logs" ("status");
CREATE INDEX IF NOT EXISTS "notification_logs_company_created_at_idx" ON "notification_logs" ("company_id", "created_at");

CREATE INDEX IF NOT EXISTS "scheduled_notifications_company_id_idx" ON "scheduled_notifications" ("company_id");
CREATE INDEX IF NOT EXISTS "scheduled_notifications_company_type_idx" ON "scheduled_notifications" ("company_id", "type");
CREATE INDEX IF NOT EXISTS "scheduled_notifications_scheduled_for_status_idx" ON "scheduled_notifications" ("scheduled_for", "status");
CREATE INDEX IF NOT EXISTS "scheduled_notifications_company_entity_idx" ON "scheduled_notifications" ("company_id", "entity_type", "entity_id");
