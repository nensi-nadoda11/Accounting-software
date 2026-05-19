import { z } from "zod";

import {
  BONUS_DEDUCTION_TYPE_OPTIONS,
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  PAYROLL_PAYMENT_MODE_OPTIONS,
  SALARY_TYPE_OPTIONS,
} from "./payrollOptions";

const mobileRegex = /^[6-9]\d{9}$/;
const panRegex = /^[A-Z]{5}\d{4}[A-Z]$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const payrollMonthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

const enumValues = <TValue extends string>(values: TValue[]) => z.enum(values as [TValue, ...TValue[]]);

const numericField = (label: string) =>
  z.coerce.number({ message: `${label} is required` }).min(0, `${label} cannot be negative`);

const paymentModesRequiringBank = new Set(["bank", "upi", "cheque"]);

export const employeeFormSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required"),
  mobile: z.string().trim().regex(mobileRegex, "Enter a valid mobile number"),
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "")
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email"),
  department: z.string().trim().optional().transform((value) => value || ""),
  designation: z.string().trim().optional().transform((value) => value || ""),
  joiningDate: z
    .string()
    .min(1, "Joining date is required")
    .refine((value) => new Date(value).getTime() <= Date.now(), "Joining date cannot be in the future"),
  employmentType: enumValues(EMPLOYMENT_TYPE_OPTIONS.map((option) => option.value)),
  salaryType: enumValues(SALARY_TYPE_OPTIONS.map((option) => option.value)),
  panNumber: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.toUpperCase() : ""))
    .refine((value) => value === "" || panRegex.test(value), "Enter a valid PAN"),
  aadhaarLast4: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "")
    .refine((value) => value === "" || /^\d{4}$/.test(value), "Enter last 4 Aadhaar digits"),
  addressLine1: z.string().trim().optional().transform((value) => value || ""),
  addressLine2: z.string().trim().optional().transform((value) => value || ""),
  city: z.string().trim().optional().transform((value) => value || ""),
  state: z.string().trim().optional().transform((value) => value || ""),
  pincode: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "")
    .refine((value) => value === "" || /^\d{6}$/.test(value), "Enter a valid pincode"),
  emergencyContactName: z.string().trim().optional().transform((value) => value || ""),
  emergencyContactMobile: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "")
    .refine((value) => value === "" || mobileRegex.test(value), "Enter a valid emergency contact"),
  bankName: z.string().trim().optional().transform((value) => value || ""),
  accountHolderName: z.string().trim().optional().transform((value) => value || ""),
  accountNumber: z.string().trim().optional().transform((value) => value || ""),
  ifscCode: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.toUpperCase() : ""))
    .refine((value) => value === "" || ifscRegex.test(value), "Enter a valid IFSC"),
  upiId: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "")
    .refine((value) => value === "" || upiRegex.test(value), "Enter a valid UPI ID"),
  status: enumValues(EMPLOYEE_STATUS_OPTIONS.map((option) => option.value)),
});

export const salaryStructureFormSchema = z
  .object({
    basicSalary: numericField("Basic"),
    hra: numericField("HRA"),
    conveyanceAllowance: numericField("Conveyance"),
    medicalAllowance: numericField("Medical"),
    otherAllowance: numericField("Other allowance"),
    pfDeduction: numericField("PF"),
    esicDeduction: numericField("ESIC"),
    professionalTax: numericField("Professional tax"),
    tdsDeduction: numericField("TDS"),
    otherDeduction: numericField("Other deduction"),
    effectiveFrom: z.string().min(1, "Effective from is required"),
    effectiveTo: z.string().optional().transform((value) => value || ""),
    isActive: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "Effective to must be after effective from",
      });
    }

    const gross =
      value.basicSalary +
      value.hra +
      value.conveyanceAllowance +
      value.medicalAllowance +
      value.otherAllowance;
    const deductions =
      value.pfDeduction +
      value.esicDeduction +
      value.professionalTax +
      value.tdsDeduction +
      value.otherDeduction;
    if (gross - deductions < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["otherDeduction"],
        message: "Net salary cannot be negative",
      });
    }
  });

