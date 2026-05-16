import { z } from "zod";

import { gstRegex, indianMobileRegex } from "../../validators/common.validator";
import {
  CUSTOMER_EXPORT_FORMATS,
  CUSTOMER_LEDGER_TRANSACTION_TYPES,
  CUSTOMER_MUTABLE_STATUSES,
  CUSTOMER_OPENING_BALANCE_TYPES,
  CUSTOMER_STATUSES,
  CUSTOMER_TAX_TYPES,
  CUSTOMER_TYPES
} from "./customers.types";

const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;
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

const customerBodyFields = {
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be at most 150 characters")
    .refine((value) => meaningfulTextRegex.test(value), "Name must contain letters or numbers"),
  customerType: z.enum(CUSTOMER_TYPES),
  businessName: optionalNullableString(150),
  contactPerson: optionalNullableString(120),
  mobile: z.string().regex(indianMobileRegex, "Invalid Indian mobile number"),
  alternateMobile: optionalNullableMobile,
  email: optionalNullableEmail,
  gstNumber: optionalNullableGst,
  panNumber: optionalNullablePan,
  taxType: z.enum(CUSTOMER_TAX_TYPES).optional().default("unregistered"),
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
  sameAsBilling: z.boolean().optional().default(false),
  openingBalanceAmount: z.coerce.number().min(0).optional().default(0),
  openingBalanceType: z.enum(CUSTOMER_OPENING_BALANCE_TYPES).optional().default("none"),
  creditLimit: z.coerce.number().min(0).optional().default(0),
  creditDays: z.coerce.number().int().min(0).max(365).optional().default(0),
  defaultDiscount: z.coerce.number().min(0).max(100).optional().default(0),
  status: z.enum(CUSTOMER_MUTABLE_STATUSES).optional().default("active"),
  notes: optionalNullableString(1000)
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

const validateCustomerBody = (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
  const mobile = value.mobile as string | undefined;
  const alternateMobile = value.alternateMobile as string | null | undefined;
  const gstNumber = value.gstNumber as string | null | undefined;
  const panNumber = value.panNumber as string | null | undefined;
  const openingBalanceAmount = value.openingBalanceAmount as number | undefined;
  const openingBalanceType = value.openingBalanceType as
    | (typeof CUSTOMER_OPENING_BALANCE_TYPES)[number]
    | undefined;

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

  if (openingBalanceAmount !== undefined && openingBalanceAmount > 0 && openingBalanceType === "none") {
    ctx.addIssue({
      code: "custom",
      path: ["openingBalanceType"],
      message: "Opening balance type must be debit or credit when amount is greater than 0"
    });
  }

  if (openingBalanceAmount !== undefined && openingBalanceAmount === 0 && openingBalanceType && openingBalanceType !== "none") {
    ctx.addIssue({
      code: "custom",
      path: ["openingBalanceType"],
      message: "Opening balance type must be none when amount is 0"
    });
  }

  issueIfAddressIncomplete(value, ctx, "billing");
  issueIfAddressIncomplete(value, ctx, "shipping");
};

export const createCustomerSchema = z
  .object(customerBodyFields)
  .strict()
  .superRefine(validateCustomerBody);

export const updateCustomerSchema = z
  .object({
    name: customerBodyFields.name.optional(),
    customerType: customerBodyFields.customerType.optional(),
    businessName: customerBodyFields.businessName,
    contactPerson: customerBodyFields.contactPerson,
    mobile: optionalMobile,
    alternateMobile: customerBodyFields.alternateMobile,
    email: customerBodyFields.email,
    gstNumber: customerBodyFields.gstNumber,
    panNumber: customerBodyFields.panNumber,
    taxType: z.enum(CUSTOMER_TAX_TYPES).optional(),
    billingAddressLine1: customerBodyFields.billingAddressLine1,
    billingAddressLine2: customerBodyFields.billingAddressLine2,
    billingCity: customerBodyFields.billingCity,
    billingState: customerBodyFields.billingState,
    billingPincode: customerBodyFields.billingPincode,
    billingCountry: customerBodyFields.billingCountry,
    shippingAddressLine1: customerBodyFields.shippingAddressLine1,
    shippingAddressLine2: customerBodyFields.shippingAddressLine2,
    shippingCity: customerBodyFields.shippingCity,
    shippingState: customerBodyFields.shippingState,
    shippingPincode: customerBodyFields.shippingPincode,
    shippingCountry: customerBodyFields.shippingCountry,
    sameAsBilling: z.boolean().optional(),
    openingBalanceAmount: z.coerce.number().min(0).optional(),
    openingBalanceType: z.enum(CUSTOMER_OPENING_BALANCE_TYPES).optional(),
    creditLimit: z.coerce.number().min(0).optional(),
    creditDays: z.coerce.number().int().min(0).max(365).optional(),
    defaultDiscount: z.coerce.number().min(0).max(100).optional(),
    notes: customerBodyFields.notes
  })
  .strict()
  .superRefine(validateCustomerBody);

export const listCustomerQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().max(150).nullable().optional()),
  status: z.enum(CUSTOMER_STATUSES).optional(),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  taxType: z.enum(CUSTOMER_TAX_TYPES).optional(),
  hasOutstanding: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  isBlacklisted: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  sortBy: z.enum(["name", "createdAt", "outstandingAmount", "customerCode"]).optional().default("createdAt"),
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
  transactionType: z.enum(CUSTOMER_LEDGER_TRANSACTION_TYPES).optional()
});

export const paymentsQuerySchema = dateRangeSchema.extend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

export const customerIdParamSchema = z.object({
  id: z.string().uuid()
});

export const statusSchema = z
  .object({
    status: z.enum(CUSTOMER_MUTABLE_STATUSES)
  })
  .strict();

export const blacklistSchema = z
  .object({
    isBlacklisted: z.boolean(),
    reason: optionalNullableString(500)
  })
  .strict();

export const exportCustomersQuerySchema = listCustomerQuerySchema.extend({
  format: z.enum(CUSTOMER_EXPORT_FORMATS).optional().default("csv")
});

export const ledgerExportQuerySchema = dateRangeSchema.extend({
  transactionType: z.enum(CUSTOMER_LEDGER_TRANSACTION_TYPES).optional(),
  format: z.enum(CUSTOMER_EXPORT_FORMATS).optional().default("csv")
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomerQuery = z.infer<typeof listCustomerQuerySchema>;
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
export type PaymentsQuery = z.infer<typeof paymentsQuerySchema>;
export type StatusInput = z.infer<typeof statusSchema>;
export type BlacklistInput = z.infer<typeof blacklistSchema>;
export type ExportCustomersQuery = z.infer<typeof exportCustomersQuerySchema>;
export type LedgerExportQuery = z.infer<typeof ledgerExportQuerySchema>;
