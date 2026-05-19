DO $$
BEGIN
  CREATE TYPE "public"."employee_employment_type" AS ENUM('full_time', 'part_time', 'contract');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."employee_salary_type" AS ENUM('monthly', 'daily', 'hourly');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."employee_status" AS ENUM('active', 'inactive', 'resigned', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payroll_run_status" AS ENUM('draft', 'generated', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payroll_item_payment_status" AS ENUM('unpaid', 'partial', 'paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payroll_payment_mode" AS ENUM('cash', 'bank', 'upi', 'cheque', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payroll_item_status" AS ENUM('generated', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  CREATE TYPE "public"."payroll_bonus_deduction_type" AS ENUM('bonus', 'deduction');
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;--> statement-breakpoint

CREATE TABLE "employees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "employee_code" text NOT NULL,
  "full_name" text NOT NULL,
  "mobile" text NOT NULL,
  "email" text,
  "department" text,
  "designation" text,
  "joining_date" date NOT NULL,
  "employment_type" "employee_employment_type" NOT NULL,
  "salary_type" "employee_salary_type" NOT NULL,
  "pan_number" text,
  "aadhaar_last4" text,
  "address_line1" text,
  "address_line2" text,
  "city" text,
  "state" text,
  "pincode" text,
  "emergency_contact_name" text,
  "emergency_contact_mobile" text,
  "bank_name" text,
  "account_holder_name" text,
  "account_number" text,
  "ifsc_code" text,
  "upi_id" text,
  "status" "employee_status" DEFAULT 'active' NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "employees_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "employees_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "employees_aadhaar_last4_check" CHECK ("employees"."aadhaar_last4" is null OR "employees"."aadhaar_last4" ~ '^[0-9]{4}$')
);
--> statement-breakpoint
CREATE TABLE "employee_salary_structures" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "basic_salary" numeric(14, 2) NOT NULL,
  "hra" numeric(14, 2) DEFAULT '0' NOT NULL,
  "conveyance_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
  "medical_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
  "other_allowance" numeric(14, 2) DEFAULT '0' NOT NULL,
  "pf_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
  "esic_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
  "professional_tax" numeric(14, 2) DEFAULT '0' NOT NULL,
  "tds_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
  "other_deduction" numeric(14, 2) DEFAULT '0' NOT NULL,
  "gross_salary" numeric(14, 2) NOT NULL,
  "total_deductions" numeric(14, 2) NOT NULL,
  "net_salary" numeric(14, 2) NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "employee_salary_structures_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "employee_salary_structures_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "employee_salary_structures_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "employee_salary_structures_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "employee_salary_structures_basic_salary_check" CHECK ("employee_salary_structures"."basic_salary" >= 0),
  CONSTRAINT "employee_salary_structures_hra_check" CHECK ("employee_salary_structures"."hra" >= 0),
  CONSTRAINT "employee_salary_structures_conveyance_allowance_check" CHECK ("employee_salary_structures"."conveyance_allowance" >= 0),
  CONSTRAINT "employee_salary_structures_medical_allowance_check" CHECK ("employee_salary_structures"."medical_allowance" >= 0),
  CONSTRAINT "employee_salary_structures_other_allowance_check" CHECK ("employee_salary_structures"."other_allowance" >= 0),
  CONSTRAINT "employee_salary_structures_pf_deduction_check" CHECK ("employee_salary_structures"."pf_deduction" >= 0),
  CONSTRAINT "employee_salary_structures_esic_deduction_check" CHECK ("employee_salary_structures"."esic_deduction" >= 0),
  CONSTRAINT "employee_salary_structures_professional_tax_check" CHECK ("employee_salary_structures"."professional_tax" >= 0),
  CONSTRAINT "employee_salary_structures_tds_deduction_check" CHECK ("employee_salary_structures"."tds_deduction" >= 0),
  CONSTRAINT "employee_salary_structures_other_deduction_check" CHECK ("employee_salary_structures"."other_deduction" >= 0),
  CONSTRAINT "employee_salary_structures_gross_salary_check" CHECK ("employee_salary_structures"."gross_salary" >= 0),
  CONSTRAINT "employee_salary_structures_total_deductions_check" CHECK ("employee_salary_structures"."total_deductions" >= 0),
  CONSTRAINT "employee_salary_structures_net_salary_check" CHECK ("employee_salary_structures"."net_salary" >= 0),
  CONSTRAINT "employee_salary_structures_effective_date_check" CHECK ("employee_salary_structures"."effective_to" is null OR "employee_salary_structures"."effective_to" >= "employee_salary_structures"."effective_from")
);
--> statement-breakpoint
CREATE TABLE "employee_attendance" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "payroll_month" text NOT NULL,
  "working_days" numeric(6, 2) NOT NULL,
  "present_days" numeric(6, 2) NOT NULL,
  "absent_days" numeric(6, 2) DEFAULT '0' NOT NULL,
  "paid_leave_days" numeric(6, 2) DEFAULT '0' NOT NULL,
  "unpaid_leave_days" numeric(6, 2) DEFAULT '0' NOT NULL,
  "half_days" numeric(6, 2) DEFAULT '0' NOT NULL,
  "overtime_hours" numeric(8, 2) DEFAULT '0' NOT NULL,
  "remarks" text,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "employee_attendance_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "employee_attendance_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "employee_attendance_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "employee_attendance_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "employee_attendance_working_days_check" CHECK ("employee_attendance"."working_days" > 0),
  CONSTRAINT "employee_attendance_present_days_check" CHECK ("employee_attendance"."present_days" >= 0),
  CONSTRAINT "employee_attendance_absent_days_check" CHECK ("employee_attendance"."absent_days" >= 0),
  CONSTRAINT "employee_attendance_paid_leave_days_check" CHECK ("employee_attendance"."paid_leave_days" >= 0),
  CONSTRAINT "employee_attendance_unpaid_leave_days_check" CHECK ("employee_attendance"."unpaid_leave_days" >= 0),
  CONSTRAINT "employee_attendance_half_days_check" CHECK ("employee_attendance"."half_days" >= 0),
  CONSTRAINT "employee_attendance_overtime_hours_check" CHECK ("employee_attendance"."overtime_hours" >= 0),
  CONSTRAINT "employee_attendance_payroll_month_check" CHECK ("employee_attendance"."payroll_month" ~ '^[0-9]{4}-[0-9]{2}$')
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "run_number" text NOT NULL,
  "payroll_month" text NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "status" "payroll_run_status" DEFAULT 'draft' NOT NULL,
  "total_employees" integer DEFAULT 0 NOT NULL,
  "gross_total" numeric(14, 2) DEFAULT '0' NOT NULL,
  "deduction_total" numeric(14, 2) DEFAULT '0' NOT NULL,
  "bonus_total" numeric(14, 2) DEFAULT '0' NOT NULL,
  "net_payable_total" numeric(14, 2) DEFAULT '0' NOT NULL,
  "paid_total" numeric(14, 2) DEFAULT '0' NOT NULL,
  "notes" text,
  "generated_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancellation_reason" text,
  "accounting_event_created" boolean DEFAULT false NOT NULL,
  "created_by" uuid,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payroll_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "payroll_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "payroll_runs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "payroll_runs_payroll_month_check" CHECK ("payroll_runs"."payroll_month" ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT "payroll_runs_period_check" CHECK ("payroll_runs"."period_end" >= "payroll_runs"."period_start"),
  CONSTRAINT "payroll_runs_gross_total_check" CHECK ("payroll_runs"."gross_total" >= 0),
  CONSTRAINT "payroll_runs_deduction_total_check" CHECK ("payroll_runs"."deduction_total" >= 0),
  CONSTRAINT "payroll_runs_bonus_total_check" CHECK ("payroll_runs"."bonus_total" >= 0),
  CONSTRAINT "payroll_runs_net_payable_total_check" CHECK ("payroll_runs"."net_payable_total" >= 0),
  CONSTRAINT "payroll_runs_paid_total_check" CHECK ("payroll_runs"."paid_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payroll_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "payroll_run_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "employee_name_snapshot" text NOT NULL,
  "employee_code_snapshot" text NOT NULL,
  "department_snapshot" text,
  "designation_snapshot" text,
  "working_days" numeric(6, 2) NOT NULL,
  "payable_days" numeric(6, 2) NOT NULL,
  "basic_salary" numeric(14, 2) NOT NULL,
  "hra" numeric(14, 2) DEFAULT '0' NOT NULL,
  "allowances_total" numeric(14, 2) DEFAULT '0' NOT NULL,
  "bonus_total" numeric(14, 2) DEFAULT '0' NOT NULL,
  "gross_salary" numeric(14, 2) NOT NULL,
  "deductions_total" numeric(14, 2) DEFAULT '0' NOT NULL,
  "net_salary" numeric(14, 2) NOT NULL,
  "paid_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
  "payment_status" "payroll_item_payment_status" DEFAULT 'unpaid' NOT NULL,
  "payment_mode" "payroll_payment_mode",
  "payment_reference" text,
  "paid_at" timestamp with time zone,
  "status" "payroll_item_status" DEFAULT 'generated' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payroll_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "payroll_items_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "payroll_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "payroll_items_working_days_check" CHECK ("payroll_items"."working_days" > 0),
  CONSTRAINT "payroll_items_payable_days_check" CHECK ("payroll_items"."payable_days" >= 0),
  CONSTRAINT "payroll_items_basic_salary_check" CHECK ("payroll_items"."basic_salary" >= 0),
  CONSTRAINT "payroll_items_hra_check" CHECK ("payroll_items"."hra" >= 0),
  CONSTRAINT "payroll_items_allowances_total_check" CHECK ("payroll_items"."allowances_total" >= 0),
  CONSTRAINT "payroll_items_bonus_total_check" CHECK ("payroll_items"."bonus_total" >= 0),
  CONSTRAINT "payroll_items_gross_salary_check" CHECK ("payroll_items"."gross_salary" >= 0),
  CONSTRAINT "payroll_items_deductions_total_check" CHECK ("payroll_items"."deductions_total" >= 0),
  CONSTRAINT "payroll_items_net_salary_check" CHECK ("payroll_items"."net_salary" >= 0),
  CONSTRAINT "payroll_items_paid_amount_check" CHECK ("payroll_items"."paid_amount" >= 0 AND "payroll_items"."paid_amount" <= "payroll_items"."net_salary")
);
--> statement-breakpoint
CREATE TABLE "payroll_bonus_deductions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "payroll_item_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "type" "payroll_bonus_deduction_type" NOT NULL,
  "name" text NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "taxable" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payroll_bonus_deductions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "payroll_bonus_deductions_payroll_item_id_payroll_items_id_fk" FOREIGN KEY ("payroll_item_id") REFERENCES "public"."payroll_items"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "payroll_bonus_deductions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "payroll_bonus_deductions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "payroll_bonus_deductions_amount_check" CHECK ("payroll_bonus_deductions"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "salary_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "payroll_run_id" uuid NOT NULL,
  "payroll_item_id" uuid,
  "employee_id" uuid NOT NULL,
  "payment_date" date NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "payment_mode" "payroll_payment_mode" NOT NULL,
  "bank_account_id" uuid,
  "reference_number" text,
  "notes" text,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "salary_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "salary_payments_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "salary_payments_payroll_item_id_payroll_items_id_fk" FOREIGN KEY ("payroll_item_id") REFERENCES "public"."payroll_items"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "salary_payments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "salary_payments_bank_account_id_company_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."company_bank_accounts"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "salary_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "salary_payments_amount_check" CHECK ("salary_payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "salary_slip_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "payroll_item_id" uuid NOT NULL,
  "generated_by" uuid,
  "file_url" text,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "salary_slip_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "salary_slip_logs_payroll_item_id_payroll_items_id_fk" FOREIGN KEY ("payroll_item_id") REFERENCES "public"."payroll_items"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "salary_slip_logs_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint

CREATE INDEX "employees_company_id_idx" ON "employees" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "employees_company_full_name_idx" ON "employees" USING btree ("company_id","full_name");--> statement-breakpoint
CREATE INDEX "employees_company_department_idx" ON "employees" USING btree ("company_id","department");--> statement-breakpoint
CREATE INDEX "employees_company_status_idx" ON "employees" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_company_employee_code_unique_idx" ON "employees" USING btree ("company_id","employee_code");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_company_mobile_unique_idx" ON "employees" USING btree ("company_id","mobile") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_company_email_unique_idx" ON "employees" USING btree ("company_id","email") WHERE "email" is not null AND "deleted_at" is null;--> statement-breakpoint

CREATE INDEX "employee_salary_structures_company_employee_idx" ON "employee_salary_structures" USING btree ("company_id","employee_id");--> statement-breakpoint
CREATE INDEX "employee_salary_structures_company_employee_active_idx" ON "employee_salary_structures" USING btree ("company_id","employee_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_salary_structures_company_employee_active_unique_idx" ON "employee_salary_structures" USING btree ("company_id","employee_id") WHERE "is_active" = true;--> statement-breakpoint

CREATE UNIQUE INDEX "employee_attendance_company_employee_month_unique_idx" ON "employee_attendance" USING btree ("company_id","employee_id","payroll_month");--> statement-breakpoint
CREATE INDEX "employee_attendance_company_month_idx" ON "employee_attendance" USING btree ("company_id","payroll_month");--> statement-breakpoint

CREATE UNIQUE INDEX "payroll_runs_company_run_number_unique_idx" ON "payroll_runs" USING btree ("company_id","run_number");--> statement-breakpoint
CREATE INDEX "payroll_runs_company_month_status_idx" ON "payroll_runs" USING btree ("company_id","payroll_month","status");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_runs_company_month_active_unique_idx" ON "payroll_runs" USING btree ("company_id","payroll_month") WHERE "status" <> 'cancelled';--> statement-breakpoint

CREATE UNIQUE INDEX "payroll_items_company_run_employee_unique_idx" ON "payroll_items" USING btree ("company_id","payroll_run_id","employee_id");--> statement-breakpoint
CREATE INDEX "payroll_items_company_run_idx" ON "payroll_items" USING btree ("company_id","payroll_run_id");--> statement-breakpoint
CREATE INDEX "payroll_items_company_employee_idx" ON "payroll_items" USING btree ("company_id","employee_id");--> statement-breakpoint
CREATE INDEX "payroll_items_company_payment_status_idx" ON "payroll_items" USING btree ("company_id","payment_status");--> statement-breakpoint

CREATE INDEX "payroll_bonus_deductions_company_item_idx" ON "payroll_bonus_deductions" USING btree ("company_id","payroll_item_id");--> statement-breakpoint
CREATE INDEX "payroll_bonus_deductions_company_employee_idx" ON "payroll_bonus_deductions" USING btree ("company_id","employee_id");--> statement-breakpoint

CREATE INDEX "salary_payments_company_employee_payment_date_idx" ON "salary_payments" USING btree ("company_id","employee_id","payment_date");--> statement-breakpoint
CREATE INDEX "salary_payments_company_run_idx" ON "salary_payments" USING btree ("company_id","payroll_run_id");--> statement-breakpoint
CREATE INDEX "salary_payments_company_item_idx" ON "salary_payments" USING btree ("company_id","payroll_item_id");--> statement-breakpoint

CREATE INDEX "salary_slip_logs_company_item_idx" ON "salary_slip_logs" USING btree ("company_id","payroll_item_id");--> statement-breakpoint
CREATE INDEX "salary_slip_logs_company_generated_at_idx" ON "salary_slip_logs" USING btree ("company_id","generated_at");
