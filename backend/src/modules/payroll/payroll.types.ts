export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract"] as const;
export const SALARY_TYPES = ["monthly", "daily", "hourly"] as const;
export const EMPLOYEE_STATUSES = ["active", "inactive", "resigned", "deleted"] as const;
export const PAYROLL_RUN_STATUSES = ["draft", "generated", "paid", "cancelled"] as const;
export const PAYROLL_ITEM_PAYMENT_STATUSES = ["unpaid", "partial", "paid"] as const;
export const PAYROLL_PAYMENT_MODES = ["cash", "bank", "upi", "cheque", "other"] as const;
export const PAYROLL_ITEM_STATUSES = ["generated", "paid", "cancelled"] as const;
export const PAYROLL_BONUS_DEDUCTION_TYPES = ["bonus", "deduction"] as const;
export const PAYROLL_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;

export type PayrollActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type PayrollRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type PayrollExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type SalaryType = (typeof SALARY_TYPES)[number];
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];
export type PayrollRunStatus = (typeof PAYROLL_RUN_STATUSES)[number];
export type PayrollItemPaymentStatus = (typeof PAYROLL_ITEM_PAYMENT_STATUSES)[number];
export type PayrollPaymentMode = (typeof PAYROLL_PAYMENT_MODES)[number];
export type PayrollItemStatus = (typeof PAYROLL_ITEM_STATUSES)[number];
export type PayrollBonusDeductionType = (typeof PAYROLL_BONUS_DEDUCTION_TYPES)[number];
