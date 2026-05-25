import { z } from "zod";

import { gstRegex } from "../../validators/common.validator";
import {
  EXPENSE_CATEGORY_STATUSES,
  EXPENSE_EXPORT_FORMATS,
  EXPENSE_GST_RATES,
  EXPENSE_PAYMENT_MODES,
  EXPENSE_PRICE_TAX_TYPES,
  EXPENSE_STATUSES,
  RECURRING_EXPENSE_CREATE_STATUSES,
  RECURRING_EXPENSE_FREQUENCIES,
  RECURRING_EXPENSE_STATUSES
} from "./expenses.types";

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const hsnSacRegex = /^[0-9]{4,8}$/;
const safeColorRegex = /^#[0-9A-Fa-f]{6}$/;

const trimToNull = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
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
const optionalNullableString = (maxLength: number) =>
  z.preprocess(trimToNull, z.string().trim().max(maxLength).nullable().optional());
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

const gstRateSchema = decimalNumber({ min: 0, max: 28 }).refine(
  (value) => EXPENSE_GST_RATES.map((rate) => Number(rate)).includes(value),
  "GST rate must be one of 0, 0.25, 3, 5, 12, 18, or 28"
);

const bankLinkedModes = new Set(["bank", "upi", "card", "cheque", "neft", "rtgs", "imps"]);
const referenceRequiredModes = new Set(["bank", "upi", "card", "neft", "rtgs", "imps"]);

const categoryBaseSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    parentId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    defaultAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    color: z.preprocess(trimToNull, z.string().trim().regex(safeColorRegex, "Color must be a hex value").nullable().optional()),
    icon: optionalNullableString(100),
    description: optionalNullableString(500),
    status: z.enum(EXPENSE_CATEGORY_STATUSES).optional()
  })
  .strict();

const expenseBaseSchema = z
  .object({
    expenseDate: z.coerce.date(),
    categoryId: z.uuid(),
    expenseAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    payeeName: optionalNullableString(150),
    vendorGstNumber: z.preprocess(
      trimToNull,
      z
        .string()
        .trim()
        .regex(gstRegex, "Vendor GST number is invalid")
        .transform((value) => value.toUpperCase())
        .nullable()
        .optional()
    ),
    vendorPanNumber: z.preprocess(
      trimToNull,
      z
        .string()
        .trim()
        .regex(panRegex, "Vendor PAN number is invalid")
        .transform((value) => value.toUpperCase())
        .nullable()
        .optional()
    ),
    hsnSacCode: z.preprocess(trimToNull, z.string().trim().regex(hsnSacRegex, "HSN/SAC code is invalid").nullable().optional()),
    description: z.string().trim().min(2).max(500),
    amount: decimalNumber({ min: Number.EPSILON }),
    gstApplicable: z.coerce.boolean().optional().default(false),
    gstRate: gstRateSchema.optional().default(0),
    priceTaxType: z.enum(EXPENSE_PRICE_TAX_TYPES).optional().default("exclusive"),
    paymentMode: z.enum(EXPENSE_PAYMENT_MODES),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceNumber: optionalNullableString(150),
    chequeNumber: optionalNullableString(100),
    chequeDate: optionalDate,
    chequeStatus: z.enum(["issued", "deposited", "cleared", "bounced", "cancelled"]).nullable().optional(),
    notes: optionalNullableString(2000)
  })
  .strict();

export const expenseIdParamSchema = z.object({
  id: z.uuid()
});

export const expenseAttachmentParamSchema = z.object({
  id: z.uuid(),
  attachmentId: z.uuid()
});

export const expenseCategoryIdParamSchema = z.object({
  id: z.uuid()
});

export const recurringExpenseIdParamSchema = z.object({
  id: z.uuid()
});

export const createExpenseCategorySchema = categoryBaseSchema;

export const updateExpenseCategorySchema = categoryBaseSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided"
});

export const listExpenseCategoriesQuerySchema = z.object({
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  status: z.enum(EXPENSE_CATEGORY_STATUSES).optional(),
  parentId: z.preprocess(trimToNull, z.uuid().nullable().optional())
});

