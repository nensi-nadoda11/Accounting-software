CREATE TYPE "public"."warehouse_status" AS ENUM('active', 'inactive', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."product_batch_status" AS ENUM('active', 'expired', 'blocked', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('opening_stock', 'purchase', 'purchase_return', 'sale', 'sales_return', 'adjustment_in', 'adjustment_out', 'damaged', 'expired_writeoff', 'found', 'lost', 'transfer_in', 'transfer_out');--> statement-breakpoint
CREATE TYPE "public"."stock_adjustment_type" AS ENUM('increase', 'decrease', 'damaged', 'lost', 'expired_writeoff', 'found', 'opening_correction', 'manual_correction');--> statement-breakpoint
CREATE TYPE "public"."stock_adjustment_status" AS ENUM('completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."inventory_alert_type" AS ENUM('low_stock', 'out_of_stock', 'reorder_needed', 'expired', 'expiring_soon', 'overstock');--> statement-breakpoint
CREATE TYPE "public"."inventory_alert_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."inventory_valuation_method" AS ENUM('weighted_average');--> statement-breakpoint

CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_code" text NOT NULL,
	"name" text NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"pincode" text,
	"contact_person" text,
	"mobile" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" "warehouse_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint

CREATE TABLE "product_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"batch_number" text NOT NULL,
	"manufacturing_date" date,
	"expiry_date" date,
	"purchase_rate" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sale_rate" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "product_batch_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "product_batches_purchase_rate_check" CHECK ("purchase_rate" >= 0),
	CONSTRAINT "product_batches_sale_rate_check" CHECK ("sale_rate" >= 0)
);
--> statement-breakpoint

CREATE TABLE "stock_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"batch_id" uuid,
	"available_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"reserved_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"damaged_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"expired_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"average_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"stock_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"last_movement_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_balances_reserved_quantity_check" CHECK ("reserved_quantity" >= 0),
	CONSTRAINT "stock_balances_damaged_quantity_check" CHECK ("damaged_quantity" >= 0),
	CONSTRAINT "stock_balances_expired_quantity_check" CHECK ("expired_quantity" >= 0),
	CONSTRAINT "stock_balances_average_cost_check" CHECK ("average_cost" >= 0)
);
--> statement-breakpoint

CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"batch_id" uuid,
	"movement_type" "stock_movement_type" NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"reference_number" text,
	"movement_date" timestamp with time zone NOT NULL,
	"in_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"out_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"balance_after" numeric(14, 3) DEFAULT '0' NOT NULL,
	"rate" numeric(14, 2) DEFAULT '0' NOT NULL,
	"value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"remarks" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_in_quantity_check" CHECK ("in_quantity" >= 0),
	CONSTRAINT "stock_movements_out_quantity_check" CHECK ("out_quantity" >= 0),
	CONSTRAINT "stock_movements_rate_check" CHECK ("rate" >= 0),
	CONSTRAINT "stock_movements_value_check" CHECK ("value" >= 0)
);
--> statement-breakpoint

CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"batch_id" uuid,
	"adjustment_type" "stock_adjustment_type" NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"rate" numeric(14, 2) DEFAULT '0' NOT NULL,
	"value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"reason" text NOT NULL,
	"adjustment_date" timestamp with time zone NOT NULL,
	"status" "stock_adjustment_status" DEFAULT 'completed' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_adjustments_quantity_check" CHECK ("quantity" > 0),
	CONSTRAINT "stock_adjustments_rate_check" CHECK ("rate" >= 0),
	CONSTRAINT "stock_adjustments_value_check" CHECK ("value" >= 0)
);
--> statement-breakpoint

CREATE TABLE "inventory_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"batch_id" uuid,
	"alert_type" "inventory_alert_type" NOT NULL,
	"severity" "inventory_alert_severity" NOT NULL,
	"message" text NOT NULL,
	"threshold_quantity" numeric(14, 3),
	"current_quantity" numeric(14, 3),
	"expiry_date" date,
	"is_read" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "inventory_valuation_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"valuation_method" "inventory_valuation_method" DEFAULT 'weighted_average' NOT NULL,
	"total_quantity" numeric(14, 3) DEFAULT '0' NOT NULL,
	"total_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_batch_id_product_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."product_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_valuation_snapshots" ADD CONSTRAINT "inventory_valuation_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_valuation_snapshots" ADD CONSTRAINT "inventory_valuation_snapshots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "warehouses_company_id_idx" ON "warehouses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "warehouses_company_status_idx" ON "warehouses" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_company_warehouse_code_unique_idx" ON "warehouses" USING btree ("company_id","warehouse_code");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouses_company_default_active_unique_idx" ON "warehouses" USING btree ("company_id") WHERE "is_default" = true AND "deleted_at" IS NULL AND "status" = 'active';--> statement-breakpoint
CREATE INDEX "product_batches_company_id_idx" ON "product_batches" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "product_batches_company_product_warehouse_idx" ON "product_batches" USING btree ("company_id","product_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "product_batches_company_expiry_date_idx" ON "product_batches" USING btree ("company_id","expiry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "product_batches_company_product_warehouse_batch_unique_idx" ON "product_batches" USING btree ("company_id","product_id","warehouse_id","batch_number") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "stock_balances_company_id_idx" ON "stock_balances" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "stock_balances_company_product_warehouse_batch_idx" ON "stock_balances" USING btree ("company_id","product_id","warehouse_id","batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_company_product_warehouse_batch_unique_idx" ON "stock_balances" USING btree ("company_id","product_id","warehouse_id","batch_id") WHERE "batch_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_balances_company_product_warehouse_no_batch_unique_idx" ON "stock_balances" USING btree ("company_id","product_id","warehouse_id") WHERE "batch_id" IS NULL;--> statement-breakpoint
CREATE INDEX "stock_movements_company_id_idx" ON "stock_movements" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "stock_movements_company_product_movement_date_idx" ON "stock_movements" USING btree ("company_id","product_id","movement_date");--> statement-breakpoint
CREATE INDEX "stock_movements_company_warehouse_movement_date_idx" ON "stock_movements" USING btree ("company_id","warehouse_id","movement_date");--> statement-breakpoint
CREATE INDEX "stock_movements_company_movement_type_idx" ON "stock_movements" USING btree ("company_id","movement_type");--> statement-breakpoint
CREATE INDEX "stock_adjustments_company_id_idx" ON "stock_adjustments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_company_product_date_idx" ON "stock_adjustments" USING btree ("company_id","product_id","adjustment_date");--> statement-breakpoint
CREATE INDEX "inventory_alerts_company_id_idx" ON "inventory_alerts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "inventory_alerts_company_alert_type_is_read_idx" ON "inventory_alerts" USING btree ("company_id","alert_type","is_read");--> statement-breakpoint
CREATE INDEX "inventory_valuation_snapshots_company_id_idx" ON "inventory_valuation_snapshots" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "inventory_valuation_snapshots_company_snapshot_date_idx" ON "inventory_valuation_snapshots" USING btree ("company_id","snapshot_date");--> statement-breakpoint
