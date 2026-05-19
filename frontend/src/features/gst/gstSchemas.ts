import { z } from "zod";

import type {
  GstAdjustmentType,
  GstItcClaimStatus,
  GstItcEligibilityStatus,
  GstReportSource,
  GstTaxComponent,
} from "../../types/gst";

const adjustmentTypeValues = [
  "itc_reversal",
  "itc_claim",
  "output_tax_adjustment",
  "late_fee",
  "interest",
  "rounding",
  "other",
] as const satisfies readonly GstAdjustmentType[];

const taxComponentValues = ["cgst", "sgst", "igst", "cess"] as const satisfies readonly GstTaxComponent[];
const eligibilityStatusValues = ["eligible", "blocked", "reversed", "pending"] as const satisfies readonly GstItcEligibilityStatus[];
const claimStatusValues = ["unclaimed", "claimed", "partially_claimed"] as const satisfies readonly GstItcClaimStatus[];
const reportSourceValues = ["sales", "purchase", "expense", "all"] as const satisfies readonly GstReportSource[];

const requiredDate = z.string().min(1, "Date is required");

const optionalText = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value.length ? value : null));

export const gstReportDateRangeSchema = z
  .object({
    dateFrom: requiredDate,
    dateTo: requiredDate,
  })
  .refine((value) => new Date(value.dateFrom).getTime() <= new Date(value.dateTo).getTime(), {
    path: ["dateTo"],
    message: "End date must be on or after start date",
  });

export const gstSummaryFilterSchema = z
  .object({
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    financialYearId: z.string().nullable().optional(),
  })
  .refine(
    (value) =>
      Boolean(value.financialYearId) ||
      (Boolean(value.dateFrom) &&
        Boolean(value.dateTo) &&
        new Date(value.dateFrom!).getTime() <= new Date(value.dateTo!).getTime()),
    {
      path: ["dateFrom"],
      message: "Choose a financial year or a valid date range",
    },
  );

export const gstAdjustmentSchema = z
  .object({
    adjustmentDate: requiredDate,
    adjustmentType: z.enum(adjustmentTypeValues),
    taxComponent: z.enum(taxComponentValues),
    amount: z.coerce.number().gt(0, "Amount must be greater than 0"),
    reason: z.string().trim().min(1, "Reason is required").max(500, "Reason must be 500 characters or less"),
    referenceNumber: optionalText,
    notes: optionalText,
  })
  .refine((value) => new Date(value.adjustmentDate).getTime() <= Date.now(), {
    path: ["adjustmentDate"],
    message: "Adjustment date cannot be in the future",
  });

export const gstAdjustmentCancelSchema = z.object({
  cancellationReason: z.string().trim().min(1, "Cancellation reason is required").max(500, "Reason must be 500 characters or less"),
});

export const createGstItcStatusSchema = (totalGstAmount: number) =>
  z
    .object({
      eligibilityStatus: z.enum(eligibilityStatusValues),
      claimStatus: z.enum(claimStatusValues),
      claimedAmount: z.coerce.number().min(0, "Claimed amount cannot be negative"),
      notes: optionalText,
    })
    .superRefine((value, context) => {
      if (value.claimStatus === "partially_claimed" && value.claimedAmount >= totalGstAmount) {
        context.addIssue({
          code: "custom",
          path: ["claimedAmount"],
          message: "Claimed amount must be less than total GST for partial claims",
        });
      }

      if (value.claimStatus === "claimed" && value.claimedAmount !== totalGstAmount) {
        context.addIssue({
          code: "custom",
          path: ["claimedAmount"],
          message: "Claimed amount must match total GST",
        });
      }
    });

export const gstExportFiltersSchema = gstReportDateRangeSchema.extend({
  source: z.enum(reportSourceValues).default("all"),
});

export const gstRateQuerySchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => !value || ["0", "0.25", "3", "5", "12", "18", "28"].includes(value), "GST rate is invalid");

export type GstAdjustmentFormInputValues = z.input<typeof gstAdjustmentSchema>;
export type GstAdjustmentFormValues = z.output<typeof gstAdjustmentSchema>;
export type GstAdjustmentCancelFormInputValues = z.input<typeof gstAdjustmentCancelSchema>;
export type GstAdjustmentCancelFormValues = z.output<typeof gstAdjustmentCancelSchema>;
export type GstExportFiltersValues = z.output<typeof gstExportFiltersSchema>;
export type GstSummaryFilterValues = z.output<typeof gstSummaryFilterSchema>;
export type GstReportDateRangeValues = z.output<typeof gstReportDateRangeSchema>;
export type GstItcStatusFormInputValues = z.input<ReturnType<typeof createGstItcStatusSchema>>;
export type GstItcStatusFormValues = z.output<ReturnType<typeof createGstItcStatusSchema>>;
