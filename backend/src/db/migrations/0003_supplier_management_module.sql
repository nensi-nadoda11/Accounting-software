CREATE TYPE "public"."supplier_type" AS ENUM('individual', 'business', 'manufacturer', 'distributor', 'wholesaler');--> statement-breakpoint
CREATE TYPE "public"."supplier_tax_type" AS ENUM('registered', 'unregistered', 'composition');--> statement-breakpoint
CREATE TYPE "public"."supplier_opening_balance_type" AS ENUM('debit', 'credit', 'none');--> statement-breakpoint
CREATE TYPE "public"."supplier_status" AS ENUM('active', 'inactive', 'blocked', 'deleted');--> statement-breakpoint

CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"supplier_code" text NOT NULL,
	"name" text NOT NULL,
	"supplier_type" "supplier_type" NOT NULL,
	"business_name" text,
	"contact_person" text,
	"mobile" text NOT NULL,
	"alternate_mobile" text,
	"email" text,
	"website" text,
	"gst_number" text,
	"pan_number" text,
	"tan_number" text,
	"tax_type" "supplier_tax_type" DEFAULT 'unregistered' NOT NULL,
	"gst_state" text,
	"reverse_charge_applicable" boolean DEFAULT false NOT NULL,
	"msme_registered" boolean DEFAULT false NOT NULL,
	"billing_address_line1" text,
	"billing_address_line2" text,
	"billing_city" text,
	"billing_state" text,
	"billing_pincode" text,
	"billing_country" text DEFAULT 'India' NOT NULL,
	"shipping_address_line1" text,
	"shipping_address_line2" text,
	"shipping_city" text,
	"shipping_state" text,
	"shipping_pincode" text,
	"shipping_country" text DEFAULT 'India' NOT NULL,
	"same_as_billing" boolean DEFAULT true NOT NULL,
	"opening_balance_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"opening_balance_type" "supplier_opening_balance_type" DEFAULT 'none' NOT NULL,
	"credit_limit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit_days" integer DEFAULT 0 NOT NULL,
	"payment_terms" text,
	"default_gst_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"default_discount" numeric(5, 2) DEFAULT '0' NOT NULL,
	"bank_name" text,
	"account_holder_name" text,
	"account_number" text,
	"ifsc_code" text,
	"bank_branch" text,
	"upi_id" text,
	"status" "supplier_status" DEFAULT 'active' NOT NULL,
	"is_blacklisted" boolean DEFAULT false NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "suppliers_opening_balance_amount_check" CHECK ("opening_balance_amount" >= 0),
	CONSTRAINT "suppliers_credit_limit_check" CHECK ("credit_limit" >= 0),
	CONSTRAINT "suppliers_credit_days_check" CHECK ("credit_days" >= 0 AND "credit_days" <= 365),
	CONSTRAINT "suppliers_default_gst_rate_check" CHECK ("default_gst_rate" >= 0 AND "default_gst_rate" <= 28),
	CONSTRAINT "suppliers_default_discount_check" CHECK ("default_discount" >= 0 AND "default_discount" <= 100)
);
--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "suppliers_company_id_idx" ON "suppliers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "suppliers_company_gst_number_idx" ON "suppliers" USING btree ("company_id", "gst_number");--> statement-breakpoint
CREATE INDEX "suppliers_company_name_idx" ON "suppliers" USING btree ("company_id", "name");--> statement-breakpoint
CREATE INDEX "suppliers_company_status_idx" ON "suppliers" USING btree ("company_id", "status");--> statement-breakpoint
CREATE INDEX "suppliers_company_supplier_type_idx" ON "suppliers" USING btree ("company_id", "supplier_type");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_company_supplier_code_unique_idx" ON "suppliers" USING btree ("company_id", "supplier_code");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_company_mobile_unique_idx" ON "suppliers" USING btree ("company_id", "mobile") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_company_email_unique_idx" ON "suppliers" USING btree ("company_id", "email") WHERE "email" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint
