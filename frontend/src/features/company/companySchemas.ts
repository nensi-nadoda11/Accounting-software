import { z } from "zod";

const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const tanRegex = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const cinRegex = /^[A-Z0-9]{8,21}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const upiRegex = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const branchCodeRegex = /^[A-Z0-9_-]{2,20}$/;
const indianMobileRegex = /^[6-9]\d{9}$/;
const prefixRegex = /^[A-Z0-9/_-]{1,15}$/;

const optionalTrimmed = (max?: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => !value || !max || value.length <= max, max ? `Must be ${max} characters or less` : "Invalid value");

const optionalRegex = (regex: RegExp, message: string, max?: number) =>
  optionalTrimmed(max).refine((value) => !value || regex.test(value), message);

export const companyProfileSchema = z.object({
  name: z.string().trim().min(2, "Company name is required").max(150, "Must be 150 characters or less"),
  legalName: optionalTrimmed(150),
  businessType: optionalTrimmed(100),
  industryType: optionalTrimmed(100),
  gstNumber: optionalRegex(gstRegex, "Enter a valid GST number", 15),
  panNumber: optionalRegex(panRegex, "Enter a valid PAN number", 10),
  cinNumber: optionalRegex(cinRegex, "Enter a valid CIN number", 21),
  email: z.string().transform((value) => value.trim().toLowerCase()).refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email"),
  mobileNumber: optionalRegex(indianMobileRegex, "Enter a valid mobile number", 10),
  website: z.string().transform((value) => value.trim()).refine((value) => !value || z.url().safeParse(value).success, "Enter a valid website URL"),
  addressLine1: optionalTrimmed(200),
  addressLine2: optionalTrimmed(200),
  city: optionalTrimmed(100),
  state: optionalTrimmed(100),
  pincode: optionalRegex(/^\d{6}$/, "Enter a valid 6 digit pincode", 6),
  country: z.string().trim().min(2, "Country is required").max(100, "Must be 100 characters or less"),
  timezone: z.string().trim().min(1, "Timezone is required"),
  currency: z.string().trim().min(3, "Currency is required").max(10, "Must be 10 characters or less"),
  language: z.string().trim().min(2, "Language is required").max(10, "Must be 10 characters or less"),
});

export const taxSettingsSchema = z
  .object({
    gstEnabled: z.boolean(),
    gstType: z.enum(["regular", "composition", "unregistered"]),
    compositionScheme: z.boolean(),
    taxInclusivePricing: z.boolean(),
    defaultGstRate: z.string(),
    hsnSacEnabled: z.boolean(),
    eInvoiceEnabled: z.boolean(),
    eWayBillEnabled: z.boolean(),
    gstFilingFrequency: z.enum(["monthly", "quarterly", "annually"]),
    tanNumber: optionalRegex(tanRegex, "Enter a valid TAN number", 10),
  })
  .refine(
    (value) => !value.gstEnabled || !value.defaultGstRate || (Number(value.defaultGstRate) >= 0 && Number(value.defaultGstRate) <= 28),
    {
      path: ["defaultGstRate"],
      message: "Default GST rate must be between 0 and 28",
    },
  );

