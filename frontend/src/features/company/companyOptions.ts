import type { CompanyBrandingAssetType } from "../../types/company";

export const COMPANY_TIMEZONE_OPTIONS = [
  "Asia/Kolkata",
  "UTC",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
] as const;

export const COMPANY_CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "AED", "SGD"] as const;
export const COMPANY_LANGUAGE_OPTIONS = ["en", "hi"] as const;
export const COMPANY_GST_TYPE_OPTIONS = [
  { value: "regular", label: "Regular" },
  { value: "composition", label: "Composition" },
  { value: "unregistered", label: "Unregistered" },
] as const;
export const COMPANY_GST_FREQUENCY_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
] as const;
export const COMPANY_BANK_ACCOUNT_TYPE_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "savings", label: "Savings" },
  { value: "cash_credit", label: "Cash Credit" },
  { value: "overdraft", label: "Overdraft" },
  { value: "other", label: "Other" },
] as const;
export const COMPANY_TAX_DISPLAY_OPTIONS = [
  { value: "item_wise", label: "Item wise" },
  { value: "summary", label: "Summary" },
  { value: "both", label: "Both" },
] as const;
export const COMPANY_INVOICE_TEMPLATE_OPTIONS = [
  { value: "gst_a4", label: "GST A4" },
  { value: "pos", label: "POS" },
  { value: "thermal", label: "Thermal" },
] as const;
export const COMPANY_DATE_FORMAT_OPTIONS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"] as const;
export const COMPANY_CURRENCY_FORMAT_OPTIONS = [
  { value: "symbol_first", label: "Symbol first" },
  { value: "symbol_last", label: "Symbol last" },
] as const;
export const COMPANY_NUMBER_FORMAT_OPTIONS = [
  { value: "indian", label: "Indian" },
  { value: "western", label: "Western" },
] as const;

export const BRANDING_ASSET_SECTIONS: Array<{
  type: CompanyBrandingAssetType;
  label: string;
}> = [
  { type: "logo", label: "Company Logo" },
  { type: "invoiceLogo", label: "Invoice Logo" },
  { type: "signature", label: "Signature" },
  { type: "stamp", label: "Stamp" },
  { type: "favicon", label: "Favicon" },
];
