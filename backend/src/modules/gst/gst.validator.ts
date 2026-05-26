import { z } from "zod";

import { gstRegex } from "../../validators/common.validator";
import {
  GST_ADJUSTMENT_STATUSES,
  GST_ADJUSTMENT_TYPES,
  GST_ALLOWED_RATES,
  GST_ITC_CLAIM_STATUSES,
  GST_ITC_ELIGIBILITY_STATUSES,
  GST_ITC_SOURCE_TYPES,
  GST_REPORT_EXPORT_FORMATS,
  GST_REPORT_SOURCES,
  GST_SALES_PARTY_TYPES,
  GST_TAX_COMPONENTS
} from "./gst.types";

const hsnSacRegex = /^[0-9]{4,8}$/;

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
  (value) => GST_ALLOWED_RATES.map((rate) => Number(rate)).includes(value),
  "GST rate must be one of 0, 0.25, 3, 5, 12, 18, or 28"
);

const paginatedDateRangeSchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date()
  })
  .superRefine((value, ctx) => {
    if (value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must be greater than or equal to dateFrom"
      });
    }
  });

export const gstSummaryQuerySchema = z
  .object({
    dateFrom: optionalDate,
    dateTo: optionalDate,
    financialYearId: z.preprocess(trimToNull, z.uuid().nullable().optional())
  })
  .superRefine((value, ctx) => {
    const hasDateFrom = value.dateFrom instanceof Date;
    const hasDateTo = value.dateTo instanceof Date;

    if (!value.financialYearId && !(hasDateFrom && hasDateTo)) {
      ctx.addIssue({
        code: "custom",
        path: ["dateFrom"],
        message: "Either financialYearId or both dateFrom and dateTo are required"
      });
    }

    if (hasDateFrom !== hasDateTo) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateFrom and dateTo must be provided together"
      });
    }

    if (hasDateFrom && hasDateTo && value.dateTo! < value.dateFrom!) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must be greater than or equal to dateFrom"
      });
    }
  });

export const gstSalesQuerySchema = paginatedDateRangeSchema.extend({
  customerId: z.uuid().optional(),
  state: optionalNullableString(100),
  invoiceType: z.enum(["gst_invoice", "pos"]).optional(),
  partyType: z.enum(GST_SALES_PARTY_TYPES).optional(),
  gstRate: gstRateSchema.optional()
});

export const gstPurchasesQuerySchema = paginatedDateRangeSchema.extend({
  supplierId: z.uuid().optional(),
  state: optionalNullableString(100),
  gstRate: gstRateSchema.optional(),
  eligibilityStatus: z.enum(GST_ITC_ELIGIBILITY_STATUSES).optional(),
  claimStatus: z.enum(GST_ITC_CLAIM_STATUSES).optional()
});

export const gstItcQuerySchema = paginatedDateRangeSchema.extend({
  sourceType: z.enum(GST_ITC_SOURCE_TYPES).optional(),
  eligibilityStatus: z.enum(GST_ITC_ELIGIBILITY_STATUSES).optional(),
  claimStatus: z.enum(GST_ITC_CLAIM_STATUSES).optional(),
  supplier: optionalNullableString(150)
});

export const gstOutputTaxQuerySchema = z
  .object({
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date(),
    state: optionalNullableString(100),
    gstRate: gstRateSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must be greater than or equal to dateFrom"
      });
    }
  });

export const gstHsnSummaryQuerySchema = z
  .object({
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date(),
    source: z.enum(GST_REPORT_SOURCES).optional().default("all")
  })
  .superRefine((value, ctx) => {
    if (value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must be greater than or equal to dateFrom"
      });
    }
  });

export const gstTaxSummaryQuerySchema = z
  .object({
    dateFrom: z.coerce.date(),
    dateTo: z.coerce.date()
  })
  .superRefine((value, ctx) => {
    if (value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must be greater than or equal to dateFrom"
      });
    }
  });

export const gstAdjustmentsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    adjustmentType: z.enum(GST_ADJUSTMENT_TYPES).optional(),
    taxComponent: z.enum(GST_TAX_COMPONENTS).optional(),
    status: z.enum(GST_ADJUSTMENT_STATUSES).optional()
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

