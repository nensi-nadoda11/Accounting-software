import { z } from "zod";

import { GST_RATE_OPTIONS } from "../products/products.types";
import {
  PURCHASE_EXPORT_FORMATS,
  PURCHASE_PAYMENT_MODES,
  PURCHASE_PAYMENT_STATUSES,
  PURCHASE_PRICE_TAX_TYPES,
  PURCHASE_STATUSES
} from "./purchases.types";

const meaningfulTextRegex = /[\p{L}\p{N}]/u;

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

const gstRateSchema = decimalNumber({ min: 0, max: 28 }).refine(
  (value) => GST_RATE_OPTIONS.includes(value as (typeof GST_RATE_OPTIONS)[number]),
  "Invalid GST rate"
);

const purchaseItemSchema = z
  .object({
    productId: z.uuid(),
    warehouseId: z.uuid().nullable().optional(),
    batchId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    batchNumber: optionalNullableString(80),
    quantity: decimalNumber({ min: Number.EPSILON }),
    freeQuantity: decimalNumber({ min: 0 }).optional().default(0),
    purchaseRate: decimalNumber({ min: 0 }),
    priceTaxType: z.enum(PURCHASE_PRICE_TAX_TYPES).optional().default("exclusive"),
    discountPercent: decimalNumber({ min: 0, max: 100 }).optional().default(0),
    discountAmount: decimalNumber({ min: 0 }).optional().default(0),
    gstRate: gstRateSchema.optional(),
    cessRate: decimalNumber({ min: 0, max: 100 }).optional().default(0),
    manufacturingDate: optionalDate,
    expiryDate: optionalDate,
    remarks: optionalNullableString(500)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.expiryDate && value.manufacturingDate && value.expiryDate <= value.manufacturingDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date must be after manufacturing date"
      });
    }
  });

const basePurchaseSchema = z
  .object({
    supplierId: z.uuid(),
    supplierInvoiceNumber: optionalNullableString(100),
    invoiceDate: z.coerce.date(),
    dueDate: optionalDate,
    warehouseId: z.uuid().nullable().optional(),
    purchaseStatus: z.enum(["draft", "posted"]).optional().default("draft"),
    items: z.array(purchaseItemSchema).min(1, "At least one item is required"),
    invoiceDiscountTotal: decimalNumber({ min: 0 }).optional().default(0),
    additionalCharges: decimalNumber({ min: 0 }).optional().default(0),
    freightCharges: decimalNumber({ min: 0 }).optional().default(0),
    paidAmount: decimalNumber({ min: 0 }).optional().default(0),
    paymentMode: z.enum(PURCHASE_PAYMENT_MODES).nullable().optional(),
    paymentReference: optionalNullableString(150),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    notes: optionalNullableString(2000),
    termsConditions: optionalNullableString(2000),
    attachmentUrl: optionalNullableString(500)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.invoiceDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["invoiceDate"],
        message: "Invoice date cannot be in the future"
      });
    }

    if (value.dueDate && value.dueDate < value.invoiceDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date must be greater than or equal to invoice date"
      });
    }

    if (value.paidAmount > 0 && !value.paymentMode) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMode"],
        message: "Payment mode is required when paid amount is greater than 0"
      });
    }

    if (
      value.paidAmount > 0 &&
      value.paymentMode &&
      ["bank", "upi", "card", "cheque"].includes(value.paymentMode) &&
      !value.bankAccountId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for the selected payment mode"
      });
    }
  });

export const createPurchaseSchema = basePurchaseSchema;

export const updatePurchaseSchema = z
  .object({
    supplierId: z.uuid().optional(),
    supplierInvoiceNumber: basePurchaseSchema.shape.supplierInvoiceNumber,
    invoiceDate: z.coerce.date().optional(),
    dueDate: optionalDate,
    warehouseId: z.uuid().nullable().optional(),
    items: z.array(purchaseItemSchema).min(1).optional(),
    invoiceDiscountTotal: decimalNumber({ min: 0 }).optional(),
    additionalCharges: decimalNumber({ min: 0 }).optional(),
    freightCharges: decimalNumber({ min: 0 }).optional(),
    notes: optionalNullableString(2000),
    termsConditions: optionalNullableString(2000),
    attachmentUrl: optionalNullableString(500)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.invoiceDate && value.invoiceDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["invoiceDate"],
        message: "Invoice date cannot be in the future"
      });
    }

    if (value.invoiceDate && value.dueDate && value.dueDate < value.invoiceDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date must be greater than or equal to invoice date"
      });
    }
  });

