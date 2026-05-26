import { z } from "zod";

import { gstRegex, indianMobileRegex } from "../../validators/common.validator";
import {
  SUPPLIER_EXPORT_FORMATS,
  SUPPLIER_LEDGER_TRANSACTION_TYPES,
  SUPPLIER_MUTABLE_STATUSES,
  SUPPLIER_STATUSES,
  SUPPLIER_TAX_TYPES,
  SUPPLIER_TYPES
} from "./suppliers.types";

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const tanRegex = /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;
const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const upiRegex = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const meaningfulTextRegex = /[\p{L}\p{N}]/u;

const trimToNull = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  return value;
};

const parseBooleanQuery = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
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
};

const optionalNullableString = (maxLength: number) =>
  z.preprocess(trimToNull, z.string().max(maxLength).nullable().optional());

const optionalNullableEmail = z.preprocess(
  trimToNull,
  z
    .email()
    .transform((value) => value.toLowerCase())
    .nullable()
    .optional()
);

const optionalNullableWebsite = z.preprocess(
  trimToNull,
  z
    .url()
    .max(255)
    .nullable()
    .optional()
);

const optionalNullableGst = z.preprocess(
  trimToNull,
  z
    .string()
    .transform((value) => value.toUpperCase())
    .refine((value) => gstRegex.test(value), "Invalid GST number")
    .nullable()
    .optional()
);

const optionalNullablePan = z.preprocess(
  trimToNull,
  z
    .string()
    .transform((value) => value.toUpperCase())
    .refine((value) => panRegex.test(value), "Invalid PAN number")
    .nullable()
    .optional()
);

const optionalNullableTan = z.preprocess(
  trimToNull,
  z
    .string()
    .transform((value) => value.toUpperCase())
    .refine((value) => tanRegex.test(value), "Invalid TAN number")
    .nullable()
    .optional()
);

const optionalNullableIfsc = z.preprocess(
  trimToNull,
  z
    .string()
    .transform((value) => value.toUpperCase())
    .refine((value) => ifscRegex.test(value), "Invalid IFSC code")
    .nullable()
    .optional()
);

const optionalNullableUpi = z.preprocess(
  trimToNull,
  z
    .string()
    .refine((value) => upiRegex.test(value), "Invalid UPI ID")
    .nullable()
    .optional()
);

const optionalNullableAccountNumber = z.preprocess(
  trimToNull,
  z
    .string()
    .min(6, "Account number must be at least 6 characters")
    .max(34, "Account number must be at most 34 characters")
    .nullable()
    .optional()
);

const optionalNullableMobile = z.preprocess(
  trimToNull,
  z
    .string()
    .regex(indianMobileRegex, "Invalid Indian mobile number")
    .nullable()
    .optional()
);

const optionalMobile = z.preprocess(
  (value) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "string") {
      return value.trim();
    }

    return value;
  },
  z.string().regex(indianMobileRegex, "Invalid Indian mobile number").optional()
);

const optionalNullablePincode = z.preprocess(
  trimToNull,
  z
    .string()
    .regex(pincodeRegex, "Invalid Indian pincode")
    .nullable()
    .optional()
);

