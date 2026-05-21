import type { DownloadFileResult } from "./product";

export type GstAdjustmentType =
  | "itc_reversal"
  | "itc_claim"
  | "output_tax_adjustment"
  | "late_fee"
  | "interest"
  | "rounding"
  | "other";

export type GstTaxComponent = "cgst" | "sgst" | "igst" | "cess";
export type GstAdjustmentStatus = "active" | "cancelled";
export type GstItcSourceType = "purchase" | "expense" | "adjustment";
export type GstItcEligibilityStatus = "eligible" | "blocked" | "reversed" | "pending";
export type GstItcClaimStatus = "unclaimed" | "claimed" | "partially_claimed";
export type GstReportSource = "sales" | "purchase" | "expense" | "all";
export type GstSalesPartyType = "b2b" | "b2c";
export type GstExportFormat = "csv" | "xlsx" | "pdf";
export type GstExportType =
  | "sales"
  | "purchases"
  | "itc"
  | "hsn-summary"
  | "tax-summary"
  | "gstr-1"
  | "gstr-3b";

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type GstSummaryTrendRow = {
  month: string;
  taxableSales: string;
  outputGst: string;
  taxablePurchases: string;
  inputGst: string;
  expenseInputGst: string;
  salesReturnGst: string;
  purchaseReturnGst: string;
  netGstPayable: string;
  netGstCredit: string;
};

export type GstSummary = {
  dateFrom: string;
  dateTo: string;
  taxableSales: string;
  salesGst: string;
  netOutputGst: string;
  outputGst: string;
  taxablePurchases: string;
  purchaseGst: string;
  eligiblePurchaseGst: string;
  claimedPurchaseGst: string;
  inputGst: string;
  eligibleItc: string;
  claimedItc: string;
  expenseInputGst: string;
  claimedExpenseInputGst: string;
  returns: {
    salesReturnTaxable: string;
    salesReturnGst: string;
    purchaseReturnTaxable: string;
    purchaseReturnGst: string;
  };
  adjustments: {
    itcClaims: string;
    itcReversals: string;
    outputTaxAdjustments: string;
    lateFee: string;
    interest: string;
    rounding: string;
    other: string;
  };
  netGstPayable: string;
  netGstCredit: string;
  monthWiseTrend: GstSummaryTrendRow[];
};

export type SalesGstRow = {
  id: string;
  invoiceDate: string;
  invoiceNumber: string;
  invoiceType: "gst_invoice" | "pos";
  customerName: string;
  gstin: string | null;
  placeOfSupply: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  cessAmount: string;
  totalGst: string;
  invoiceTotal: string;
};

export type PurchaseGstRow = {
  id: string;
  purchaseDate: string;
  purchaseNumber: string;
  supplierName: string;
  gstin: string | null;
  supplierInvoiceNumber: string | null;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  cessAmount: string;
  totalGst: string;
  invoiceTotal: string;
  itcEligibility: GstItcEligibilityStatus;
  claimStatus: GstItcClaimStatus;
  claimedAmount: string;
};

export type ItcRow = {
  id: string;
  sourceType: GstItcSourceType;
  sourceId: string;
  sourceNumber: string | null;
  supplierName: string | null;
  supplierGstin: string | null;
  invoiceDate: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  cessAmount: string;
  totalGstAmount: string;
  eligibilityStatus: GstItcEligibilityStatus;
  claimStatus: GstItcClaimStatus;
  claimedAmount: string;
  notes: string | null;
  sourceMeta: {
    reason: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type OutputTaxSummary = {
  taxableSales: string;
  salesGst: string;
  salesReturnsTaxable: string;
  salesReturnGst: string;
  outputAdjustments: string;
  netOutputGst: string;
  outputGst: string;
};

export type HsnSacSummaryRow = {
  hsnSacCode: string | null;
  description: string | null;
  unit: string | null;
  quantity: string;
  taxableValue: string;
  gstRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  cessAmount: string;
  totalTax: string;
};

export type TaxSummaryRow = {
  gstRate: string;
  taxableSales: string;
  outputGst: string;
  taxablePurchases: string;
  inputGst: string;
  netGst: string;
  cgstAmount?: string;
  sgstAmount?: string;
  igstAmount?: string;
  cessAmount?: string;
};

export type GstAdjustment = {
  id: string;
  adjustmentNumber: string;
  adjustmentDate: string;
  adjustmentType: GstAdjustmentType;
  taxComponent: GstTaxComponent;
  amount: string;
  reason: string;
  referenceNumber: string | null;
  notes: string | null;
  status: GstAdjustmentStatus;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GstAdjustmentInput = {
  adjustmentDate: string;
  adjustmentType: GstAdjustmentType;
  taxComponent: GstTaxComponent;
  amount: number;
  reason: string;
  referenceNumber: string | null;
  notes: string | null;
};

export type GstFilters = {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  financialYearId?: string | null;
  customerId?: string;
  supplierId?: string;
  supplier?: string;
  state?: string;
  invoiceType?: "gst_invoice" | "pos";
  partyType?: GstSalesPartyType;
  gstRate?: number;
  sourceType?: GstItcSourceType;
  eligibilityStatus?: GstItcEligibilityStatus;
  claimStatus?: GstItcClaimStatus;
  source?: GstReportSource;
  adjustmentType?: GstAdjustmentType;
  taxComponent?: GstTaxComponent;
  status?: GstAdjustmentStatus;
};

export type GstListResponse<TItem> = {
  items: TItem[];
  pagination: PaginationMeta;
};

export type GstExportResult = DownloadFileResult;
