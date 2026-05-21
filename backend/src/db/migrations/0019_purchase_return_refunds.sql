CREATE TABLE "purchase_return_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"purchase_return_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"refund_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_mode" "purchase_payment_mode" NOT NULL,
	"bank_account_id" uuid,
	"reference_number" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_return_refunds_amount_check" CHECK ("purchase_return_refunds"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "purchase_return_refunds" ADD CONSTRAINT "purchase_return_refunds_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchase_return_refunds" ADD CONSTRAINT "purchase_return_refunds_purchase_return_id_purchase_returns_id_fk" FOREIGN KEY ("purchase_return_id") REFERENCES "public"."purchase_returns"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchase_return_refunds" ADD CONSTRAINT "purchase_return_refunds_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchase_return_refunds" ADD CONSTRAINT "purchase_return_refunds_bank_account_id_company_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."company_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchase_return_refunds" ADD CONSTRAINT "purchase_return_refunds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "purchase_return_refunds_company_id_idx" ON "purchase_return_refunds" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX "purchase_return_refunds_purchase_return_id_idx" ON "purchase_return_refunds" USING btree ("purchase_return_id");
--> statement-breakpoint
CREATE INDEX "purchase_return_refunds_supplier_id_idx" ON "purchase_return_refunds" USING btree ("supplier_id");
--> statement-breakpoint
CREATE INDEX "purchase_return_refunds_refund_date_idx" ON "purchase_return_refunds" USING btree ("refund_date");