const supplierBodyFields = {
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be at most 150 characters")
    .refine((value) => meaningfulTextRegex.test(value), "Name must contain letters or numbers"),
  supplierType: z.enum(SUPPLIER_TYPES),
  businessName: optionalNullableString(150),
  contactPerson: optionalNullableString(120),
  mobile: z.string().regex(indianMobileRegex, "Invalid Indian mobile number"),
  alternateMobile: optionalNullableMobile,
  email: optionalNullableEmail,
  website: optionalNullableWebsite,
  gstNumber: optionalNullableGst,
  panNumber: optionalNullablePan,
  tanNumber: optionalNullableTan,
  taxType: z.enum(SUPPLIER_TAX_TYPES).optional().default("unregistered"),
  gstState: optionalNullableString(120),
  reverseChargeApplicable: z.boolean().optional().default(false),
  msmeRegistered: z.boolean().optional().default(false),
  billingAddressLine1: optionalNullableString(200),
  billingAddressLine2: optionalNullableString(200),
  billingCity: optionalNullableString(120),
  billingState: optionalNullableString(120),
  billingPincode: optionalNullablePincode,
  billingCountry: optionalNullableString(120),
  shippingAddressLine1: optionalNullableString(200),
  shippingAddressLine2: optionalNullableString(200),
  shippingCity: optionalNullableString(120),
  shippingState: optionalNullableString(120),
  shippingPincode: optionalNullablePincode,
  shippingCountry: optionalNullableString(120),
  sameAsBilling: z.boolean().optional().default(true),
  creditLimit: z.coerce.number().min(0).optional().default(0),
  creditDays: z.coerce.number().int().min(0).max(365).optional().default(0),
  paymentTerms: optionalNullableString(500),
  defaultGstRate: z.coerce.number().min(0).max(28).optional().default(0),
  defaultDiscount: z.coerce.number().min(0).max(100).optional().default(0),
  bankName: optionalNullableString(150),
  accountHolderName: optionalNullableString(150),
  accountNumber: optionalNullableAccountNumber,
  ifscCode: optionalNullableIfsc,
  bankBranch: optionalNullableString(150),
  upiId: optionalNullableUpi,
  status: z.enum(SUPPLIER_MUTABLE_STATUSES).optional().default("active"),
  isPreferred: z.boolean().optional().default(false),
  notes: optionalNullableString(2000)
} satisfies Record<string, z.ZodTypeAny>;

const issueIfAddressIncomplete = (
  value: Record<string, unknown>,
  ctx: z.RefinementCtx,
  fieldPrefix: "billing" | "shipping"
) => {
  const line1 = value[`${fieldPrefix}AddressLine1`] as string | null | undefined;
  const line2 = value[`${fieldPrefix}AddressLine2`] as string | null | undefined;
  const city = value[`${fieldPrefix}City`] as string | null | undefined;
  const state = value[`${fieldPrefix}State`] as string | null | undefined;
  const country = value[`${fieldPrefix}Country`] as string | null | undefined;
  const pincode = value[`${fieldPrefix}Pincode`] as string | null | undefined;

  const hasAddressData = [line1, line2, city, state, country].some(
    (entry) => typeof entry === "string" && entry.length > 0
  );

  if (hasAddressData && !pincode) {
    ctx.addIssue({
      code: "custom",
      path: [`${fieldPrefix}Pincode`],
      message: `${fieldPrefix === "billing" ? "Billing" : "Shipping"} pincode is required when address is provided`
    });
  }
};

const validateSupplierBody = (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
  const mobile = value.mobile as string | undefined;
  const alternateMobile = value.alternateMobile as string | null | undefined;
  const gstNumber = value.gstNumber as string | null | undefined;
  const panNumber = value.panNumber as string | null | undefined;

  if (mobile && alternateMobile && mobile === alternateMobile) {
    ctx.addIssue({
      code: "custom",
      path: ["alternateMobile"],
      message: "Alternate mobile cannot be the same as mobile"
    });
  }

  if (gstNumber && panNumber && gstNumber.slice(2, 12) !== panNumber) {
    ctx.addIssue({
      code: "custom",
      path: ["panNumber"],
      message: "PAN must match the PAN section of GST number"
    });
  }

  issueIfAddressIncomplete(value, ctx, "billing");

  if (!value.sameAsBilling) {
    issueIfAddressIncomplete(value, ctx, "shipping");
  }
};

export const createSupplierSchema = z
  .object(supplierBodyFields)
  .strict()
  .superRefine(validateSupplierBody);

