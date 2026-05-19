import { z } from "zod";

import {
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  PAYROLL_BONUS_DEDUCTION_TYPES,
  PAYROLL_EXPORT_FORMATS,
  PAYROLL_ITEM_PAYMENT_STATUSES,
  PAYROLL_PAYMENT_MODES,
  PAYROLL_RUN_STATUSES,
  SALARY_TYPES
} from "./payroll.types";

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const PINCODE_REGEX = /^\d{6}$/;
const PAYROLL_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const trimToNull = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  return value;
};

const parseDateInput = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return value;
};

const parseBooleanQuery = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return value;
};

const optionalDate = z.preprocess(parseDateInput, z.coerce.date().nullable().optional());
const payrollMonthSchema = z.string().trim().regex(PAYROLL_MONTH_REGEX, "Payroll month must be in YYYY-MM format");
const optionalNullableString = (maxLength: number) =>
  z.preprocess(trimToNull, z.string().trim().max(maxLength).nullable().optional());

const optionalLowercaseEmail = z.preprocess(
  (value) => {
    const normalized = trimToNull(value);
    return typeof normalized === "string" ? normalized.toLowerCase() : normalized;
  },
  z.string().trim().email().max(150).nullable().optional()
);

const decimalNumber = (options?: { min?: number; max?: number }) =>
  z.coerce
    .number()
    .refine((value) => Number.isFinite(value), "Invalid number")
    .refine((value) => (options?.min === undefined ? true : value >= options.min), {
      message: options?.min === undefined ? "Invalid number" : `Value must be at least ${options.min}`
    })
    .refine((value) => (options?.max === undefined ? true : value <= options.max), {
      message: options?.max === undefined ? "Invalid number" : `Value must be at most ${options.max}`
    });

const listBaseQuery = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

const salaryStructureBaseSchema = z.object({
  basicSalary: decimalNumber({ min: 0 }),
  hra: decimalNumber({ min: 0 }).optional().default(0),
  conveyanceAllowance: decimalNumber({ min: 0 }).optional().default(0),
  medicalAllowance: decimalNumber({ min: 0 }).optional().default(0),
  otherAllowance: decimalNumber({ min: 0 }).optional().default(0),
  pfDeduction: decimalNumber({ min: 0 }).optional().default(0),
  esicDeduction: decimalNumber({ min: 0 }).optional().default(0),
  professionalTax: decimalNumber({ min: 0 }).optional().default(0),
  tdsDeduction: decimalNumber({ min: 0 }).optional().default(0),
  otherDeduction: decimalNumber({ min: 0 }).optional().default(0),
  effectiveFrom: z.coerce.date(),
  effectiveTo: optionalDate,
  isActive: z.preprocess(parseBooleanQuery, z.boolean().optional())
});

export const employeeIdParamSchema = z.object({
  id: z.uuid()
});

export const employeeStructureParamSchema = z.object({
  id: z.uuid(),
  structureId: z.uuid()
});

export const attendanceIdParamSchema = z.object({
  id: z.uuid()
});

export const runIdParamSchema = z.object({
  id: z.uuid()
});

export const itemIdParamSchema = z.object({
  id: z.uuid()
});

export const createEmployeeSchema = z
  .object({
    fullName: z.string().trim().min(2).max(150),
    mobile: z.string().trim().regex(INDIAN_MOBILE_REGEX, "Mobile must be a valid 10 digit Indian mobile number"),
    email: optionalLowercaseEmail,
    department: optionalNullableString(100),
    designation: optionalNullableString(100),
    joiningDate: z.coerce.date(),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    salaryType: z.enum(SALARY_TYPES),
    panNumber: z.preprocess(trimToNull, z.string().trim().regex(PAN_REGEX, "PAN must be valid").nullable().optional()),
    aadhaarLast4: z.preprocess(trimToNull, z.string().trim().regex(/^\d{4}$/, "Aadhaar last 4 must be 4 digits").nullable().optional()),
    addressLine1: optionalNullableString(255),
    addressLine2: optionalNullableString(255),
    city: optionalNullableString(100),
    state: optionalNullableString(100),
    pincode: z.preprocess(trimToNull, z.string().trim().regex(PINCODE_REGEX, "Pincode must be 6 digits").nullable().optional()),
    emergencyContactName: optionalNullableString(150),
    emergencyContactMobile: z.preprocess(
      trimToNull,
      z.string().trim().regex(INDIAN_MOBILE_REGEX, "Emergency mobile must be a valid 10 digit Indian mobile number").nullable().optional()
    ),
    bankName: optionalNullableString(150),
    accountHolderName: optionalNullableString(150),
    accountNumber: optionalNullableString(100),
    ifscCode: z.preprocess(trimToNull, z.string().trim().regex(IFSC_REGEX, "IFSC code is invalid").nullable().optional()),
    upiId: z.preprocess(trimToNull, z.string().trim().regex(UPI_REGEX, "UPI ID is invalid").nullable().optional()),
    status: z.enum(EMPLOYEE_STATUSES).optional().default("active")
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.joiningDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["joiningDate"],
        message: "Joining date cannot be in the future"
      });
    }
  });

