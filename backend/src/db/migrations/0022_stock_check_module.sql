DO $$ BEGIN
  CREATE TYPE "stock_check_status" AS ENUM ('draft', 'completed', 'approved', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "stock_check_item_status" AS ENUM ('matched', 'short', 'excess');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "stock_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "check_no" text NOT NULL,
  "warehouse_id" uuid NOT NULL,
  "status" "stock_check_status" DEFAULT 'draft' NOT NULL,
  "check_date" date NOT NULL,
  "checked_by_user_id" uuid NOT NULL,
  "approved_by_user_id" uuid,
  "remarks" text,
  "total_items" integer DEFAULT 0 NOT NULL,
  "matched_items" integer DEFAULT 0 NOT NULL,
  "short_items" integer DEFAULT 0 NOT NULL,
  "excess_items" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_check_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stock_check_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "system_qty" numeric(14, 3) NOT NULL,
  "physical_qty" numeric(14, 3) NOT NULL,
  "difference_qty" numeric(14, 3) NOT NULL,
  "status" "stock_check_item_status" NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "stock_checks" ADD CONSTRAINT "stock_checks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_checks" ADD CONSTRAINT "stock_checks_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_checks" ADD CONSTRAINT "stock_checks_checked_by_user_id_users_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_checks" ADD CONSTRAINT "stock_checks_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_check_items" ADD CONSTRAINT "stock_check_items_stock_check_id_stock_checks_id_fk" FOREIGN KEY ("stock_check_id") REFERENCES "stock_checks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_check_items" ADD CONSTRAINT "stock_check_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "stock_checks_company_id_idx" ON "stock_checks" USING btree ("company_id");
CREATE INDEX IF NOT EXISTS "stock_checks_warehouse_id_idx" ON "stock_checks" USING btree ("warehouse_id");
CREATE INDEX IF NOT EXISTS "stock_checks_status_idx" ON "stock_checks" USING btree ("status");
CREATE INDEX IF NOT EXISTS "stock_checks_check_date_idx" ON "stock_checks" USING btree ("check_date");
CREATE UNIQUE INDEX IF NOT EXISTS "stock_checks_company_check_no_unique_idx" ON "stock_checks" USING btree ("company_id", "check_no");
CREATE INDEX IF NOT EXISTS "stock_check_items_stock_check_id_idx" ON "stock_check_items" USING btree ("stock_check_id");
CREATE INDEX IF NOT EXISTS "stock_check_items_product_id_idx" ON "stock_check_items" USING btree ("product_id");

ALTER TABLE "stock_check_items" ADD COLUMN IF NOT EXISTS "batch_id" uuid;

DO $$ BEGIN
  ALTER TABLE "stock_check_items" ADD CONSTRAINT "stock_check_items_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "stock_check_items_batch_id_idx" ON "stock_check_items" USING btree ("batch_id");
