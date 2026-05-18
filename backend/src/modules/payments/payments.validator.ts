import { z } from "zod";

import {
  CHEQUE_STATUSES,
  PAYMENT_AGING_BUCKETS,
  PAYMENT_ALLOCATION_TYPES,
  PAYMENT_EXPORT_FORMATS,
  PAYMENT_MODES,
  PAYMENT_PARTY_TYPES,
  PAYMENT_REMINDER_CHANNELS,
  PAYMENT_REMINDER_REFERENCE_TYPES,
  PAYMENT_REMINDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES
} from "./payments.types";

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

const optionalDate = z.preprocess(parseDateInput, z.coerce.date().nullable().optional());

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

const baseAllocationSchema = z
  .object({
    allocationType: z.enum(PAYMENT_ALLOCATION_TYPES),
    referenceId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceNumber: optionalNullableString(150),
    allocatedAmount: decimalNumber({ min: Number.EPSILON }),
    allocationDate: optionalDate
  })
  .strict();

const electronicModes = new Set(["bank", "upi", "card", "neft", "rtgs", "imps"]);
const bankLinkedModes = new Set(["bank", "upi", "card", "cheque", "neft", "rtgs", "imps"]);

export const createPaymentSchema = z
  .object({
    paymentType: z.enum(PAYMENT_TYPES),
    partyType: z.enum(PAYMENT_PARTY_TYPES),
    partyId: z.uuid(),
    paymentDate: z.coerce.date(),
    amount: decimalNumber({ min: Number.EPSILON }),
    paymentMode: z.enum(PAYMENT_MODES),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceNumber: optionalNullableString(150),
    notes: optionalNullableString(2000),
    status: z.enum(["draft", "completed"]).optional().default("completed"),
    isAdvance: z.coerce.boolean().optional().default(false),
    chequeNumber: optionalNullableString(100),
    chequeDate: optionalDate,
    chequeBankName: optionalNullableString(150),
    chequeStatus: z.enum(CHEQUE_STATUSES).nullable().optional(),
    allocations: z.array(baseAllocationSchema).optional().default([])
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

    if (value.paymentType === "customer_receive" && value.partyType !== "customer") {
      ctx.addIssue({
        code: "custom",
        path: ["partyType"],
        message: "Customer receipt payments must use party type customer"
      });
    }

    if (value.paymentType === "supplier_pay" && value.partyType !== "supplier") {
      ctx.addIssue({
        code: "custom",
        path: ["partyType"],
        message: "Supplier payments must use party type supplier"
      });
    }

    if (bankLinkedModes.has(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for the selected payment mode"
      });
    }

    if (electronicModes.has(value.paymentMode) && !value.referenceNumber) {
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

      if (!value.chequeBankName) {
        ctx.addIssue({
          code: "custom",
          path: ["chequeBankName"],
          message: "Cheque bank name is required for cheque payments"
        });
      }
    }

    const allocationTotal = value.allocations.reduce((total, item) => total + item.allocatedAmount, 0);
    if (allocationTotal > value.amount) {
      ctx.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "Allocation total cannot exceed payment amount"
      });
    }
  });

export const updatePaymentSchema = z
  .object({
    paymentDate: z.coerce.date().optional(),
    amount: decimalNumber({ min: Number.EPSILON }).optional(),
    paymentMode: z.enum(PAYMENT_MODES).optional(),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceNumber: optionalNullableString(150),
    notes: optionalNullableString(2000),
    chequeNumber: optionalNullableString(100),
    chequeDate: optionalDate,
    chequeBankName: optionalNullableString(150),
    chequeStatus: z.enum(CHEQUE_STATUSES).nullable().optional(),
    allocations: z.array(baseAllocationSchema).optional()
  })
  .strict();

export const paymentIdParamSchema = z.object({
  id: z.uuid()
});

export const listPaymentsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
    partyType: z.enum(PAYMENT_PARTY_TYPES).optional(),
    paymentType: z.enum(PAYMENT_TYPES).optional(),
    partyId: z.uuid().optional(),
    paymentMode: z.enum(PAYMENT_MODES).optional(),
    status: z.enum(PAYMENT_STATUSES).optional(),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    isAdvance: z.preprocess(parseBooleanQuery, z.boolean().optional())
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

export const exportPaymentsQuerySchema = listPaymentsQuerySchema.extend({
  format: z.enum(PAYMENT_EXPORT_FORMATS).optional().default("csv")
});

export const cancelPaymentSchema = z
  .object({
    reason: z.string().trim().min(3).max(500)
  })
  .strict();

export const completePaymentSchema = z
  .object({
    allocations: z.array(baseAllocationSchema).optional()
  })
  .strict();

export const replaceAllocationsSchema = z
  .object({
    allocations: z.array(baseAllocationSchema)
  })
  .strict();

export const sendReminderSchema = z
  .object({
    partyType: z.enum(PAYMENT_PARTY_TYPES),
    partyId: z.uuid(),
    referenceType: z.enum(PAYMENT_REMINDER_REFERENCE_TYPES),
    referenceId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceNumber: optionalNullableString(150),
    dueDate: z.coerce.date(),
    amountDue: decimalNumber({ min: Number.EPSILON }),
    channel: z.enum(PAYMENT_REMINDER_CHANNELS),
    message: optionalNullableString(2000)
  })
  .strict();

export const listRemindersQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    partyType: z.enum(PAYMENT_PARTY_TYPES).optional(),
    partyId: z.uuid().optional(),
    status: z.enum(PAYMENT_REMINDER_STATUSES).optional(),
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

export const reminderIdParamSchema = z.object({
  id: z.uuid()
});

export const updateReminderStatusSchema = z
  .object({
    status: z.enum(PAYMENT_REMINDER_STATUSES),
    errorMessage: optionalNullableString(1000)
  })
  .strict();

export const chequeStatusSchema = z
  .object({
    chequeStatus: z.enum(CHEQUE_STATUSES),
    statusDate: z.coerce.date().optional(),
    remarks: optionalNullableString(1000),
    reason: optionalNullableString(500)
  })
  .strict();

export const dueListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    partyId: z.uuid().optional(),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    overdueOnly: z.preprocess(parseBooleanQuery, z.boolean().optional()),
    agingBucket: z.enum(PAYMENT_AGING_BUCKETS).optional()
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

export const partyDueItemsParamSchema = z.object({
  type: z.enum(PAYMENT_PARTY_TYPES),
  id: z.uuid()
});

export const sendReceiptSchema = z
  .object({
    email: z.preprocess(trimToNull, z.email().nullable().optional()),
    subject: optionalNullableString(150),
    message: optionalNullableString(1000)
  })
  .strict();

export const emptyBodySchema = z.object({}).strict();

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type ExportPaymentsQuery = z.infer<typeof exportPaymentsQuerySchema>;
export type CancelPaymentInput = z.infer<typeof cancelPaymentSchema>;
export type CompletePaymentInput = z.infer<typeof completePaymentSchema>;
export type ReplaceAllocationsInput = z.infer<typeof replaceAllocationsSchema>;
export type SendReminderInput = z.infer<typeof sendReminderSchema>;
export type ListRemindersQuery = z.infer<typeof listRemindersQuerySchema>;
export type UpdateReminderStatusInput = z.infer<typeof updateReminderStatusSchema>;
export type UpdateChequeStatusInput = z.infer<typeof chequeStatusSchema>;
export type DueListQuery = z.infer<typeof dueListQuerySchema>;
export type SendReceiptInput = z.infer<typeof sendReceiptSchema>;
