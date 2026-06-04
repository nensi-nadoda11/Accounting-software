import { format } from "date-fns";

import { formatPreferredDate } from "../../lib/date-format";
import type {
  CompanyBranding,
  CompanyBrandingAssetType,
  CompanyInvoiceSettings,
  CompanyPreferences,
  CompanyProfile,
  CompanySetupStatus,
  CompanyTaxSettings,
} from "../../types/company";

export const nullableString = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

export const requiredString = (value: string) => value.trim();

export const maskAccountNumber = (value: string) => {
  if (value.length <= 4) {
    return value;
  }

  return `${"*".repeat(Math.max(value.length - 4, 0))}${value.slice(-4)}`;
};

export const formatDateCell = (value: string) => formatPreferredDate(value);

export const toDateInputValue = (value: string) => format(new Date(value), "yyyy-MM-dd");

export const buildInvoiceNumber = (prefix: string, nextNumber: number, padding: number) =>
  `${prefix}${String(nextNumber).padStart(padding, "0")}`;

export const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Failed to read selected file"));
    };

    reader.onerror = () => reject(new Error("Failed to read selected file"));
    reader.readAsDataURL(file);
  });

export const getBrandingAssetUrl = (branding: CompanyBranding, type: CompanyBrandingAssetType) => {
  switch (type) {
    case "logo":
      return branding.logoUrl;
    case "invoiceLogo":
      return branding.invoiceLogoUrl;
    case "signature":
      return branding.signatureUrl;
    case "stamp":
      return branding.stampUrl;
    case "favicon":
      return branding.faviconUrl;
  }
};

export const getCompanyProfileFormDefaults = (profile: CompanyProfile) => ({
  name: profile.name,
  legalName: profile.legalName ?? "",
  businessType: profile.businessType ?? "",
  industryType: profile.industryType ?? "",
  gstNumber: profile.gstNumber ?? "",
  panNumber: profile.panNumber ?? "",
  cinNumber: profile.cinNumber ?? "",
  email: profile.email ?? "",
  mobileNumber: profile.mobileNumber ?? "",
  website: profile.website ?? "",
  addressLine1: profile.addressLine1 ?? "",
  addressLine2: profile.addressLine2 ?? "",
  city: profile.city ?? "",
  state: profile.state ?? "",
  pincode: profile.pincode ?? "",
  country: profile.country,
  timezone: profile.timezone,
  currency: profile.currency,
  language: profile.language,
});

export const getTaxSettingsFormDefaults = (settings: CompanyTaxSettings) => ({
  gstEnabled: settings.gstEnabled,
  gstType: settings.gstType,
  compositionScheme: settings.compositionScheme,
  taxInclusivePricing: settings.taxInclusivePricing,
  defaultGstRate: settings.defaultGstRate?.toString() ?? "",
  hsnSacEnabled: settings.hsnSacEnabled,
  eInvoiceEnabled: settings.eInvoiceEnabled,
  eWayBillEnabled: settings.eWayBillEnabled,
  gstFilingFrequency: settings.gstFilingFrequency,
  tanNumber: settings.tanNumber ?? "",
});

export const getInvoiceSettingsFormDefaults = (settings: CompanyInvoiceSettings) => ({
  salesInvoicePrefix: settings.salesInvoicePrefix,
  purchaseInvoicePrefix: settings.purchaseInvoicePrefix,
  creditNotePrefix: settings.creditNotePrefix,
  debitNotePrefix: settings.debitNotePrefix,
  autoNumbering: settings.autoNumbering,
  nextSalesInvoiceNumber: settings.nextSalesInvoiceNumber.toString(),
  nextPurchaseInvoiceNumber: settings.nextPurchaseInvoiceNumber.toString(),
  numberPadding: settings.numberPadding.toString(),
  termsAndConditions: settings.termsAndConditions ?? "",
  footerNote: settings.footerNote ?? "",
  showCompanyLogo: settings.showCompanyLogo,
  showBankDetails: settings.showBankDetails,
  showQrCode: settings.showQrCode,
  showSignature: settings.showSignature,
  roundOffEnabled: settings.roundOffEnabled,
  decimalPrecision: settings.decimalPrecision.toString(),
  taxDisplayFormat: settings.taxDisplayFormat,
  invoiceTemplate: settings.invoiceTemplate,
});

export const getPreferencesFormDefaults = (preferences: CompanyPreferences) => ({
  dateFormat: preferences.dateFormat,
  currencyFormat: preferences.currencyFormat,
  numberFormat: preferences.numberFormat,
  decimalPrecision: preferences.decimalPrecision.toString(),
  timezone: preferences.timezone,
  language: preferences.language,
  autoLogoutMinutes: preferences.autoLogoutMinutes.toString(),
  notificationEmailEnabled: preferences.notificationEmailEnabled,
  notificationSmsEnabled: preferences.notificationSmsEnabled,
  notificationWhatsappEnabled: preferences.notificationWhatsappEnabled,
});

export const getSetupChecklist = ({
  status,
  taxSettings,
  branding,
}: {
  status: CompanySetupStatus;
  taxSettings: CompanyTaxSettings | null;
  branding: CompanyBranding | null;
}) => {
  const brandingCompleted = Boolean(
    branding &&
      (branding.logoUrl ||
        branding.invoiceLogoUrl ||
        branding.signatureUrl ||
        branding.stampUrl ||
        branding.faviconUrl),
  );
  const gstCompleted = Boolean(taxSettings && (!taxSettings.gstEnabled || taxSettings.gstType !== "unregistered"));

  return [
    { key: "profile", label: "Profile", completed: status.summary.hasCompanyProfile },
    { key: "gst", label: "GST", completed: gstCompleted },
    { key: "financialYear", label: "Financial Year", completed: status.summary.hasActiveFinancialYear },
    { key: "invoiceSettings", label: "Invoice Settings", completed: status.summary.hasInvoiceSettings },
    { key: "branding", label: "Branding", completed: brandingCompleted },
    { key: "bank", label: "Bank", completed: status.summary.activeBankAccounts > 0 },
  ] as const;
};
