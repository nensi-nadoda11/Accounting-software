import { z } from "zod";

import type { PermissionKey } from "../../types/auth";

const hexColorRegex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const indianMobileRegex = /^[6-9]\d{9}$/;
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const settingsTabKeys = [
  "permissions",
  "invoice-templates",
  "tax-settings",
  "payment-modes",
  "theme",
] as const;

export type SettingsTabKey = (typeof settingsTabKeys)[number];

export const invoiceTemplateSchema = z.object({
  templateKey: z.string().trim().min(2).max(80).optional().or(z.literal("")),
  templateName: z.string().trim().min(2, "Template name is required").max(80),
  invoiceType: z.enum(["sales", "purchase", "pos", "return"]),
  layoutConfig: z.object({
    showLogo: z.boolean(),
    showSignature: z.boolean(),
    showBankDetails: z.boolean(),
    showQrCode: z.boolean(),
    termsFooter: z.string().trim().max(500),
    footerNote: z.string().trim().max(500),
  }),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export const paymentModeSchema = z.object({
  modeKey: z.enum(["cash", "bank_transfer", "upi", "card", "cheque", "wallet", "net_banking"]),
  modeName: z.string().trim().min(2).max(40),
  isEnabled: z.boolean(),
  isDefault: z.boolean(),
  requiresReference: z.boolean(),
  requiresBankAccount: z.boolean(),
  chequeWorkflowEnabled: z.boolean(),
});

export const taxSettingsSchema = z.object({
  gstEnabled: z.boolean(),
  defaultGstRate: z.union([
    z.literal(0),
    z.literal(0.25),
    z.literal(3),
    z.literal(5),
    z.literal(12),
    z.literal(18),
    z.literal(28),
  ]),
  taxInclusiveDefault: z.boolean(),
  roundOffEnabled: z.boolean(),
  hsnSacRequired: z.boolean(),
  gstFilingFrequency: z.enum(["monthly", "quarterly", "annually"]),
  compositionScheme: z.boolean(),
});

export const uiPreferencesSchema = z.object({
  accentColor: z.string().regex(hexColorRegex, "Enter a valid hex color"),
  compactMode: z.boolean(),
  tableDensity: z.enum(["compact", "normal"]),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"]),
  currencyFormat: z.enum(["symbol_first", "symbol_last", "code"]),
  numberFormat: z.enum(["indian", "western"]),
});

export const profileSettingsSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  mobileNumber: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || indianMobileRegex.test(value), "Enter a valid Indian mobile number"),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(strongPasswordRegex, "Password must include uppercase, lowercase, number and special character"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Confirm password must match password",
  });

export const toSortedPermissionSelection = (permissions: PermissionKey[]) =>
  Array.from(new Set(permissions)).sort();
