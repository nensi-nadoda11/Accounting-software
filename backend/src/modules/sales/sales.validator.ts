import { z } from "zod";

import { gstRegex, indianMobileRegex } from "../../validators/common.validator";
import { GST_RATE_OPTIONS } from "../products/products.types";
import {
  SALES_EXPORT_FORMATS,
  SALES_INVOICE_STATUSES,
  SALES_INVOICE_TYPES,
  SALES_PAYMENT_MODES,
  SALES_PAYMENT_STATUSES,
  SALES_PRICE_TAX_TYPES
} from "./sales.types";

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

const optionalNullableMobile = z.preprocess(
  trimToNull,
  z
    .string()
    .regex(indianMobileRegex, "Invalid Indian mobile number")
    .nullable()
    .optional()
);

const optionalNullableGst = z.preprocess(
  trimToNull,
  z
    .string()
    .transform((value) => value.toUpperCase())
    .refine((value) => gstRegex.test(value), "Invalid GST number")
    .nullable()
    .optional()
);

const salesItemSchema = z
  .object({
    productId: z.uuid(),
    warehouseId: z.uuid().nullable().optional(),
    batchId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    quantity: decimalNumber({ min: Number.EPSILON }),
    saleRate: decimalNumber({ min: 0 }).optional(),
    mrp: decimalNumber({ min: 0 }).optional(),
    priceTaxType: z.enum(SALES_PRICE_TAX_TYPES).optional(),
    discountPercent: decimalNumber({ min: 0, max: 100 }).optional().default(0),
    discountAmount: decimalNumber({ min: 0 }).optional().default(0),
    gstRate: gstRateSchema.optional(),
    cessRate: decimalNumber({ min: 0, max: 100 }).optional().default(0),
    remarks: optionalNullableString(500)
  })
  .strict();

const baseSalesInvoiceSchema = z
  .object({
    invoiceType: z.enum(SALES_INVOICE_TYPES).optional().default("gst_invoice"),
    invoiceStatus: z.enum(["draft", "posted"]).optional().default("draft"),
    invoiceDate: z.coerce.date(),
    dueDate: optionalDate,
    customerId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    isWalkIn: z.coerce.boolean().optional().default(false),
    walkInName: optionalNullableString(150),
    walkInMobile: optionalNullableMobile,
    placeOfSupply: optionalNullableString(100),
    warehouseId: z.uuid(),
    priceTaxType: z.enum(SALES_PRICE_TAX_TYPES).optional().default("exclusive"),
    items: z.array(salesItemSchema).min(1, "At least one item is required"),
    invoiceDiscountTotal: decimalNumber({ min: 0 }).optional().default(0),
    deliveryCharges: decimalNumber({ min: 0 }).optional().default(0),
    packingCharges: decimalNumber({ min: 0 }).optional().default(0),
    otherCharges: decimalNumber({ min: 0 }).optional().default(0),
    paidAmount: decimalNumber({ min: 0 }).optional().default(0),
    paymentMode: z.enum(SALES_PAYMENT_MODES).nullable().optional(),
    paymentReference: optionalNullableString(150),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    notes: optionalNullableString(2000),
    termsConditions: optionalNullableString(2000)
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

    if (!value.isWalkIn && !value.customerId) {
      ctx.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Customer is required unless this is a walk-in sale"
      });
    }

    if (value.isWalkIn && !value.walkInName) {
      ctx.addIssue({
        code: "custom",
        path: ["walkInName"],
        message: "Walk-in name is required for walk-in sales"
      });
    }

    if (value.paidAmount > 0 && !value.paymentMode) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMode"],
        message: "Payment mode is required when paid amount is greater than 0"
      });
    }

    if (value.paidAmount > 0 && ["bank", "upi", "card", "cheque"].includes(value.paymentMode ?? "") && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required for the selected payment mode"
      });
    }
  });

export const createSalesInvoiceSchema = baseSalesInvoiceSchema;

export const createPosInvoiceSchema = baseSalesInvoiceSchema.safeExtend({
  invoiceType: z.literal("pos").optional().default("pos"),
  invoiceStatus: z.literal("posted").optional().default("posted")
});

export const updateSalesInvoiceSchema = z
  .object({
    invoiceDate: z.coerce.date().optional(),
    dueDate: optionalDate,
    customerId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    isWalkIn: z.coerce.boolean().optional(),
    walkInName: optionalNullableString(150),
    walkInMobile: optionalNullableMobile,
    placeOfSupply: optionalNullableString(100),
    warehouseId: z.uuid().optional(),
    priceTaxType: z.enum(SALES_PRICE_TAX_TYPES).optional(),
    items: z.array(salesItemSchema).min(1).optional(),
    invoiceDiscountTotal: decimalNumber({ min: 0 }).optional(),
    deliveryCharges: decimalNumber({ min: 0 }).optional(),
    packingCharges: decimalNumber({ min: 0 }).optional(),
    otherCharges: decimalNumber({ min: 0 }).optional(),
    paidAmount: decimalNumber({ min: 0 }).optional(),
    paymentMode: z.enum(SALES_PAYMENT_MODES).nullable().optional(),
    paymentReference: optionalNullableString(150),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    notes: optionalNullableString(2000),
    termsConditions: optionalNullableString(2000)
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

export const listSalesInvoicesQuerySchema = dateRangeQuerySchema.safeExtend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  invoiceStatus: z.enum(SALES_INVOICE_STATUSES).optional(),
  paymentStatus: z.enum(SALES_PAYMENT_STATUSES).optional(),
  customerId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  invoiceType: z.enum(SALES_INVOICE_TYPES).optional()
});