export const updateSupplierSchema = z
  .object({
    name: supplierBodyFields.name.optional(),
    supplierType: supplierBodyFields.supplierType.optional(),
    businessName: supplierBodyFields.businessName,
    contactPerson: supplierBodyFields.contactPerson,
    mobile: optionalMobile,
    alternateMobile: supplierBodyFields.alternateMobile,
    email: supplierBodyFields.email,
    website: supplierBodyFields.website,
    gstNumber: supplierBodyFields.gstNumber,
    panNumber: supplierBodyFields.panNumber,
    tanNumber: supplierBodyFields.tanNumber,
    taxType: z.enum(SUPPLIER_TAX_TYPES).optional(),
    gstState: supplierBodyFields.gstState,
    reverseChargeApplicable: z.boolean().optional(),
    msmeRegistered: z.boolean().optional(),
    billingAddressLine1: supplierBodyFields.billingAddressLine1,
    billingAddressLine2: supplierBodyFields.billingAddressLine2,
    billingCity: supplierBodyFields.billingCity,
    billingState: supplierBodyFields.billingState,
    billingPincode: supplierBodyFields.billingPincode,
    billingCountry: supplierBodyFields.billingCountry,
    shippingAddressLine1: supplierBodyFields.shippingAddressLine1,
    shippingAddressLine2: supplierBodyFields.shippingAddressLine2,
    shippingCity: supplierBodyFields.shippingCity,
    shippingState: supplierBodyFields.shippingState,
    shippingPincode: supplierBodyFields.shippingPincode,
    shippingCountry: supplierBodyFields.shippingCountry,
    sameAsBilling: z.boolean().optional(),
    creditLimit: z.coerce.number().min(0).optional(),
    creditDays: z.coerce.number().int().min(0).max(365).optional(),
    paymentTerms: supplierBodyFields.paymentTerms,
    defaultGstRate: z.coerce.number().min(0).max(28).optional(),
    defaultDiscount: z.coerce.number().min(0).max(100).optional(),
    bankName: supplierBodyFields.bankName,
    accountHolderName: supplierBodyFields.accountHolderName,
    accountNumber: supplierBodyFields.accountNumber,
    ifscCode: supplierBodyFields.ifscCode,
    bankBranch: supplierBodyFields.bankBranch,
    upiId: supplierBodyFields.upiId,
    notes: supplierBodyFields.notes
  })
  .strict()
  .superRefine(validateSupplierBody);

export const listSupplierQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().max(150).nullable().optional()),
  status: z.enum(SUPPLIER_STATUSES).optional(),
  supplierType: z.enum(SUPPLIER_TYPES).optional(),
  taxType: z.enum(SUPPLIER_TAX_TYPES).optional(),
  hasOutstanding: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  isBlacklisted: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  isPreferred: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  sortBy: z.enum(["name", "createdAt", "outstandingPayable", "supplierCode"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc")
});

const dateRangeSchema = z
  .object({
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional()
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

export const ledgerQuerySchema = dateRangeSchema.extend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  transactionType: z.enum(SUPPLIER_LEDGER_TRANSACTION_TYPES).optional()
});

export const purchasesQuerySchema = dateRangeSchema.extend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.preprocess(trimToNull, z.string().max(50).nullable().optional())
});

export const paymentsQuerySchema = dateRangeSchema.extend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

export const supplierIdParamSchema = z.object({
  id: z.string().uuid()
});

export const statusSchema = z
  .object({
    status: z.enum(SUPPLIER_MUTABLE_STATUSES)
  })
  .strict();

export const blacklistSchema = z
  .object({
    isBlacklisted: z.boolean(),
    reason: optionalNullableString(500)
  })
  .strict();

export const preferredSchema = z
  .object({
    isPreferred: z.boolean()
  })
  .strict();

export const exportSuppliersQuerySchema = listSupplierQuerySchema.extend({
  format: z.enum(SUPPLIER_EXPORT_FORMATS).optional().default("csv")
});

export const ledgerExportQuerySchema = dateRangeSchema.extend({
  transactionType: z.enum(SUPPLIER_LEDGER_TRANSACTION_TYPES).optional(),
  format: z.enum(SUPPLIER_EXPORT_FORMATS).optional().default("csv")
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSupplierQuery = z.infer<typeof listSupplierQuerySchema>;
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
export type PurchasesQuery = z.infer<typeof purchasesQuerySchema>;
export type PaymentsQuery = z.infer<typeof paymentsQuerySchema>;
export type StatusInput = z.infer<typeof statusSchema>;
export type BlacklistInput = z.infer<typeof blacklistSchema>;
export type PreferredInput = z.infer<typeof preferredSchema>;
export type ExportSuppliersQuery = z.infer<typeof exportSuppliersQuerySchema>;
export type LedgerExportQuery = z.infer<typeof ledgerExportQuerySchema>;
