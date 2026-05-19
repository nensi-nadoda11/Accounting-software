import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { companyBankAccounts } from "./company-settings";
import { users } from "./users";

export const employeeEmploymentTypeEnum = pgEnum("employee_employment_type", ["full_time", "part_time", "contract"]);
export const employeeSalaryTypeEnum = pgEnum("employee_salary_type", ["monthly", "daily", "hourly"]);
export const employeeStatusEnum = pgEnum("employee_status", ["active", "inactive", "resigned", "deleted"]);
export const payrollRunStatusEnum = pgEnum("payroll_run_status", ["draft", "generated", "paid", "cancelled"]);
export const payrollItemPaymentStatusEnum = pgEnum("payroll_item_payment_status", ["unpaid", "partial", "paid"]);
export const payrollPaymentModeEnum = pgEnum("payroll_payment_mode", ["cash", "bank", "upi", "cheque", "other"]);
export const payrollItemStatusEnum = pgEnum("payroll_item_status", ["generated", "paid", "cancelled"]);
export const payrollBonusDeductionTypeEnum = pgEnum("payroll_bonus_deduction_type", ["bonus", "deduction"]);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeCode: text("employee_code").notNull(),
    fullName: text("full_name").notNull(),
    mobile: text("mobile").notNull(),
    email: text("email"),
    department: text("department"),
    designation: text("designation"),
    joiningDate: date("joining_date", { mode: "date" }).notNull(),
    employmentType: employeeEmploymentTypeEnum("employment_type").notNull(),
    salaryType: employeeSalaryTypeEnum("salary_type").notNull(),
    panNumber: text("pan_number"),
    aadhaarLast4: text("aadhaar_last4"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactMobile: text("emergency_contact_mobile"),
    bankName: text("bank_name"),
    accountHolderName: text("account_holder_name"),
    accountNumber: text("account_number"),
    ifscCode: text("ifsc_code"),
    upiId: text("upi_id"),
    status: employeeStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("employees_company_id_idx").on(table.companyId),
    companyNameIdx: index("employees_company_full_name_idx").on(table.companyId, table.fullName),
    companyDepartmentIdx: index("employees_company_department_idx").on(table.companyId, table.department),
    companyStatusIdx: index("employees_company_status_idx").on(table.companyId, table.status),
    companyEmployeeCodeUniqueIdx: uniqueIndex("employees_company_employee_code_unique_idx").on(
      table.companyId,
      table.employeeCode
    ),
    companyMobileUniqueIdx: uniqueIndex("employees_company_mobile_unique_idx")
      .on(table.companyId, table.mobile)
      .where(sql`${table.deletedAt} is null`),
    companyEmailUniqueIdx: uniqueIndex("employees_company_email_unique_idx")
      .on(table.companyId, table.email)
      .where(sql`${table.email} is not null AND ${table.deletedAt} is null`),
    aadhaarLast4Check: check("employees_aadhaar_last4_check", sql`${table.aadhaarLast4} is null OR ${table.aadhaarLast4} ~ '^[0-9]{4}$'`)
  })
);