export const attendanceFormSchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required"),
    payrollMonth: z.string().regex(payrollMonthRegex, "Enter month as YYYY-MM"),
    workingDays: z.coerce.number().gt(0, "Working days must be greater than 0"),
    presentDays: numericField("Present days"),
    absentDays: numericField("Absent days"),
    paidLeaveDays: numericField("Paid leave"),
    unpaidLeaveDays: numericField("Unpaid leave"),
    halfDays: numericField("Half days"),
    overtimeHours: numericField("Overtime"),
    remarks: z.string().trim().optional().transform((value) => value || null),
  })
  .superRefine((value, ctx) => {
    const total =
      value.presentDays +
      value.absentDays +
      value.paidLeaveDays +
      value.unpaidLeaveDays +
      value.halfDays;

    if (total > value.workingDays) {
      ctx.addIssue({
        code: "custom",
        path: ["workingDays"],
        message: "Attendance totals cannot exceed working days",
      });
    }
  });

export const attendanceBulkFormSchema = z.object({
  payrollMonth: z.string().regex(payrollMonthRegex, "Enter month as YYYY-MM"),
  rows: z.array(attendanceFormSchema),
});

export const payrollRunFormSchema = z
  .object({
    payrollMonth: z.string().regex(payrollMonthRegex, "Payroll month is required"),
    periodStart: z.string().optional().transform((value) => value || ""),
    periodEnd: z.string().optional().transform((value) => value || ""),
    notes: z.string().trim().optional().transform((value) => value || ""),
  })
  .superRefine((value, ctx) => {
    if (value.periodStart && value.periodEnd && value.periodEnd < value.periodStart) {
      ctx.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "Period end must be after period start",
      });
    }
  });

export const bonusDeductionEntrySchema = z.object({
  type: enumValues(BONUS_DEDUCTION_TYPE_OPTIONS.map((option) => option.value)),
  name: z.string().trim().min(1, "Name is required"),
  amount: numericField("Amount"),
  taxable: z.boolean(),
  notes: z.string().trim().optional().transform((value) => value || null),
});

export const bonusDeductionFormSchema = z.object({
  entries: z.array(bonusDeductionEntrySchema),
});

export const salaryPaymentFormSchema = z
  .object({
    amount: z.coerce.number().gt(0, "Amount must be greater than 0"),
    paymentDate: z
      .string()
      .min(1, "Payment date is required")
      .refine((value) => new Date(value).getTime() <= Date.now(), "Payment date cannot be in the future"),
    paymentMode: enumValues(PAYROLL_PAYMENT_MODE_OPTIONS.map((option) => option.value)),
    bankAccountId: z.string().optional().transform((value) => value || ""),
    referenceNumber: z.string().trim().optional().transform((value) => value || ""),
    notes: z.string().trim().optional().transform((value) => value || ""),
  })
  .superRefine((value, ctx) => {
    if (paymentModesRequiringBank.has(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for this payment mode",
      });
    }
  });

export const bulkSalaryPaymentFormSchema = z
  .object({
    paymentDate: z
      .string()
      .min(1, "Payment date is required")
      .refine((value) => new Date(value).getTime() <= Date.now(), "Payment date cannot be in the future"),
    paymentMode: enumValues(PAYROLL_PAYMENT_MODE_OPTIONS.map((option) => option.value)),
    bankAccountId: z.string().optional().transform((value) => value || ""),
    referenceNumber: z.string().trim().optional().transform((value) => value || ""),
    notes: z.string().trim().optional().transform((value) => value || ""),
    payrollItemIds: z.array(z.string()).min(1, "Select at least one employee"),
  })
  .superRefine((value, ctx) => {
    if (paymentModesRequiringBank.has(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for this payment mode",
      });
    }
  });

export const salarySlipEmailFormSchema = z.object({
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "")
    .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email"),
  subject: z.string().trim().optional().transform((value) => value || ""),
  message: z.string().trim().optional().transform((value) => value || ""),
});

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
export type SalaryStructureFormValues = z.infer<typeof salaryStructureFormSchema>;
export type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;
export type AttendanceBulkFormValues = z.infer<typeof attendanceBulkFormSchema>;
export type PayrollRunFormValues = z.infer<typeof payrollRunFormSchema>;
export type BonusDeductionFormValues = z.infer<typeof bonusDeductionFormSchema>;
export type SalaryPaymentFormValues = z.infer<typeof salaryPaymentFormSchema>;
export type BulkSalaryPaymentFormValues = z.infer<typeof bulkSalaryPaymentFormSchema>;
export type SalarySlipEmailFormValues = z.infer<typeof salarySlipEmailFormSchema>;
