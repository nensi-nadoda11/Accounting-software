import { format } from "date-fns";

import { formatDate, formatDateTime, saveDownloadedFile } from "../customers/customerUtils";
import type {
  GstAdjustmentType,
  GstExportResult,
  GstItcClaimStatus,
  GstItcEligibilityStatus,
  GstItcSourceType,
  GstReportSource,
  GstSummary,
  GstTaxComponent,
} from "../../types/gst";

export const GST_RATE_OPTIONS = ["0", "0.25", "3", "5", "12", "18", "28"] as const;

export const GST_ADJUSTMENT_TYPE_LABELS: Record<GstAdjustmentType, string> = {
  itc_reversal: "ITC Reversal",
  itc_claim: "ITC Claim",
  output_tax_adjustment: "Output Tax Adj.",
  late_fee: "Late Fee",
  interest: "Interest",
  rounding: "Rounding",
  other: "Other",
};

export const GST_TAX_COMPONENT_LABELS: Record<GstTaxComponent, string> = {
  cgst: "CGST",
  sgst: "SGST",
  igst: "IGST",
  cess: "Cess",
};

export const GST_SOURCE_LABELS: Record<GstItcSourceType, string> = {
  purchase: "Purchase",
  expense: "Expense",
  adjustment: "Adjustment",
};

export const GST_ELIGIBILITY_LABELS: Record<GstItcEligibilityStatus, string> = {
  eligible: "Eligible",
  blocked: "Blocked",
  reversed: "Reversed",
  pending: "Pending",
};

export const GST_CLAIM_STATUS_LABELS: Record<GstItcClaimStatus, string> = {
  unclaimed: "Unclaimed",
  claimed: "Claimed",
  partially_claimed: "Partial",
};

export const GST_REPORT_SOURCE_LABELS: Record<GstReportSource, string> = {
  sales: "Sales",
  purchase: "Purchase",
  expense: "Expense",
  all: "All",
};

export const formatGstDate = (value: string | Date | null | undefined) => formatDate(value);
export const formatGstDateTime = (value: string | Date | null | undefined) => formatDateTime(value);
export const formatGstMonth = (value: string) => format(new Date(`${value}T00:00:00`), "MMM yyyy");

export const getSummaryAdjustmentTotal = (summary: GstSummary) =>
  [
    summary.adjustments.itcClaims,
    summary.adjustments.itcReversals,
    summary.adjustments.outputTaxAdjustments,
    summary.adjustments.lateFee,
    summary.adjustments.interest,
    summary.adjustments.rounding,
    summary.adjustments.other,
  ].reduce((sum, current) => sum + Number(current), 0);

export const toDownload = (file: GstExportResult) => saveDownloadedFile(file.blob, file.fileName);