export const employeeSalaryStructures = pgTable(
  "employee_salary_structures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    basicSalary: numeric("basic_salary", { precision: 14, scale: 2 }).notNull(),
    hra: numeric("hra", { precision: 14, scale: 2 }).notNull().default("0"),
    conveyanceAllowance: numeric("conveyance_allowance", { precision: 14, scale: 2 }).notNull().default("0"),
    medicalAllowance: numeric("medical_allowance", { precision: 14, scale: 2 }).notNull().default("0"),
    otherAllowance: numeric("other_allowance", { precision: 14, scale: 2 }).notNull().default("0"),
    pfDeduction: numeric("pf_deduction", { precision: 14, scale: 2 }).notNull().default("0"),
    esicDeduction: numeric("esic_deduction", { precision: 14, scale: 2 }).notNull().default("0"),
    professionalTax: numeric("professional_tax", { precision: 14, scale: 2 }).notNull().default("0"),
    tdsDeduction: numeric("tds_deduction", { precision: 14, scale: 2 }).notNull().default("0"),
    otherDeduction: numeric("other_deduction", { precision: 14, scale: 2 }).notNull().default("0"),
    grossSalary: numeric("gross_salary", { precision: 14, scale: 2 }).notNull(),
    totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }).notNull(),
    netSalary: numeric("net_salary", { precision: 14, scale: 2 }).notNull(),
    effectiveFrom: date("effective_from", { mode: "date" }).notNull(),
    effectiveTo: date("effective_to", { mode: "date" }),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyEmployeeIdx: index("employee_salary_structures_company_employee_idx").on(table.companyId, table.employeeId),
    companyEmployeeActiveIdx: index("employee_salary_structures_company_employee_active_idx").on(
      table.companyId,
      table.employeeId,
      table.isActive
    ),
    activeUniqueIdx: uniqueIndex("employee_salary_structures_company_employee_active_unique_idx")
      .on(table.companyId, table.employeeId)
      .where(sql`${table.isActive} = true`),
    basicSalaryCheck: check("employee_salary_structures_basic_salary_check", sql`${table.basicSalary} >= 0`),
    hraCheck: check("employee_salary_structures_hra_check", sql`${table.hra} >= 0`),
    conveyanceAllowanceCheck: check(
      "employee_salary_structures_conveyance_allowance_check",
      sql`${table.conveyanceAllowance} >= 0`
    ),
    medicalAllowanceCheck: check("employee_salary_structures_medical_allowance_check", sql`${table.medicalAllowance} >= 0`),
    otherAllowanceCheck: check("employee_salary_structures_other_allowance_check", sql`${table.otherAllowance} >= 0`),
    pfDeductionCheck: check("employee_salary_structures_pf_deduction_check", sql`${table.pfDeduction} >= 0`),
    esicDeductionCheck: check("employee_salary_structures_esic_deduction_check", sql`${table.esicDeduction} >= 0`),
    professionalTaxCheck: check("employee_salary_structures_professional_tax_check", sql`${table.professionalTax} >= 0`),
    tdsDeductionCheck: check("employee_salary_structures_tds_deduction_check", sql`${table.tdsDeduction} >= 0`),
    otherDeductionCheck: check("employee_salary_structures_other_deduction_check", sql`${table.otherDeduction} >= 0`),
    grossSalaryCheck: check("employee_salary_structures_gross_salary_check", sql`${table.grossSalary} >= 0`),
    totalDeductionsCheck: check("employee_salary_structures_total_deductions_check", sql`${table.totalDeductions} >= 0`),
    netSalaryCheck: check("employee_salary_structures_net_salary_check", sql`${table.netSalary} >= 0`),
    effectiveDateCheck: check(
      "employee_salary_structures_effective_date_check",
      sql`${table.effectiveTo} is null OR ${table.effectiveTo} >= ${table.effectiveFrom}`
    )
  })
);

