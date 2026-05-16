import { z } from "zod";

import type { CustomerFormInput } from "../../types/customer";

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

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

export const customerFormSchema = z
  .object({
    name: z.preprocess(trim, z.string().min(2, "Name must be at least 2 characters").max(150, "Name must be at most 150 characters")),
    customerType: z.enum(["individual", "business"], { message: "Select customer type" }),
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
    taxType: z.enum(["registered", "unregistered", "composition"]),
    billingAddressLine1: textField(200),
    billingAddressLine2: textField(200),
    billingCity: textField(120),
    billingState: textField(120),
    billingPincode: z.preprocess(
      trimToNull,
      z.string().regex(PINCODE_REGEX, "Enter a valid 6-digit pincode").nullable(),
    ),
    billingCountry: z.preprocess(trim, z.string().min(1, "Billing country is required").max(120)),
    shippingAddressLine1: textField(200),
    shippingAddressLine2: textField(200),
    shippingCity: textField(120),
    shippingState: textField(120),
    shippingPincode: z.preprocess(
      trimToNull,
      z.string().regex(PINCODE_REGEX, "Enter a valid 6-digit pincode").nullable(),
    ),
    shippingCountry: z.preprocess(trim, z.string().min(1, "Shipping country is required").max(120)),
    sameAsBilling: z.boolean(),
    openingBalanceAmount: decimalField(0),
    openingBalanceType: z.enum(["debit", "credit", "none"]),
    creditLimit: decimalField(0),
    creditDays: z.coerce.number({ message: "Enter valid credit days" }).int().min(0, "Must be at least 0").max(365, "Must be 365 or less"),
    defaultDiscount: decimalField(0, 100),
    status: z.enum(["active", "inactive"]),
    isBlacklisted: z.boolean(),
    blacklistReason: textField(500),
    notes: textField(1000),
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

    if (value.openingBalanceAmount > 0 && value.openingBalanceType === "none") {
      ctx.addIssue({
        code: "custom",
        path: ["openingBalanceType"],
        message: "Select debit or credit when opening balance is greater than 0",
      });
    }

    if (value.openingBalanceAmount === 0 && value.openingBalanceType !== "none") {
      ctx.addIssue({
        code: "custom",
        path: ["openingBalanceType"],
        message: "Opening balance type must be none when amount is 0",
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
    (value): CustomerFormInput => ({
      ...value,
      businessName: value.businessName,
      contactPerson: value.contactPerson,
      billingCountry: value.billingCountry.trim() || "India",
      shippingCountry: value.shippingCountry.trim() || "India",
    }),
  );

export type CustomerFormValues = z.input<typeof customerFormSchema>;
