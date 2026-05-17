CREATE TYPE "public"."product_category_status" AS ENUM('active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."product_price_history_change_type" AS ENUM('purchase_price', 'sale_price', 'mrp', 'wholesale_price', 'minimum_sale_price', 'gst_rate', 'discount', 'pricing');--> statement-breakpoint
CREATE TYPE "public"."product_price_tax_type" AS ENUM('inclusive', 'exclusive');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."product_tax_type" AS ENUM('taxable', 'exempt', 'nil_rated', 'non_gst');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('goods', 'service');--> statement-breakpoint
CREATE TYPE "public"."product_unit_status" AS ENUM('active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_code" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"description" text,
	"status" "product_category_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "product_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"decimal_allowed" boolean DEFAULT false NOT NULL,
	"base_unit_id" uuid,
	"conversion_rate" numeric(14, 4),
	"status" "product_unit_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "product_units_conversion_rate_check" CHECK (("base_unit_id" is null and "conversion_rate" is null) or ("base_unit_id" is not null and "conversion_rate" > 0))
);--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_code" text NOT NULL,
	"product_type" "product_type" NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"category_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"brand" text,
	"description" text,
	"hsn_sac_code" text,
	"tax_type" "product_tax_type" DEFAULT 'taxable' NOT NULL,
	"gst_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"cess_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"price_tax_type" "product_price_tax_type" DEFAULT 'exclusive' NOT NULL,
	"purchase_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sale_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"mrp" numeric(14, 2) DEFAULT '0' NOT NULL,
	"wholesale_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"minimum_sale_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"default_discount" numeric(5, 2) DEFAULT '0' NOT NULL,
	"margin_percentage" numeric(8, 2) DEFAULT '0' NOT NULL,
	"markup_percentage" numeric(8, 2) DEFAULT '0' NOT NULL,
	"stock_tracking_enabled" boolean DEFAULT false NOT NULL,
	"opening_stock_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"opening_stock_rate" numeric(14, 2) DEFAULT '0' NOT NULL,
	"opening_stock_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"minimum_stock_level" numeric(14, 3) DEFAULT '0' NOT NULL,
	"reorder_level" numeric(14, 3) DEFAULT '0' NOT NULL,
	"maximum_stock_level" numeric(14, 3) DEFAULT '0' NOT NULL,
	"batch_tracking_enabled" boolean DEFAULT false NOT NULL,
	"expiry_tracking_enabled" boolean DEFAULT false NOT NULL,
	"serial_tracking_enabled" boolean DEFAULT false NOT NULL,
	"negative_stock_allowed" boolean DEFAULT false NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_gst_rate_check" CHECK ("gst_rate" >= 0 AND "gst_rate" <= 28),
	CONSTRAINT "products_cess_rate_check" CHECK ("cess_rate" >= 0),
	CONSTRAINT "products_purchase_price_check" CHECK ("purchase_price" >= 0),
	CONSTRAINT "products_sale_price_check" CHECK ("sale_price" >= 0),
	CONSTRAINT "products_mrp_check" CHECK ("mrp" >= 0),
	CONSTRAINT "products_wholesale_price_check" CHECK ("wholesale_price" >= 0),
	CONSTRAINT "products_minimum_sale_price_check" CHECK ("minimum_sale_price" >= 0),
	CONSTRAINT "products_default_discount_check" CHECK ("default_discount" >= 0 AND "default_discount" <= 100),
	CONSTRAINT "products_opening_stock_quantity_check" CHECK ("opening_stock_quantity" >= 0),
	CONSTRAINT "products_opening_stock_rate_check" CHECK ("opening_stock_rate" >= 0),
	CONSTRAINT "products_opening_stock_value_check" CHECK ("opening_stock_value" >= 0),
	CONSTRAINT "products_minimum_stock_level_check" CHECK ("minimum_stock_level" >= 0),
	CONSTRAINT "products_reorder_level_check" CHECK ("reorder_level" >= 0),
	CONSTRAINT "products_maximum_stock_level_check" CHECK ("maximum_stock_level" >= 0)
);--> statement-breakpoint
CREATE TABLE "product_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"change_type" "product_price_history_change_type" NOT NULL,
	"old_value" numeric(14, 2),
	"new_value" numeric(14, 2),
	"old_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"new_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parent_id_product_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."product_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_base_unit_id_product_units_id_fk" FOREIGN KEY ("base_unit_id") REFERENCES "public"."product_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_units" ADD CONSTRAINT "product_units_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_product_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."product_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_categories_company_id_idx" ON "product_categories" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "product_categories_company_name_idx" ON "product_categories" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "product_categories_company_status_idx" ON "product_categories" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_company_category_code_unique_idx" ON "product_categories" USING btree ("company_id","category_code");--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_company_name_unique_idx" ON "product_categories" USING btree ("company_id","name") WHERE "product_categories"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_units_company_id_idx" ON "product_units" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "product_units_company_name_idx" ON "product_units" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "product_units_company_status_idx" ON "product_units" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "product_units_company_base_unit_idx" ON "product_units" USING btree ("company_id","base_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_units_company_symbol_unique_idx" ON "product_units" USING btree ("company_id","symbol") WHERE "product_units"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "products_company_id_idx" ON "products" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "products_company_name_idx" ON "products" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "products_company_category_id_idx" ON "products" USING btree ("company_id","category_id");--> statement-breakpoint
CREATE INDEX "products_company_status_idx" ON "products" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "products_company_product_type_idx" ON "products" USING btree ("company_id","product_type");--> statement-breakpoint
CREATE INDEX "products_hsn_sac_code_idx" ON "products" USING btree ("hsn_sac_code");--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_product_code_unique_idx" ON "products" USING btree ("company_id","product_code");--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_sku_unique_idx" ON "products" USING btree ("company_id","sku") WHERE "products"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_barcode_unique_idx" ON "products" USING btree ("company_id","barcode") WHERE "products"."barcode" is not null AND "products"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "product_price_history_company_id_idx" ON "product_price_history" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "product_price_history_product_id_idx" ON "product_price_history" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_price_history_company_product_id_idx" ON "product_price_history" USING btree ("company_id","product_id");