export const employeeAttendance = pgTable(
  "employee_attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    payrollMonth: text("payroll_month").notNull(),
    workingDays: numeric("working_days", { precision: 6, scale: 2 }).notNull(),
    presentDays: numeric("present_days", { precision: 6, scale: 2 }).notNull(),
    absentDays: numeric("absent_days", { precision: 6, scale: 2 }).notNull().default("0"),
    paidLeaveDays: numeric("paid_leave_days", { precision: 6, scale: 2 }).notNull().default("0"),
    unpaidLeaveDays: numeric("unpaid_leave_days", { precision: 6, scale: 2 }).notNull().default("0"),
    halfDays: numeric("half_days", { precision: 6, scale: 2 }).notNull().default("0"),
    overtimeHours: numeric("overtime_hours", { precision: 8, scale: 2 }).notNull().default("0"),
    remarks: text("remarks"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyEmployeeMonthUniqueIdx: uniqueIndex("employee_attendance_company_employee_month_unique_idx").on(
      table.companyId,
      table.employeeId,
      table.payrollMonth
    ),
    companyMonthIdx: index("employee_attendance_company_month_idx").on(table.companyId, table.payrollMonth),
    workingDaysCheck: check("employee_attendance_working_days_check", sql`${table.workingDays} > 0`),
    presentDaysCheck: check("employee_attendance_present_days_check", sql`${table.presentDays} >= 0`),
    absentDaysCheck: check("employee_attendance_absent_days_check", sql`${table.absentDays} >= 0`),
    paidLeaveDaysCheck: check("employee_attendance_paid_leave_days_check", sql`${table.paidLeaveDays} >= 0`),
    unpaidLeaveDaysCheck: check("employee_attendance_unpaid_leave_days_check", sql`${table.unpaidLeaveDays} >= 0`),
    halfDaysCheck: check("employee_attendance_half_days_check", sql`${table.halfDays} >= 0`),
    overtimeHoursCheck: check("employee_attendance_overtime_hours_check", sql`${table.overtimeHours} >= 0`),
    payrollMonthCheck: check("employee_attendance_payroll_month_check", sql`${table.payrollMonth} ~ '^[0-9]{4}-[0-9]{2}$'`)
  })
);

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    runNumber: text("run_number").notNull(),
    payrollMonth: text("payroll_month").notNull(),
    periodStart: date("period_start", { mode: "date" }).notNull(),
    periodEnd: date("period_end", { mode: "date" }).notNull(),
    status: payrollRunStatusEnum("status").notNull().default("draft"),
    totalEmployees: integer("total_employees").notNull().default(0),
    grossTotal: numeric("gross_total", { precision: 14, scale: 2 }).notNull().default("0"),
    deductionTotal: numeric("deduction_total", { precision: 14, scale: 2 }).notNull().default("0"),
    bonusTotal: numeric("bonus_total", { precision: 14, scale: 2 }).notNull().default("0"),
    netPayableTotal: numeric("net_payable_total", { precision: 14, scale: 2 }).notNull().default("0"),
    paidTotal: numeric("paid_total", { precision: 14, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    accountingEventCreated: boolean("accounting_event_created").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyRunNumberUniqueIdx: uniqueIndex("payroll_runs_company_run_number_unique_idx").on(table.companyId, table.runNumber),
    companyMonthStatusIdx: index("payroll_runs_company_month_status_idx").on(table.companyId, table.payrollMonth, table.status),
    companyMonthUniqueIdx: uniqueIndex("payroll_runs_company_month_active_unique_idx")
      .on(table.companyId, table.payrollMonth)
      .where(sql`${table.status} <> 'cancelled'`),
    payrollMonthCheck: check("payroll_runs_payroll_month_check", sql`${table.payrollMonth} ~ '^[0-9]{4}-[0-9]{2}$'`),
    periodCheck: check("payroll_runs_period_check", sql`${table.periodEnd} >= ${table.periodStart}`),
    grossTotalCheck: check("payroll_runs_gross_total_check", sql`${table.grossTotal} >= 0`),
    deductionTotalCheck: check("payroll_runs_deduction_total_check", sql`${table.deductionTotal} >= 0`),
    bonusTotalCheck: check("payroll_runs_bonus_total_check", sql`${table.bonusTotal} >= 0`),
    netPayableTotalCheck: check("payroll_runs_net_payable_total_check", sql`${table.netPayableTotal} >= 0`),
    paidTotalCheck: check("payroll_runs_paid_total_check", sql`${table.paidTotal} >= 0`)
  })
);

