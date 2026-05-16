import { z } from "zod";

import {
  gstRegex,
  indianMobileRegex,
  paginationQuerySchema
} from "../../validators/common.validator";
import {
  COMPANY_BANK_ACCOUNT_TYPES,
  COMPANY_BRANDING_ASSET_TYPES,
  COMPANY_CURRENCY_FORMATS,
  COMPANY_DATE_FORMATS,
  COMPANY_GST_FILING_FREQUENCIES,
  COMPANY_GST_TYPES,
  COMPANY_INVOICE_TEMPLATES,
  COMPANY_NUMBER_FORMATS,
  COMPANY_TAX_DISPLAY_FORMATS
} from "./company.types";

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const tanRegex = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const cinRegex = /^[A-Z0-9]{8,21}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const upiRegex = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const prefixRegex = /^[A-Z0-9/_-]{1,15}$/;
const branchCodeRegex = /^[A-Z0-9_-]{2,20}$/;
const hexColorRegex = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const normalizeString = (value: string) => value.replace(/\s+/g, " ").trim();

const optionalTrimmedString = (
  schema: z.ZodString,
  mode: "none" | "upper" | "lower" = "none"
) =>
  z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return value;
    }

    const normalized = normalizeString(value);
    if (!normalized) {
      return null;
    }

    if (mode === "upper") {
      return normalized.toUpperCase();
    }

    if (mode === "lower") {
      return normalized.toLowerCase();
    }

    return normalized;
  }, schema.nullable().optional());

const requiredTrimmedString = (
  schema: z.ZodString,
  mode: "none" | "upper" | "lower" = "none"
) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = normalizeString(value);

    if (mode === "upper") {
      return normalized.toUpperCase();
    }

    if (mode === "lower") {
      return normalized.toLowerCase();
    }

    return normalized;
  }, schema);

const optionalNonNullableTrimmedString = (
  schema: z.ZodString,
  mode: "none" | "upper" | "lower" = "none"
) =>
  z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== "string") {
      return value;
    }

    const normalized = normalizeString(value);

    if (mode === "upper") {
      return normalized.toUpperCase();
    }

    if (mode === "lower") {
      return normalized.toLowerCase();
    }

    return normalized;
  }, schema.optional());