export const createExpenseSchema = expenseBaseSchema
  .extend({
    status: z.enum(["draft", "posted"]).optional().default("draft")
  })
  .superRefine((value, ctx) => {
    if (value.expenseDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["expenseDate"],
        message: "Expense date cannot be in the future"
      });
    }

    if (!value.gstApplicable && value.gstRate !== 0) {
      ctx.addIssue({
        code: "custom",
        path: ["gstRate"],
        message: "GST rate must be 0 when GST is not applicable"
      });
    }

    if (bankLinkedModes.has(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for the selected payment mode"
      });
    }

    if (referenceRequiredModes.has(value.paymentMode) && !value.referenceNumber) {
      ctx.addIssue({
        code: "custom",
        path: ["referenceNumber"],
        message: "Reference number is required for the selected payment mode"
      });
    }

    if (value.paymentMode === "cheque") {
      if (!value.chequeNumber) {
        ctx.addIssue({
          code: "custom",
          path: ["chequeNumber"],
          message: "Cheque number is required for cheque payments"
        });
      }

      if (!value.chequeDate) {
        ctx.addIssue({
          code: "custom",
          path: ["chequeDate"],
          message: "Cheque date is required for cheque payments"
        });
      }
    }
  });

export const updateExpenseSchema = expenseBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  })
  .superRefine((value, ctx) => {
    if (value.expenseDate && value.expenseDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["expenseDate"],
        message: "Expense date cannot be in the future"
      });
    }
  });

export const cancelExpenseSchema = z
  .object({
    cancellationReason: z.string().trim().min(3).max(500)
  })
  .strict();

export const listExpensesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
    categoryId: z.uuid().optional(),
    paymentMode: z.enum(EXPENSE_PAYMENT_MODES).optional(),
    status: z.enum(EXPENSE_STATUSES).optional(),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    gstApplicable: z.preprocess(parseBooleanQuery, z.boolean().optional()),
    recurringExpenseId: z.uuid().optional()
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must be greater than or equal to dateFrom"
      });
    }
  });

export const exportExpensesQuerySchema = listExpensesQuerySchema.extend({
  format: z.enum(EXPENSE_EXPORT_FORMATS).optional().default("csv")
});

export const reportQuerySchema = z
  .object({
    dateFrom: optionalDate,
    dateTo: optionalDate,
    categoryId: z.uuid().optional(),
    paymentMode: z.enum(EXPENSE_PAYMENT_MODES).optional(),
    includeDrafts: z.preprocess(parseBooleanQuery, z.boolean().optional())
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must be greater than or equal to dateFrom"
      });
    }
  });

const recurringExpenseBaseSchema = expenseBaseSchema
  .pick({
    categoryId: true,
    expenseAccountId: true,
    payeeName: true,
    description: true,
    amount: true,
    gstApplicable: true,
    gstRate: true,
    priceTaxType: true,
    paymentMode: true,
    bankAccountId: true
  })
  .extend({
    templateName: z.string().trim().min(2).max(120),
    frequency: z.enum(RECURRING_EXPENSE_FREQUENCIES),
    startDate: z.coerce.date(),
    endDate: optionalDate,
    nextRunDate: z.coerce.date(),
    autoCreateEnabled: z.coerce.boolean().optional().default(true),
    createAsStatus: z.enum(RECURRING_EXPENSE_CREATE_STATUSES).optional().default("draft"),
    reminderDaysBefore: z.coerce.number().int().min(0).optional().default(0),
    status: z.enum(RECURRING_EXPENSE_STATUSES).optional().default("active")
  })
  .strict();

export const createRecurringExpenseSchema = recurringExpenseBaseSchema.superRefine((value, ctx) => {
    if (value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be greater than or equal to start date"
      });
    }

    if (value.nextRunDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["nextRunDate"],
        message: "Next run date must be greater than or equal to start date"
      });
    }

    if (value.paymentMode === "cheque" && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for cheque recurring expenses"
      });
    }
  });

export const updateRecurringExpenseSchema = recurringExpenseBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

export const listRecurringExpensesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
    status: z.enum(RECURRING_EXPENSE_STATUSES).optional(),
    frequency: z.enum(RECURRING_EXPENSE_FREQUENCIES).optional(),
    dateFrom: optionalDate,
    dateTo: optionalDate
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must be greater than or equal to dateFrom"
      });
    }
  });

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>;
export type ListExpenseCategoriesQuery = z.infer<typeof listExpenseCategoriesQuerySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type CancelExpenseInput = z.infer<typeof cancelExpenseSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
export type ExportExpensesQuery = z.infer<typeof exportExpensesQuerySchema>;
export type ExpenseReportQuery = z.infer<typeof reportQuerySchema>;
export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;
export type UpdateRecurringExpenseInput = z.infer<typeof updateRecurringExpenseSchema>;
export type ListRecurringExpensesQuery = z.infer<typeof listRecurringExpensesQuerySchema>;
