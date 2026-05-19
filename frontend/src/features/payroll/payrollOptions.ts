import type {
  EmployeeStatus,
  EmploymentType,
  PayrollBonusDeductionType,
  PayrollItemPaymentStatus,
  PayrollPaymentMode,
  PayrollRunStatus,
  SalaryType,
} from "../../types/payroll";

export const PAYROLL_TAB_OPTIONS = [
  { id: "employees", label: "Employees" },
  { id: "salary-structures", label: "Salary Structures" },
  { id: "attendance", label: "Attendance" },
  { id: "payroll-runs", label: "Payroll Runs" },
  { id: "salary-payments", label: "Salary Payments" },
  { id: "salary-slips", label: "Salary Slips" },
  { id: "reports", label: "Reports" },
] as const;

export const PAYROLL_REPORT_OPTIONS = [
  { id: "monthly", label: "Monthly Payroll" },
  { id: "employee", label: "Employee Wise" },
  { id: "department", label: "Department Wise" },
  { id: "bonus-deductions", label: "Bonus/Deduction" },
  { id: "unpaid", label: "Unpaid Salary" },
  { id: "payment", label: "Salary Payments" },
] as const;

export const EMPLOYMENT_TYPE_OPTIONS: Array<{ value: EmploymentType; label: string }> = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
];

export const SALARY_TYPE_OPTIONS: Array<{ value: SalaryType; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "daily", label: "Daily" },
  { value: "hourly", label: "Hourly" },
];

export const EMPLOYEE_STATUS_OPTIONS: Array<{ value: EmployeeStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "resigned", label: "Resigned" },
  { value: "deleted", label: "Deleted" },
];

export const PAYROLL_RUN_STATUS_OPTIONS: Array<{ value: PayrollRunStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "generated", label: "Generated" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export const PAYROLL_ITEM_PAYMENT_STATUS_OPTIONS: Array<{ value: PayrollItemPaymentStatus; label: string }> = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
];

export const PAYROLL_PAYMENT_MODE_OPTIONS: Array<{ value: PayrollPaymentMode; label: string }> = [
  { value: "bank", label: "Bank" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export const BONUS_DEDUCTION_TYPE_OPTIONS: Array<{ value: PayrollBonusDeductionType; label: string }> = [
  { value: "bonus", label: "Bonus" },
  { value: "deduction", label: "Deduction" },
];

export const DEFAULT_PAYROLL_PAGE_SIZE = 20;