export const updateEmployeeSchema = createEmployeeSchema.partial().superRefine((value, ctx) => {
  if (value.joiningDate && value.joiningDate.getTime() > Date.now()) {
    ctx.addIssue({
      code: "custom",
      path: ["joiningDate"],
      message: "Joining date cannot be in the future"
    });
  }
});

export const listEmployeesQuerySchema = listBaseQuery.extend({
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  department: z.preprocess(trimToNull, z.string().trim().max(100).nullable().optional()),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional()
});

export const createSalaryStructureSchema = salaryStructureBaseSchema
  .strict()
  .superRefine((value, ctx) => {
    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "effectiveTo must be on or after effectiveFrom"
      });
    }
  });

export const updateSalaryStructureSchema = salaryStructureBaseSchema
  .partial()
  .strict()
  .superRefine((value, ctx) => {
    if (value.effectiveFrom && value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveTo"],
        message: "effectiveTo must be on or after effectiveFrom"
      });
    }
  });

export const listAttendanceQuerySchema = listBaseQuery.extend({
  month: payrollMonthSchema.optional(),
  employeeId: z.uuid().optional(),
  department: z.preprocess(trimToNull, z.string().trim().max(100).nullable().optional())
});

export const createAttendanceSchema = z
  .object({
    employeeId: z.uuid(),
    payrollMonth: payrollMonthSchema,
    workingDays: decimalNumber({ min: Number.EPSILON }),
    presentDays: decimalNumber({ min: 0 }),
    absentDays: decimalNumber({ min: 0 }).optional().default(0),
    paidLeaveDays: decimalNumber({ min: 0 }).optional().default(0),
    unpaidLeaveDays: decimalNumber({ min: 0 }).optional().default(0),
    halfDays: decimalNumber({ min: 0 }).optional().default(0),
    overtimeHours: decimalNumber({ min: 0 }).optional().default(0),
    remarks: optionalNullableString(1000)
  })
  .strict()
  .superRefine((value, ctx) => {
    const total = value.presentDays + value.absentDays + value.paidLeaveDays + value.unpaidLeaveDays + value.halfDays;
    if (total > value.workingDays + 0.0001) {
      ctx.addIssue({
        code: "custom",
        path: ["workingDays"],
        message: "Present, absent, leave, and half days cannot exceed working days"
      });
    }
  });

export const updateAttendanceSchema = createAttendanceSchema.partial().strict().superRefine((value, ctx) => {
  const values = [
    value.presentDays,
    value.absentDays,
    value.paidLeaveDays,
    value.unpaidLeaveDays,
    value.halfDays,
    value.workingDays
  ];
  if (values.every((entry) => entry === undefined)) {
    return;
  }

  const total =
    (value.presentDays ?? 0) + (value.absentDays ?? 0) + (value.paidLeaveDays ?? 0) + (value.unpaidLeaveDays ?? 0) + (value.halfDays ?? 0);
  if (value.workingDays !== undefined && total > value.workingDays + 0.0001) {
    ctx.addIssue({
      code: "custom",
      path: ["workingDays"],
      message: "Present, absent, leave, and half days cannot exceed working days"
    });
  }
});

export const createRunSchema = z
  .object({
    payrollMonth: payrollMonthSchema,
    periodStart: optionalDate,
    periodEnd: optionalDate,
    notes: optionalNullableString(2000)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.periodStart && value.periodEnd && value.periodEnd < value.periodStart) {
      ctx.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "periodEnd must be on or after periodStart"
      });
    }
  });