const dateRangeQuerySchema = z
  .object({
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

export const listPurchasesQuerySchema = dateRangeQuerySchema.extend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  purchaseStatus: z.enum(PURCHASE_STATUSES).optional(),
  paymentStatus: z.enum(PURCHASE_PAYMENT_STATUSES).optional(),
  supplierId: z.uuid().optional(),
  warehouseId: z.uuid().optional()
});

export const exportPurchasesQuerySchema = listPurchasesQuerySchema.extend({
  format: z.enum(PURCHASE_EXPORT_FORMATS).optional().default("csv")
});

export const purchaseIdParamSchema = z.object({
  id: z.uuid()
});

export const recordPurchasePaymentSchema = z
  .object({
    paymentDate: z.coerce.date(),
    amount: decimalNumber({ min: Number.EPSILON }),
    paymentMode: z.enum(PURCHASE_PAYMENT_MODES),
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

    if (["bank", "upi", "card", "cheque"].includes(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for the selected payment mode"
      });
    }
  });

export const recordPurchaseReturnRefundSchema = z
  .object({
    refundDate: z.coerce.date(),
    amount: decimalNumber({ min: Number.EPSILON }),
    paymentMode: z.enum(PURCHASE_PAYMENT_MODES),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceNumber: optionalNullableString(150),
    notes: optionalNullableString(1000)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.refundDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["refundDate"],
        message: "Refund date cannot be in the future"
      });
    }

    if (["bank", "upi", "card", "cheque"].includes(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for the selected payment mode"
      });
    }
  });

export const listPurchasePaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

const purchaseReturnItemSchema = z
  .object({
    purchaseInvoiceItemId: z.uuid(),
    quantity: decimalNumber({ min: Number.EPSILON }),
    remarks: optionalNullableString(500)
  })
  .strict();

export const createPurchaseReturnSchema = z
  .object({
    purchaseInvoiceId: z.uuid(),
    returnDate: z.coerce.date(),
    warehouseId: z.uuid().nullable().optional(),
    refundAmountReceived: decimalNumber({ min: 0 }).optional().default(0),
    refundPaymentMode: z.enum(PURCHASE_PAYMENT_MODES).nullable().optional(),
    refundBankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    refundReferenceNumber: optionalNullableString(150),
    refundNotes: optionalNullableString(1000),
    notes: z
      .string()
      .trim()
      .min(3, "Notes must be at least 3 characters")
      .max(2000, "Notes must be at most 2000 characters")
      .refine((value) => meaningfulTextRegex.test(value), "Notes must contain letters or numbers"),
    items: z.array(purchaseReturnItemSchema).min(1, "At least one return item is required")
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.returnDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["returnDate"],
        message: "Return date cannot be in the future"
      });
    }

    if (value.refundAmountReceived > 0 && !value.refundPaymentMode) {
      ctx.addIssue({
        code: "custom",
        path: ["refundPaymentMode"],
        message: "Refund mode is required when refund amount is entered"
      });
    }

    if (
      value.refundAmountReceived > 0 &&
      value.refundPaymentMode &&
      ["bank", "upi", "card", "cheque"].includes(value.refundPaymentMode) &&
      !value.refundBankAccountId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["refundBankAccountId"],
        message: "Bank account is required for the selected refund mode"
      });
    }
  });

export const listPurchaseReturnsQuerySchema = dateRangeQuerySchema.extend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  supplierId: z.uuid().optional(),
  purchaseInvoiceId: z.uuid().optional(),
  warehouseId: z.uuid().optional()
});

export const exportPurchaseReturnsQuerySchema = listPurchaseReturnsQuerySchema.extend({
  format: z.enum(PURCHASE_EXPORT_FORMATS).optional().default("csv")
});

export const purchaseReturnIdParamSchema = z.object({
  id: z.uuid()
});

export const purchasePdfParamSchema = purchaseIdParamSchema;
export const purchaseReturnPdfParamSchema = purchaseReturnIdParamSchema;

export const emptyBodySchema = z.object({}).strict();

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;
export type ExportPurchasesQuery = z.infer<typeof exportPurchasesQuerySchema>;
export type RecordPurchasePaymentInput = z.infer<typeof recordPurchasePaymentSchema>;
export type RecordPurchaseReturnRefundInput = z.infer<typeof recordPurchaseReturnRefundSchema>;
export type ListPurchasePaymentsQuery = z.infer<typeof listPurchasePaymentsQuerySchema>;
export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;
export type ListPurchaseReturnsQuery = z.infer<typeof listPurchaseReturnsQuerySchema>;
export type ExportPurchaseReturnsQuery = z.infer<typeof exportPurchaseReturnsQuerySchema>;
