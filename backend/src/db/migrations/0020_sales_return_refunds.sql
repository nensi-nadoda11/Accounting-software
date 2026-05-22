CREATE TABLE "sales_return_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sales_return_id" uuid NOT NULL,
	"customer_id" uuid,
	"refund_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"payment_mode" "sales_payment_mode" NOT NULL,
	"bank_account_id" uuid,
	"reference_number" text,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_return_refunds_amount_check" CHECK ("sales_return_refunds"."amount" > 0)
);
ALTER TABLE "sales_return_refunds" ADD CONSTRAINT "sales_return_refunds_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sales_return_refunds" ADD CONSTRAINT "sales_return_refunds_sales_return_id_sales_returns_id_fk" FOREIGN KEY ("sales_return_id") REFERENCES "public"."sales_returns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sales_return_refunds" ADD CONSTRAINT "sales_return_refunds_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "sales_return_refunds" ADD CONSTRAINT "sales_return_refunds_bank_account_id_company_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."company_bank_accounts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "sales_return_refunds" ADD CONSTRAINT "sales_return_refunds_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "sales_return_refunds_company_id_idx" ON "sales_return_refunds" USING btree ("company_id");
CREATE INDEX "sales_return_refunds_sales_return_id_idx" ON "sales_return_refunds" USING btree ("sales_return_id");
CREATE INDEX "sales_return_refunds_customer_id_idx" ON "sales_return_refunds" USING btree ("customer_id");
CREATE INDEX "sales_return_refunds_refund_date_idx" ON "sales_return_refunds" USING btree ("refund_date");