const optionalBooleanQuerySchema = z.preprocess((value) => {
  if (value === undefined) {
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
}, z.boolean().optional());

const timezoneSchema = z.string().trim().refine((value) => {
  try {
    return Intl.DateTimeFormat(undefined, { timeZone: value }).resolvedOptions().timeZone.length > 0;
  } catch (_error) {
    return false;
  }
}, "Invalid timezone");

const hasAtLeastOneDefinedValue = (value: Record<string, unknown>) =>
  Object.values(value).some((entry) => entry !== undefined);

const prefixFieldSchema = optionalTrimmedString(
  z.string().min(1).max(15).regex(prefixRegex, "Prefix must be uppercase and contain only safe characters"),
  "upper"
);

export const companyIdParamSchema = z.object({
  id: z.string().uuid()
});

export const companyProfileUpdateSchema = z
  .object({
    name: z.preprocess((value) => {
      if (value === undefined) {
        return undefined;
      }

      if (typeof value !== "string") {
        return value;
      }

      return normalizeString(value);
    }, z.string().min(2).max(150).optional()),
    legalName: optionalTrimmedString(z.string().max(150)),
    businessType: optionalTrimmedString(z.string().max(100)),
    industryType: optionalTrimmedString(z.string().max(100)),
    gstNumber: optionalTrimmedString(z.string().regex(gstRegex, "Invalid GST number"), "upper"),
    panNumber: optionalTrimmedString(z.string().regex(panRegex, "Invalid PAN number"), "upper"),
    cinNumber: optionalTrimmedString(z.string().regex(cinRegex, "Invalid CIN number"), "upper"),
    email: optionalTrimmedString(z.string().email("Invalid email address"), "lower"),
    mobileNumber: optionalTrimmedString(
      z.string().regex(indianMobileRegex, "Invalid Indian mobile number")
    ),
    website: optionalTrimmedString(z.string().url("Invalid website URL")),
    addressLine1: optionalTrimmedString(z.string().max(200)),
    addressLine2: optionalTrimmedString(z.string().max(200)),
    city: optionalTrimmedString(z.string().max(100)),
    state: optionalTrimmedString(z.string().max(100)),
    pincode: optionalTrimmedString(z.string().regex(/^\d{6}$/, "Pincode must be 6 digits")),
    country: optionalNonNullableTrimmedString(z.string().max(100)),
    timezone: optionalNonNullableTrimmedString(timezoneSchema),
    currency: optionalNonNullableTrimmedString(z.string().min(3).max(10), "upper"),
    language: optionalNonNullableTrimmedString(z.string().min(2).max(10))
  })
  .refine(hasAtLeastOneDefinedValue, {
    message: "At least one field must be provided"
  });

export const companyTaxSettingsUpdateSchema = z
  .object({
    gstEnabled: z.boolean().optional(),
    gstType: z.enum(COMPANY_GST_TYPES).optional(),
    compositionScheme: z.boolean().optional(),
    taxInclusivePricing: z.boolean().optional(),
    defaultGstRate: z.coerce.number().min(0).max(28).optional().nullable(),
    hsnSacEnabled: z.boolean().optional(),
    eInvoiceEnabled: z.boolean().optional(),
    eWayBillEnabled: z.boolean().optional(),
    gstFilingFrequency: z.enum(COMPANY_GST_FILING_FREQUENCIES).optional(),
    tanNumber: optionalTrimmedString(z.string().regex(tanRegex, "Invalid TAN number"), "upper")
  })
  .refine(hasAtLeastOneDefinedValue, {
    message: "At least one field must be provided"
  });

const financialYearBaseSchema = z
  .object({
    name: requiredTrimmedString(z.string().min(2).max(80)),
    startDate: z.coerce.date(),
    endDate: z.coerce.date()
  })
  .refine((value) => value.endDate > value.startDate, {
    path: ["endDate"],
    message: "End date must be greater than start date"
  });

export const createFinancialYearSchema = financialYearBaseSchema.extend({
  isActive: z.boolean().optional().default(false)
});

export const updateFinancialYearSchema = z
  .object({
    name: optionalTrimmedString(z.string().min(2).max(80)),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional()
  })
  .refine(hasAtLeastOneDefinedValue, {
    message: "At least one field must be provided"
  })
  .refine(
    (value) => {
      if (!value.startDate || !value.endDate) {
        return true;
      }

      return value.endDate > value.startDate;
    },
    {
      path: ["endDate"],
      message: "End date must be greater than start date"
    }
  );

export const bankAccountsListQuerySchema = paginationQuerySchema.extend({
  isActive: optionalBooleanQuerySchema
});

export const createBankAccountSchema = z.object({
  bankName: requiredTrimmedString(z.string().min(2).max(120)),
  accountHolderName: requiredTrimmedString(z.string().min(2).max(120)),
  accountNumber: requiredTrimmedString(z.string().min(6).max(34)),
  ifscCode: requiredTrimmedString(z.string().regex(ifscRegex, "Invalid IFSC code"), "upper"),
  branchName: optionalTrimmedString(z.string().max(120)),
  upiId: optionalTrimmedString(z.string().regex(upiRegex, "Invalid UPI ID")),
  qrImageUrl: optionalTrimmedString(z.string().url("Invalid QR image URL")),
  openingBalance: z.coerce.number().min(0),
  accountType: z.enum(COMPANY_BANK_ACCOUNT_TYPES).optional().default("current"),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true)
});

export const updateBankAccountSchema = z
  .object({
    bankName: optionalTrimmedString(z.string().min(2).max(120)),
    accountHolderName: optionalTrimmedString(z.string().min(2).max(120)),
    accountNumber: optionalTrimmedString(z.string().min(6).max(34)),
    ifscCode: optionalTrimmedString(z.string().regex(ifscRegex, "Invalid IFSC code"), "upper"),
    branchName: optionalTrimmedString(z.string().max(120)),
    upiId: optionalTrimmedString(z.string().regex(upiRegex, "Invalid UPI ID")),
    qrImageUrl: optionalTrimmedString(z.string().url("Invalid QR image URL")),
    openingBalance: z.coerce.number().min(0).optional(),
    accountType: z.enum(COMPANY_BANK_ACCOUNT_TYPES).optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional()
  })
  .refine(hasAtLeastOneDefinedValue, {
    message: "At least one field must be provided"
  });

export const invoiceSettingsUpdateSchema = z
  .object({
    salesInvoicePrefix: prefixFieldSchema,
    purchaseInvoicePrefix: prefixFieldSchema,
    creditNotePrefix: prefixFieldSchema,
    debitNotePrefix: prefixFieldSchema,
    autoNumbering: z.boolean().optional(),
    nextSalesInvoiceNumber: z.coerce.number().int().positive().optional(),
    nextPurchaseInvoiceNumber: z.coerce.number().int().positive().optional(),
    numberPadding: z.coerce.number().int().min(1).max(10).optional(),
    termsAndConditions: optionalTrimmedString(z.string().max(2000)),
    footerNote: optionalTrimmedString(z.string().max(1000)),
    showCompanyLogo: z.boolean().optional(),
    showBankDetails: z.boolean().optional(),
    showQrCode: z.boolean().optional(),
    showSignature: z.boolean().optional(),
    roundOffEnabled: z.boolean().optional(),
    decimalPrecision: z.coerce.number().int().min(0).max(4).optional(),
    taxDisplayFormat: z.enum(COMPANY_TAX_DISPLAY_FORMATS).optional(),
    invoiceTemplate: z.enum(COMPANY_INVOICE_TEMPLATES).optional()
  })
  .refine(hasAtLeastOneDefinedValue, {
    message: "At least one field must be provided"
  })
  .refine((value) => {
    const prefixes = [
      value.salesInvoicePrefix,
      value.purchaseInvoicePrefix,
      value.creditNotePrefix,
      value.debitNotePrefix
    ].filter((entry): entry is string => Boolean(entry));

    return new Set(prefixes).size === prefixes.length;
  }, {
    message: "Invoice prefixes must be unique when provided"
  });

