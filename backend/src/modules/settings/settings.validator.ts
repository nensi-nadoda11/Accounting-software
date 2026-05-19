import { z } from "zod";

import { ALL_PERMISSIONS } from "../permissions/permission.constants";
import {
  CURRENCY_FORMAT_VALUES,
  DATE_FORMAT_VALUES,
  GST_FILING_FREQUENCIES,
  GST_RATE_VALUES,
  NUMBER_FORMAT_VALUES,
  PAYMENT_MODE_KEYS,
  TABLE_DENSITIES
} from "./settings.types";
import { indianMobileRegex, passwordSchema } from "../../validators/common.validator";

const safeSettingKeyRegex = /^[a-z0-9._:-]+$/i;
const hexColorRegex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

const gstRateSchema = z.union(
  GST_RATE_VALUES.map((rate) => z.literal(rate)) as [
    z.ZodLiteral<(typeof GST_RATE_VALUES)[number]>,
    ...Array<z.ZodLiteral<(typeof GST_RATE_VALUES)[number]>>
  ]
);

export const userIdParamSchema = z.object({
  userId: z.string().uuid()
});

export const roleParamSchema = z.object({
  role: z.enum(["admin", "accountant", "staff", "auditor"])
});

export const recordIdParamSchema = z.object({
  id: z.string().uuid()
});

export const appSettingKeySchema = z
  .string()
  .min(2)
  .max(80)
  .regex(safeSettingKeyRegex, "Setting key contains invalid characters");

export const updatePermissionsSchema = z.object({
  permissions: z.array(z.enum(ALL_PERMISSIONS)).default([])
});

export const invoiceLayoutConfigSchema = z.object({
  showLogo: z.boolean().default(true),
  showSignature: z.boolean().default(false),
  showBankDetails: z.boolean().default(true),
  showQrCode: z.boolean().default(false),
  termsFooter: z.string().trim().max(500).default(""),
  footerNote: z.string().trim().max(500).default("")
});

export const createInvoiceTemplateSchema = z.object({
  templateKey: appSettingKeySchema.optional(),
  templateName: z.string().trim().min(2, "Template name is required").max(80),
  invoiceType: z.enum(["sales", "purchase", "pos", "return"]),
  layoutConfig: invoiceLayoutConfigSchema,
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true)
});

export const updateInvoiceTemplateSchema = createInvoiceTemplateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided"
);

export const createPaymentModeSchema = z.object({
  modeKey: z.enum(PAYMENT_MODE_KEYS),
  modeName: z.string().trim().min(2).max(40),
  isEnabled: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(false),
  requiresReference: z.boolean().optional().default(false),
  requiresBankAccount: z.boolean().optional().default(false),
  chequeWorkflowEnabled: z.boolean().optional().default(false)
});

export const updatePaymentModeSchema = createPaymentModeSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field must be provided"
);

export const updateTaxSettingsSchema = z
  .object({
    gstEnabled: z.boolean().optional(),
    defaultGstRate: gstRateSchema.optional(),
    taxInclusiveDefault: z.boolean().optional(),
    roundOffEnabled: z.boolean().optional(),
    hsnSacRequired: z.boolean().optional(),
    gstFilingFrequency: z.enum(GST_FILING_FREQUENCIES).optional(),
    compositionScheme: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const updateUiPreferencesSchema = z
  .object({
    accentColor: z.string().regex(hexColorRegex, "Accent color must be a valid hex value").nullable().optional(),
    compactMode: z.boolean().optional(),
    tableDensity: z.enum(TABLE_DENSITIES).optional(),
    dateFormat: z.enum(DATE_FORMAT_VALUES).optional(),
    currencyFormat: z.enum(CURRENCY_FORMAT_VALUES).optional(),
    numberFormat: z.enum(NUMBER_FORMAT_VALUES).optional()
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field must be provided");

export const updateProfileSettingsSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  mobileNumber: z.string().regex(indianMobileRegex, "Invalid Indian mobile number").nullable().optional()
});

export const changePasswordSettingsSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Confirm password must match password"
  });