export const payrollItems = pgTable(
  "payroll_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    employeeNameSnapshot: text("employee_name_snapshot").notNull(),
    employeeCodeSnapshot: text("employee_code_snapshot").notNull(),
    departmentSnapshot: text("department_snapshot"),
    designationSnapshot: text("designation_snapshot"),
    workingDays: numeric("working_days", { precision: 6, scale: 2 }).notNull(),
    payableDays: numeric("payable_days", { precision: 6, scale: 2 }).notNull(),
    basicSalary: numeric("basic_salary", { precision: 14, scale: 2 }).notNull(),
    hra: numeric("hra", { precision: 14, scale: 2 }).notNull().default("0"),
    allowancesTotal: numeric("allowances_total", { precision: 14, scale: 2 }).notNull().default("0"),
    bonusTotal: numeric("bonus_total", { precision: 14, scale: 2 }).notNull().default("0"),
    grossSalary: numeric("gross_salary", { precision: 14, scale: 2 }).notNull(),
    deductionsTotal: numeric("deductions_total", { precision: 14, scale: 2 }).notNull().default("0"),
    netSalary: numeric("net_salary", { precision: 14, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    paymentStatus: payrollItemPaymentStatusEnum("payment_status").notNull().default("unpaid"),
    paymentMode: payrollPaymentModeEnum("payment_mode"),
    paymentReference: text("payment_reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    status: payrollItemStatusEnum("status").notNull().default("generated"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyRunEmployeeUniqueIdx: uniqueIndex("payroll_items_company_run_employee_unique_idx").on(
      table.companyId,
      table.payrollRunId,
      table.employeeId
    ),
    companyRunIdx: index("payroll_items_company_run_idx").on(table.companyId, table.payrollRunId),
    companyEmployeeIdx: index("payroll_items_company_employee_idx").on(table.companyId, table.employeeId),
    paymentStatusIdx: index("payroll_items_company_payment_status_idx").on(table.companyId, table.paymentStatus),
    workingDaysCheck: check("payroll_items_working_days_check", sql`${table.workingDays} > 0`),
    payableDaysCheck: check("payroll_items_payable_days_check", sql`${table.payableDays} >= 0`),
    basicSalaryCheck: check("payroll_items_basic_salary_check", sql`${table.basicSalary} >= 0`),
    hraCheck: check("payroll_items_hra_check", sql`${table.hra} >= 0`),
    allowancesTotalCheck: check("payroll_items_allowances_total_check", sql`${table.allowancesTotal} >= 0`),
    bonusTotalCheck: check("payroll_items_bonus_total_check", sql`${table.bonusTotal} >= 0`),
    grossSalaryCheck: check("payroll_items_gross_salary_check", sql`${table.grossSalary} >= 0`),
    deductionsTotalCheck: check("payroll_items_deductions_total_check", sql`${table.deductionsTotal} >= 0`),
    netSalaryCheck: check("payroll_items_net_salary_check", sql`${table.netSalary} >= 0`),
    paidAmountCheck: check("payroll_items_paid_amount_check", sql`${table.paidAmount} >= 0 AND ${table.paidAmount} <= ${table.netSalary}`)
  })
);

export const payrollBonusDeductions = pgTable(
  "payroll_bonus_deductions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    payrollItemId: uuid("payroll_item_id")
      .notNull()
      .references(() => payrollItems.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    type: payrollBonusDeductionTypeEnum("type").notNull(),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    taxable: boolean("taxable").notNull().default(true),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyItemIdx: index("payroll_bonus_deductions_company_item_idx").on(table.companyId, table.payrollItemId),
    companyEmployeeIdx: index("payroll_bonus_deductions_company_employee_idx").on(table.companyId, table.employeeId),
    amountCheck: check("payroll_bonus_deductions_amount_check", sql`${table.amount} >= 0`)
  })
);

export const salaryPayments = pgTable(
  "salary_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    payrollRunId: uuid("payroll_run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "restrict" }),
    payrollItemId: uuid("payroll_item_id").references(() => payrollItems.id, { onDelete: "set null" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    paymentDate: date("payment_date", { mode: "date" }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMode: payrollPaymentModeEnum("payment_mode").notNull(),
    bankAccountId: uuid("bank_account_id").references(() => companyBankAccounts.id, { onDelete: "set null" }),
    referenceNumber: text("reference_number"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyEmployeePaymentDateIdx: index("salary_payments_company_employee_payment_date_idx").on(
      table.companyId,
      table.employeeId,
      table.paymentDate
    ),
    companyRunIdx: index("salary_payments_company_run_idx").on(table.companyId, table.payrollRunId),
    companyItemIdx: index("salary_payments_company_item_idx").on(table.companyId, table.payrollItemId),
    amountCheck: check("salary_payments_amount_check", sql`${table.amount} > 0`)
  })
);

export const salarySlipLogs = pgTable(
  "salary_slip_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    payrollItemId: uuid("payroll_item_id")
      .notNull()
      .references(() => payrollItems.id, { onDelete: "cascade" }),
    generatedBy: uuid("generated_by").references(() => users.id, { onDelete: "set null" }),
    fileUrl: text("file_url"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyItemIdx: index("salary_slip_logs_company_item_idx").on(table.companyId, table.payrollItemId),
    companyGeneratedAtIdx: index("salary_slip_logs_company_generated_at_idx").on(table.companyId, table.generatedAt)
  })
);