export const financialYearSchema = z
  .object({
    name: z.string().trim().min(2, "Financial year name is required").max(80, "Must be 80 characters or less"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    isActive: z.boolean(),
  })
  .refine((value) => new Date(value.endDate) > new Date(value.startDate), {
    path: ["endDate"],
    message: "End date must be after start date",
  });

export const bankAccountSchema = z.object({
  bankName: z.string().trim().min(2, "Bank name is required").max(120, "Must be 120 characters or less"),
  accountHolderName: z.string().trim().min(2, "Account holder is required").max(120, "Must be 120 characters or less"),
  accountNumber: z.string().trim().min(6, "Account number is required").max(34, "Must be 34 characters or less"),
  ifscCode: z.string().trim().toUpperCase().regex(ifscRegex, "Enter a valid IFSC code"),
  branchName: optionalTrimmed(120),
  upiId: optionalRegex(upiRegex, "Enter a valid UPI ID", 256),
  qrImageUrl: z.string(),
  openingBalance: z.string().refine((value) => Number(value) >= 0, "Opening balance must be 0 or more"),
  accountType: z.enum(["current", "savings", "cash_credit", "overdraft", "other"]),
  isDefault: z.boolean(),
  isActive: z.boolean(),
}).refine((value) => !value.isDefault || value.isActive, {
  path: ["isDefault"],
  message: "Default account must be active",
});

export const invoiceSettingsSchema = z
  .object({
    salesInvoicePrefix: z.string().trim().toUpperCase().regex(prefixRegex, "Enter a valid prefix"),
    purchaseInvoicePrefix: z.string().trim().toUpperCase().regex(prefixRegex, "Enter a valid prefix"),
    creditNotePrefix: z.string().trim().toUpperCase().regex(prefixRegex, "Enter a valid prefix"),
    debitNotePrefix: z.string().trim().toUpperCase().regex(prefixRegex, "Enter a valid prefix"),
    autoNumbering: z.boolean(),
    nextSalesInvoiceNumber: z.string().refine((value) => Number(value) > 0, "Must be greater than 0"),
    nextPurchaseInvoiceNumber: z.string().refine((value) => Number(value) > 0, "Must be greater than 0"),
    numberPadding: z.string().refine((value) => Number(value) >= 1 && Number(value) <= 10, "Padding must be between 1 and 10"),
    termsAndConditions: optionalTrimmed(2000),
    footerNote: optionalTrimmed(1000),
    showCompanyLogo: z.boolean(),
    showBankDetails: z.boolean(),
    showQrCode: z.boolean(),
    showSignature: z.boolean(),
    roundOffEnabled: z.boolean(),
    decimalPrecision: z.string().refine((value) => Number(value) >= 0 && Number(value) <= 4, "Precision must be between 0 and 4"),
    taxDisplayFormat: z.enum(["item_wise", "summary", "both"]),
    invoiceTemplate: z.enum(["gst_a4", "pos", "thermal"]),
  })
  .refine(
    (value) =>
      new Set([
        value.salesInvoicePrefix,
        value.purchaseInvoicePrefix,
        value.creditNotePrefix,
        value.debitNotePrefix,
      ]).size === 4,
    {
      path: ["salesInvoicePrefix"],
      message: "Each prefix must be unique",
    },
  );

export const branchSchema = z.object({
  branchName: z.string().trim().min(2, "Branch name is required").max(150, "Must be 150 characters or less"),
  branchCode: z.string().trim().toUpperCase().regex(branchCodeRegex, "Enter a valid branch code"),
  gstNumber: optionalRegex(gstRegex, "Enter a valid GST number", 15),
  email: z.string().transform((value) => value.trim().toLowerCase()).refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email"),
  mobileNumber: optionalRegex(indianMobileRegex, "Enter a valid mobile number", 10),
  addressLine1: optionalTrimmed(200),
  addressLine2: optionalTrimmed(200),
  city: optionalTrimmed(100),
  state: optionalTrimmed(100),
  pincode: optionalRegex(/^\d{6}$/, "Enter a valid 6 digit pincode", 6),
  managerName: optionalTrimmed(120),
  isActive: z.boolean(),
});

export const preferencesSchema = z.object({
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"]),
  currencyFormat: z.enum(["symbol_first", "symbol_last"]),
  numberFormat: z.enum(["indian", "western"]),
  decimalPrecision: z.string().refine((value) => Number(value) >= 0 && Number(value) <= 4, "Precision must be between 0 and 4"),
  timezone: z.string().trim().min(1, "Timezone is required"),
  language: z.string().trim().min(2, "Language is required").max(10, "Must be 10 characters or less"),
  autoLogoutMinutes: z.string().refine((value) => Number(value) >= 5 && Number(value) <= 1440, "Auto logout must be between 5 and 1440 minutes"),
  notificationEmailEnabled: z.boolean(),
  notificationSmsEnabled: z.boolean(),
  notificationWhatsappEnabled: z.boolean(),
});