export const exportSalesInvoicesQuerySchema = listSalesInvoicesQuerySchema.safeExtend({
  format: z.enum(SALES_EXPORT_FORMATS).optional().default("csv")
});

export const salesInvoiceIdParamSchema = z.object({
  id: z.uuid()
});

export const barcodeLookupQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  warehouseId: z.uuid().optional()
});

export const recordSalesPaymentSchema = z
  .object({
    paymentDate: z.coerce.date(),
    amount: decimalNumber({ min: Number.EPSILON }),
    paymentMode: z.enum(SALES_PAYMENT_MODES),
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

export const listSalesPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

const salesReturnItemSchema = z
  .object({
    salesInvoiceItemId: z.uuid(),
    quantity: decimalNumber({ min: Number.EPSILON }),
    remarks: optionalNullableString(500)
  })
  .strict();

export const createSalesReturnSchema = z
  .object({
    salesInvoiceId: z.uuid(),
    returnDate: z.coerce.date(),
    warehouseId: z.uuid().nullable().optional(),
    refundAmountPaid: decimalNumber({ min: 0 }).optional().default(0),
    refundPaymentMode: z.enum(SALES_PAYMENT_MODES).nullable().optional(),
    refundBankAccountId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    refundReferenceNumber: optionalNullableString(150),
    refundNotes: optionalNullableString(1000),
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be at least 3 characters")
      .max(500, "Reason must be at most 500 characters")
      .refine((value) => meaningfulTextRegex.test(value), "Reason must contain letters or numbers"),
    notes: optionalNullableString(2000),
    items: z.array(salesReturnItemSchema).min(1, "At least one return item is required")
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

    if (value.refundAmountPaid > 0 && !value.refundPaymentMode) {
      ctx.addIssue({
        code: "custom",
        path: ["refundPaymentMode"],
        message: "Refund mode is required when refund amount is entered"
      });
    }

    if (
      value.refundAmountPaid > 0 &&
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

export const recordSalesReturnRefundSchema = z
  .object({
    refundDate: z.coerce.date(),
    amount: decimalNumber({ min: Number.EPSILON }),
    paymentMode: z.enum(SALES_PAYMENT_MODES),
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
        message: "Bank account is required for the selected refund mode"
      });
    }
  });

export const listSalesReturnsQuerySchema = dateRangeQuerySchema.safeExtend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  customerId: z.uuid().optional(),
  salesInvoiceId: z.uuid().optional(),
  warehouseId: z.uuid().optional()
});

export const exportSalesReturnsQuerySchema = listSalesReturnsQuerySchema.safeExtend({
  format: z.enum(SALES_EXPORT_FORMATS).optional().default("csv")
});

export const salesReturnIdParamSchema = z.object({
  id: z.uuid()
});

export const sendInvoiceEmailSchema = z
  .object({
    email: z.preprocess(trimToNull, z.email().nullable().optional()),
    subject: optionalNullableString(150),
    message: optionalNullableString(1000)
  })
  .strict();

export const sendInvoiceWhatsappSchema = z
  .object({
    mobile: optionalNullableMobile,
    message: optionalNullableString(1000)
  })
  .strict();

export const emptyBodySchema = z.object({}).strict();

export type CreateSalesInvoiceInput = z.infer<typeof createSalesInvoiceSchema>;
export type CreatePosInvoiceInput = z.infer<typeof createPosInvoiceSchema>;
export type UpdateSalesInvoiceInput = z.infer<typeof updateSalesInvoiceSchema>;
export type ListSalesInvoicesQuery = z.infer<typeof listSalesInvoicesQuerySchema>;
export type ExportSalesInvoicesQuery = z.infer<typeof exportSalesInvoicesQuerySchema>;
export type RecordSalesPaymentInput = z.infer<typeof recordSalesPaymentSchema>;
export type RecordSalesReturnRefundInput = z.infer<typeof recordSalesReturnRefundSchema>;
export type ListSalesPaymentsQuery = z.infer<typeof listSalesPaymentsQuerySchema>;
export type CreateSalesReturnInput = z.infer<typeof createSalesReturnSchema>;
export type ListSalesReturnsQuery = z.infer<typeof listSalesReturnsQuerySchema>;
export type ExportSalesReturnsQuery = z.infer<typeof exportSalesReturnsQuerySchema>;
export type BarcodeLookupQuery = z.infer<typeof barcodeLookupQuerySchema>;
export type SendInvoiceEmailInput = z.infer<typeof sendInvoiceEmailSchema>;
export type SendInvoiceWhatsappInput = z.infer<typeof sendInvoiceWhatsappSchema>;
