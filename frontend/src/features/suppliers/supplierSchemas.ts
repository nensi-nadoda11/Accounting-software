import { z } from "zod";

import type { SupplierFormInput } from "../../types/supplier";

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const TAN_REGEX = /^[A-Z]{4}[0-9]{5}[A-Z]{1}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

const trim = (value: unknown) => (typeof value === "string" ? value.trim() : value);

const trimToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const next = value.trim();
  return next ? next : null;
};

const textField = (max: number) =>
  z.preprocess(trimToNull, z.string().max(max, `Must be ${max} characters or fewer`).nullable());

const decimalField = (min: number, max?: number) =>
  z.coerce
    .number({ message: "Enter a valid number" })
    .min(min, `Must be at least ${min}`)
    .refine((value) => (max === undefined ? true : value <= max), max === undefined ? undefined : `Must be ${max} or less`);

export const supplierFormSchema = z
  .object({
    name: z.preprocess(trim, z.string().min(2, "Name must be at least 2 characters").max(150, "Name must be at most 150 characters")),
    supplierType: z.enum(["individual", "business", "manufacturer", "distributor", "wholesaler"], {
      message: "Select supplier type",
    }),
    businessName: textField(150),
    contactPerson: textField(120),
    mobile: z.preprocess(trim, z.string().regex(INDIAN_MOBILE_REGEX, "Enter a valid 10-digit Indian mobile number")),
    alternateMobile: z.preprocess(
      trimToNull,
      z.string().regex(INDIAN_MOBILE_REGEX, "Enter a valid 10-digit Indian mobile number").nullable(),
    ),
    email: z.preprocess(
      trimToNull,
      z
        .string()
        .email("Enter a valid email address")
        .transform((value) => value.toLowerCase())
        .nullable(),
    ),
    website: z.preprocess(trimToNull, z.string().url("Enter a valid URL").max(255).nullable()),
    gstNumber: z.preprocess(
      trimToNull,
      z
        .string()
        .transform((value) => value.toUpperCase())
        .refine((value) => GST_REGEX.test(value), "Enter a valid GST number")
        .nullable(),
    ),
    panNumber: z.preprocess(
      trimToNull,
      z
        .string()
        .transform((value) => value.toUpperCase())
        .refine((value) => PAN_REGEX.test(value), "Enter a valid PAN number")
        .nullable(),
    ),
    tanNumber: z.preprocess(
      trimToNull,
      z
        .string()
        .transform((value) => value.toUpperCase())
        .refine((value) => TAN_REGEX.test(value), "Enter a valid TAN number")
        .nullable(),
    ),
    taxType: z.enum(["registered", "unregistered", "composition"]),
    gstState: textField(120),
    reverseChargeApplicable: z.boolean(),
    msmeRegistered: z.boolean(),
    billingAddressLine1: textField(200),
    billingAddressLine2: textField(200),
    billingCity: textField(120),
    billingState: textField(120),
    billingPincode: z.preprocess(
      trimToNull,
      z.string().regex(PINCODE_REGEX, "Enter a valid 6-digit pincode").nullable(),
    ),
    billingCountry: z.preprocess(trim, z.string().max(120).optional().catch("India")),
    shippingAddressLine1: textField(200),
    shippingAddressLine2: textField(200),
    shippingCity: textField(120),
    shippingState: textField(120),
    shippingPincode: z.preprocess(
      trimToNull,
      z.string().regex(PINCODE_REGEX, "Enter a valid 6-digit pincode").nullable(),
    ),
    shippingCountry: z.preprocess(trim, z.string().max(120).optional().catch("India")),
    sameAsBilling: z.boolean(),
    creditLimit: decimalField(0),
    creditDays: z.coerce.number({ message: "Enter valid credit days" }).int().min(0, "Must be at least 0").max(365, "Must be 365 or less"),
    paymentTerms: textField(500),
    defaultGstRate: decimalField(0, 28),
    defaultDiscount: decimalField(0, 100),
    bankName: textField(150),
    accountHolderName: textField(150),
    accountNumber: z.preprocess(
      trimToNull,
      z.string().min(6, "Account number must be at least 6 characters").max(34, "Account number must be at most 34 characters").nullable(),
    ),
    ifscCode: z.preprocess(
      trimToNull,
      z
        .string()
        .transform((value) => value.toUpperCase())
        .refine((value) => IFSC_REGEX.test(value), "Enter a valid IFSC code")
        .nullable(),
    ),
    bankBranch: textField(150),
    upiId: z.preprocess(trimToNull, z.string().regex(UPI_REGEX, "Enter a valid UPI ID").nullable()),
    status: z.enum(["active", "inactive", "blocked"]),
    isBlacklisted: z.boolean(),
    blacklistReason: textField(500),
    isPreferred: z.boolean(),
    notes: textField(2000),
  })
  .superRefine((value, ctx) => {
    if (value.alternateMobile && value.alternateMobile === value.mobile) {
      ctx.addIssue({
        code: "custom",
        path: ["alternateMobile"],
        message: "Alternate mobile cannot be the same as mobile",
      });
    }

    if (value.gstNumber && value.panNumber && value.gstNumber.slice(2, 12) !== value.panNumber) {
      ctx.addIssue({
        code: "custom",
        path: ["panNumber"],
        message: "PAN must match the PAN section of GST number",
      });
    }

    const billingHasData = [
      value.billingAddressLine1,
      value.billingAddressLine2,
      value.billingCity,
      value.billingState,
      value.billingCountry,
    ].some(Boolean);

    if (billingHasData && !value.billingPincode) {
      ctx.addIssue({
        code: "custom",
        path: ["billingPincode"],
        message: "Billing pincode is required when address is provided",
      });
    }

    const shippingHasData = [
      value.shippingAddressLine1,
      value.shippingAddressLine2,
      value.shippingCity,
      value.shippingState,
      value.shippingCountry,
    ].some(Boolean);

    if (!value.sameAsBilling && shippingHasData && !value.shippingPincode) {
      ctx.addIssue({
        code: "custom",
        path: ["shippingPincode"],
        message: "Shipping pincode is required when address is provided",
      });
    }
  })
  .transform(
    (value): SupplierFormInput => ({
      ...value,
      billingCountry: value.billingCountry?.trim() || "India",
      shippingCountry: value.shippingCountry?.trim() || "India",
    }),
  );

export type SupplierFormValues = z.input<typeof supplierFormSchema>;
