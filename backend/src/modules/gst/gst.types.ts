export const GST_ADJUSTMENT_TYPES = [
  "itc_reversal",
  "itc_claim",
  "output_tax_adjustment",
  "late_fee",
  "interest",
  "rounding",
  "other"
] as const;
export const GST_TAX_COMPONENTS = ["cgst", "sgst", "igst", "cess"] as const;
export const GST_ADJUSTMENT_STATUSES = ["active", "cancelled"] as const;
export const GST_REPORT_TYPES = [
  "sales_gst",
  "purchase_gst",
  "itc",
  "output_tax",
  "hsn_summary",
  "tax_summary",
  "gstr1",
  "gstr3b"
] as const;
export const GST_ITC_SOURCE_TYPES = ["purchase", "expense", "adjustment"] as const;
export const GST_ITC_ELIGIBILITY_STATUSES = ["eligible", "blocked", "reversed", "pending"] as const;
export const GST_ITC_CLAIM_STATUSES = ["unclaimed", "claimed", "partially_claimed"] as const;
export const GST_REPORT_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const GST_ALLOWED_RATES = ["0", "0.25", "3", "5", "12", "18", "28"] as const;
export const GST_REPORT_SOURCES = ["sales", "purchase", "expense", "all"] as const;
export const GST_SALES_PARTY_TYPES = ["b2b", "b2c"] as const;

export type GstActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type GstRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type GstExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export type GstAdjustmentType = (typeof GST_ADJUSTMENT_TYPES)[number];
export type GstTaxComponent = (typeof GST_TAX_COMPONENTS)[number];
export type GstAdjustmentStatus = (typeof GST_ADJUSTMENT_STATUSES)[number];
export type GstReportType = (typeof GST_REPORT_TYPES)[number];
export type GstItcSourceType = (typeof GST_ITC_SOURCE_TYPES)[number];
export type GstItcEligibilityStatus = (typeof GST_ITC_ELIGIBILITY_STATUSES)[number];
export type GstItcClaimStatus = (typeof GST_ITC_CLAIM_STATUSES)[number];
export type GstReportExportFormat = (typeof GST_REPORT_EXPORT_FORMATS)[number];
export type GstReportSource = (typeof GST_REPORT_SOURCES)[number];
export type GstSalesPartyType = (typeof GST_SALES_PARTY_TYPES)[number];
