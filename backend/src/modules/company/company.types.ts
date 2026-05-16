export const COMPANY_GST_TYPES = ["regular", "composition", "unregistered"] as const;
export const COMPANY_GST_FILING_FREQUENCIES = ["monthly", "quarterly", "annually"] as const;
export const COMPANY_BANK_ACCOUNT_TYPES = ["current", "savings", "cash_credit", "overdraft", "other"] as const;
export const COMPANY_TAX_DISPLAY_FORMATS = ["item_wise", "summary", "both"] as const;
export const COMPANY_INVOICE_TEMPLATES = ["gst_a4", "pos", "thermal"] as const;
export const COMPANY_BRANDING_ASSET_TYPES = ["logo", "invoiceLogo", "signature", "stamp", "favicon"] as const;
export const COMPANY_DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"] as const;
export const COMPANY_CURRENCY_FORMATS = ["symbol_first", "symbol_last"] as const;
export const COMPANY_NUMBER_FORMATS = ["indian", "western"] as const;

export const COMPANY_BRANDING_FIELD_MAP = {
  logo: "logoUrl",
  invoiceLogo: "invoiceLogoUrl",
  signature: "signatureUrl",
  stamp: "stampUrl",
  favicon: "faviconUrl"
} as const;

export type CompanyActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type CompanyRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type CompanyBrandingAssetType = (typeof COMPANY_BRANDING_ASSET_TYPES)[number];

export type SetupStatusResult = {
  companyStatus: "setup_pending" | "active" | "suspended" | "inactive";
  setupCompletedAt: Date | null;
  isComplete: boolean;
  missingSteps: string[];
  recommendedSteps: string[];
  summary: {
    hasCompanyProfile: boolean;
    hasActiveFinancialYear: boolean;
    hasInvoiceSettings: boolean;
    activeBankAccounts: number;
  };
};