export const brandingUploadBodySchema = z.object({
  type: z.enum(COMPANY_BRANDING_ASSET_TYPES),
  primaryColor: optionalTrimmedString(z.string().regex(hexColorRegex, "Invalid color value"))
}).refine((value) => value.primaryColor !== undefined || value.type !== undefined, {
  message: "Branding asset type is required"
});

export const brandingDeleteParamSchema = z.object({
  type: z.enum(COMPANY_BRANDING_ASSET_TYPES)
});

export const branchesListQuerySchema = paginationQuerySchema.extend({
  isActive: optionalBooleanQuerySchema
});

export const createBranchSchema = z.object({
  branchName: requiredTrimmedString(z.string().min(2).max(150)),
  branchCode: requiredTrimmedString(
    z.string().regex(branchCodeRegex, "Branch code must be uppercase and contain only safe characters"),
    "upper"
  ),
  gstNumber: optionalTrimmedString(z.string().regex(gstRegex, "Invalid GST number"), "upper"),
  email: optionalTrimmedString(z.string().email("Invalid email address"), "lower"),
  mobileNumber: optionalTrimmedString(
    z.string().regex(indianMobileRegex, "Invalid Indian mobile number")
  ),
  addressLine1: optionalTrimmedString(z.string().max(200)),
  addressLine2: optionalTrimmedString(z.string().max(200)),
  city: optionalTrimmedString(z.string().max(100)),
  state: optionalTrimmedString(z.string().max(100)),
  pincode: optionalTrimmedString(z.string().regex(/^\d{6}$/, "Pincode must be 6 digits")),
  managerName: optionalTrimmedString(z.string().max(120)),
  isActive: z.boolean().optional().default(true)
});

export const updateBranchSchema = z
  .object({
    branchName: optionalTrimmedString(z.string().min(2).max(150)),
    branchCode: optionalTrimmedString(
      z.string().regex(branchCodeRegex, "Branch code must be uppercase and contain only safe characters"),
      "upper"
    ),
    gstNumber: optionalTrimmedString(z.string().regex(gstRegex, "Invalid GST number"), "upper"),
    email: optionalTrimmedString(z.string().email("Invalid email address"), "lower"),
    mobileNumber: optionalTrimmedString(
      z.string().regex(indianMobileRegex, "Invalid Indian mobile number")
    ),
    addressLine1: optionalTrimmedString(z.string().max(200)),
    addressLine2: optionalTrimmedString(z.string().max(200)),
    city: optionalTrimmedString(z.string().max(100)),
    state: optionalTrimmedString(z.string().max(100)),
    pincode: optionalTrimmedString(z.string().regex(/^\d{6}$/, "Pincode must be 6 digits")),
    managerName: optionalTrimmedString(z.string().max(120)),
    isActive: z.boolean().optional()
  })
  .refine(hasAtLeastOneDefinedValue, {
    message: "At least one field must be provided"
  });

export const preferencesUpdateSchema = z
  .object({
    dateFormat: z.enum(COMPANY_DATE_FORMATS).optional(),
    currencyFormat: z.enum(COMPANY_CURRENCY_FORMATS).optional(),
    numberFormat: z.enum(COMPANY_NUMBER_FORMATS).optional(),
    decimalPrecision: z.coerce.number().int().min(0).max(4).optional(),
    timezone: optionalTrimmedString(timezoneSchema),
    language: optionalTrimmedString(z.string().min(2).max(10)),
    autoLogoutMinutes: z.coerce.number().int().min(5).max(1440).optional(),
    notificationEmailEnabled: z.boolean().optional(),
    notificationSmsEnabled: z.boolean().optional(),
    notificationWhatsappEnabled: z.boolean().optional()
  })
  .refine(hasAtLeastOneDefinedValue, {
    message: "At least one field must be provided"
  });

export const brandingColorUpdateSchema = z
  .object({
    primaryColor: optionalTrimmedString(z.string().regex(hexColorRegex, "Invalid color value"))
  })
  .refine(hasAtLeastOneDefinedValue, {
    message: "At least one field must be provided"
  });