export const createGstAdjustmentSchema = z
  .object({
    adjustmentDate: z.coerce.date(),
    adjustmentType: z.enum(GST_ADJUSTMENT_TYPES),
    taxComponent: z.enum(GST_TAX_COMPONENTS),
    amount: decimalNumber({ min: Number.EPSILON }),
    reason: z.string().trim().min(3).max(500),
    referenceNumber: optionalNullableString(150),
    notes: optionalNullableString(2000)
  })
  .strict();

export const cancelGstAdjustmentSchema = z
  .object({
    cancellationReason: z.string().trim().min(3).max(500)
  })
  .strict();

export const updateGstItcStatusSchema = z
  .object({
    eligibilityStatus: z.enum(GST_ITC_ELIGIBILITY_STATUSES).optional(),
    claimStatus: z.enum(GST_ITC_CLAIM_STATUSES).optional(),
    claimedAmount: decimalNumber({ min: 0 }).optional(),
    notes: optionalNullableString(1000)
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

const exportFormatField = {
  format: z.enum(GST_REPORT_EXPORT_FORMATS).optional().default("pdf")
};

export const gstSalesExportQuerySchema = gstSalesQuerySchema.extend(exportFormatField);
export const gstPurchasesExportQuerySchema = gstPurchasesQuerySchema.extend(exportFormatField);
export const gstItcExportQuerySchema = gstItcQuerySchema.extend(exportFormatField);
export const gstHsnSummaryExportQuerySchema = gstHsnSummaryQuerySchema.extend(exportFormatField);
export const gstTaxSummaryExportQuerySchema = gstTaxSummaryQuerySchema.extend(exportFormatField);
export const gstGstr1ExportQuerySchema = gstSalesQuerySchema.extend(exportFormatField);
export const gstGstr3bExportQuerySchema = gstTaxSummaryQuerySchema.extend(exportFormatField);

export const gstItcIdParamSchema = z.object({
  id: z.uuid()
});

export const gstAdjustmentIdParamSchema = z.object({
  id: z.uuid()
});

export const gstHsnSacCodeSchema = z.string().trim().regex(hsnSacRegex, "HSN/SAC code must be 4 to 8 digits");
export const gstinSchema = z.string().trim().regex(gstRegex, "GSTIN is invalid").transform((value) => value.toUpperCase());

export type GstSummaryQuery = z.infer<typeof gstSummaryQuerySchema>;
export type GstSalesQuery = z.infer<typeof gstSalesQuerySchema>;
export type GstPurchasesQuery = z.infer<typeof gstPurchasesQuerySchema>;
export type GstItcQuery = z.infer<typeof gstItcQuerySchema>;
export type GstOutputTaxQuery = z.infer<typeof gstOutputTaxQuerySchema>;
export type GstHsnSummaryQuery = z.infer<typeof gstHsnSummaryQuerySchema>;
export type GstTaxSummaryQuery = z.infer<typeof gstTaxSummaryQuerySchema>;
export type GstAdjustmentsQuery = z.infer<typeof gstAdjustmentsQuerySchema>;
export type CreateGstAdjustmentInput = z.infer<typeof createGstAdjustmentSchema>;
export type CancelGstAdjustmentInput = z.infer<typeof cancelGstAdjustmentSchema>;
export type UpdateGstItcStatusInput = z.infer<typeof updateGstItcStatusSchema>;
export type GstSalesExportQuery = z.infer<typeof gstSalesExportQuerySchema>;
export type GstPurchasesExportQuery = z.infer<typeof gstPurchasesExportQuerySchema>;
export type GstItcExportQuery = z.infer<typeof gstItcExportQuerySchema>;
export type GstHsnSummaryExportQuery = z.infer<typeof gstHsnSummaryExportQuerySchema>;
export type GstTaxSummaryExportQuery = z.infer<typeof gstTaxSummaryExportQuerySchema>;
export type GstGstr1ExportQuery = z.infer<typeof gstGstr1ExportQuerySchema>;
export type GstGstr3bExportQuery = z.infer<typeof gstGstr3bExportQuerySchema>;