export const listRunsQuerySchema = listBaseQuery.extend({
  month: payrollMonthSchema.optional(),
  status: z.enum(PAYROLL_RUN_STATUSES).optional()
});

const bankLinkedModes = new Set(["bank", "upi", "cheque"]);

const paySelectionSchema = z.object({
  payrollItemId: z.uuid(),
  amount: decimalNumber({ min: Number.EPSILON }).optional()
});

export const payRunSchema = z
  .object({
    paymentDate: z.coerce.date(),
    paymentMode: z.enum(PAYROLL_PAYMENT_MODES),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceNumber: optionalNullableString(150),
    notes: optionalNullableString(1000),
    payrollItemIds: z.array(z.uuid()).optional(),
    payments: z.array(paySelectionSchema).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.paymentDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentDate"],
        message: "Payment date cannot be in the future"
      });
    }

    if (bankLinkedModes.has(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for the selected payment mode"
      });
    }

    if (value.payrollItemIds && value.payments) {
      ctx.addIssue({
        code: "custom",
        path: ["payments"],
        message: "Use either payrollItemIds or payments, not both"
      });
    }
  });

export const payItemSchema = z
  .object({
    paymentDate: z.coerce.date(),
    amount: decimalNumber({ min: Number.EPSILON }).optional(),
    paymentMode: z.enum(PAYROLL_PAYMENT_MODES),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceNumber: optionalNullableString(150),
    notes: optionalNullableString(1000)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.paymentDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentDate"],
        message: "Payment date cannot be in the future"
      });
    }

    if (bankLinkedModes.has(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for the selected payment mode"
      });
    }
  });

export const cancelRunSchema = z
  .object({
    cancellationReason: z.string().trim().min(3).max(500)
  })
  .strict();

export const listItemsQuerySchema = listBaseQuery.extend({
  runId: z.uuid().optional(),
  employeeId: z.uuid().optional(),
  paymentStatus: z.enum(PAYROLL_ITEM_PAYMENT_STATUSES).optional(),
  month: payrollMonthSchema.optional()
});

export const updateBonusDeductionsSchema = z
  .object({
    entries: z.array(
      z
        .object({
          type: z.enum(PAYROLL_BONUS_DEDUCTION_TYPES),
          name: z.string().trim().min(1).max(150),
          amount: decimalNumber({ min: 0 }),
          taxable: z.preprocess(parseBooleanQuery, z.boolean().optional()).optional().default(true),
          notes: optionalNullableString(500)
        })
        .strict()
    )
  })
  .strict();

export const salarySlipEmailSchema = z
  .object({
    email: optionalLowercaseEmail,
    subject: optionalNullableString(150),
    message: optionalNullableString(1000)
  })
  .strict();

export const reportsQuerySchema = listBaseQuery
  .extend({
    month: payrollMonthSchema.optional(),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    department: z.preprocess(trimToNull, z.string().trim().max(100).nullable().optional()),
    employeeId: z.uuid().optional(),
    runId: z.uuid().optional(),
    paymentMode: z.enum(PAYROLL_PAYMENT_MODES).optional(),
    includeCancelled: z.preprocess(parseBooleanQuery, z.boolean().optional())
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must be on or after dateFrom"
      });
    }
  });

export const exportPayrollQuerySchema = listItemsQuerySchema.extend({
  department: z.preprocess(trimToNull, z.string().trim().max(100).nullable().optional()),
  format: z.enum(PAYROLL_EXPORT_FORMATS).optional().default("csv")
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;
export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>;
export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>;
export type ListAttendanceQuery = z.infer<typeof listAttendanceQuerySchema>;
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type CreateRunInput = z.infer<typeof createRunSchema>;
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;
export type PayRunInput = z.infer<typeof payRunSchema>;
export type PayItemInput = z.infer<typeof payItemSchema>;
export type CancelRunInput = z.infer<typeof cancelRunSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
export type UpdateBonusDeductionsInput = z.infer<typeof updateBonusDeductionsSchema>;
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;
export type ExportPayrollQuery = z.infer<typeof exportPayrollQuerySchema>;
export type SalarySlipEmailInput = z.infer<typeof salarySlipEmailSchema>;
