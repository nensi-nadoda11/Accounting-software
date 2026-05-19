DO $$ BEGIN
  CREATE TYPE "invoice_template_type" AS ENUM ('sales', 'purchase', 'pos', 'return');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "table_density" AS ENUM ('compact', 'normal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "setting_key" text NOT NULL,
  "setting_value" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "setting_group" text NOT NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_settings_company_key_unique_idx"
  ON "app_settings" ("company_id", "setting_key");
CREATE INDEX IF NOT EXISTS "app_settings_company_group_idx"
  ON "app_settings" ("company_id", "setting_group");

CREATE TABLE IF NOT EXISTS "payment_modes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "mode_key" text NOT NULL,
  "mode_name" text NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "requires_reference" boolean NOT NULL DEFAULT false,
  "requires_bank_account" boolean NOT NULL DEFAULT false,
  "cheque_workflow_enabled" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_modes_company_mode_key_unique_idx"
  ON "payment_modes" ("company_id", "mode_key");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_modes_company_default_enabled_unique_idx"
  ON "payment_modes" ("company_id")
  WHERE "is_default" = true AND "is_enabled" = true;
CREATE INDEX IF NOT EXISTS "payment_modes_company_idx"
  ON "payment_modes" ("company_id");

CREATE TABLE IF NOT EXISTS "invoice_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "template_key" text NOT NULL,
  "template_name" text NOT NULL,
  "invoice_type" "invoice_template_type" NOT NULL,
  "layout_config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_default" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoice_templates_company_template_key_unique_idx"
  ON "invoice_templates" ("company_id", "template_key");
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_templates_company_type_default_unique_idx"
  ON "invoice_templates" ("company_id", "invoice_type")
  WHERE "is_default" = true AND "is_active" = true;
CREATE INDEX IF NOT EXISTS "invoice_templates_company_idx"
  ON "invoice_templates" ("company_id");

CREATE TABLE IF NOT EXISTS "user_ui_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "accent_color" text,
  "compact_mode" boolean NOT NULL DEFAULT true,
  "table_density" "table_density" NOT NULL DEFAULT 'compact',
  "date_format" text NOT NULL DEFAULT 'DD/MM/YYYY',
  "currency_format" text NOT NULL DEFAULT 'symbol_first',
  "number_format" text NOT NULL DEFAULT 'indian',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_ui_preferences_company_user_unique_idx"
  ON "user_ui_preferences" ("company_id", "user_id");
CREATE INDEX IF NOT EXISTS "user_ui_preferences_company_idx"
  ON "user_ui_preferences" ("company_id");
CREATE INDEX IF NOT EXISTS "user_ui_preferences_user_idx"
  ON "user_ui_preferences" ("user_id");
