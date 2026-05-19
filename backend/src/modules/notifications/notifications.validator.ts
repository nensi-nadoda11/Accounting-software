import { z } from "zod";

import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_FREQUENCIES,
  NOTIFICATION_LOG_STATUSES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_TYPES
} from "./notifications.types";

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

const parseDateInput = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  return value;
};

const optionalDate = z.preprocess(parseDateInput, z.coerce.date().nullable().optional());

const optionalNullableString = (maxLength: number) =>
  z.preprocess(trimToNull, z.string().trim().max(maxLength).nullable().optional());

const templateVariablesSchema = z
  .array(z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Invalid variable name"))
  .max(50)
  .default([]);

export const notificationIdParamSchema = z.object({
  id: z.uuid()
});

export const listNotificationsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    type: z.enum(NOTIFICATION_TYPES).optional(),
    priority: z.enum(NOTIFICATION_PRIORITIES).optional(),
    channel: z.enum(NOTIFICATION_CHANNELS).optional(),
    unread: z.preprocess(parseBooleanQuery, z.boolean().optional()),
    dateFrom: optionalDate,
    dateTo: optionalDate
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

export const updatePreferencesSchema = z
  .object({
    userId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    whatsappEnabled: z.boolean().optional(),
    smsEnabled: z.boolean().optional(),
    paymentReminders: z.boolean().optional(),
    supplierReminders: z.boolean().optional(),
    lowStockAlerts: z.boolean().optional(),
    expiryAlerts: z.boolean().optional(),
    invoiceReminders: z.boolean().optional(),
    payrollAlerts: z.boolean().optional(),
    gstAlerts: z.boolean().optional(),
    frequency: z.enum(NOTIFICATION_FREQUENCIES).optional()
  })
  .strict();

export const listTemplatesQuerySchema = z.object({
  type: z.enum(NOTIFICATION_TYPES).optional(),
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  isActive: z.preprocess(parseBooleanQuery, z.boolean().optional())
});

export const createTemplateSchema = z
  .object({
    templateKey: z.string().trim().min(3).max(100).regex(/^[a-z0-9_.-]+$/i, "Invalid template key"),
    type: z.enum(NOTIFICATION_TYPES),
    channel: z.enum(NOTIFICATION_CHANNELS),
    subject: optionalNullableString(200),
    body: z.string().trim().min(1).max(10000),
    variables: templateVariablesSchema,
    isActive: z.boolean().optional().default(true)
  })
  .strict();

export const updateTemplateSchema = z
  .object({
    subject: optionalNullableString(200),
    body: z.string().trim().min(1).max(10000).optional(),
    variables: templateVariablesSchema.optional(),
    isActive: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

export const sendNotificationSchema = z
  .object({
    userId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    recipient: optionalNullableString(200),
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(5000),
    type: z.enum(NOTIFICATION_TYPES),
    priority: z.enum(NOTIFICATION_PRIORITIES).optional().default("info"),
    channel: z.enum(NOTIFICATION_CHANNELS),
    actionUrl: optionalNullableString(500),
    entityType: optionalNullableString(100),
    entityId: z.preprocess(trimToNull, z.uuid().nullable().optional())
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.channel === "in_app" && !value.userId) {
      ctx.addIssue({
        code: "custom",
        path: ["userId"],
        message: "A target user is required for in-app notifications"
      });
    }

    if (value.channel === "email" && value.recipient && !z.email().safeParse(value.recipient).success) {
      ctx.addIssue({
        code: "custom",
        path: ["recipient"],
        message: "Recipient email is invalid"
      });
    }

    if (value.channel !== "in_app" && !value.userId && !value.recipient) {
      ctx.addIssue({
        code: "custom",
        path: ["recipient"],
        message: "Recipient is required for the selected channel"
      });
    }
  });

export const listLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    channel: z.enum(NOTIFICATION_CHANNELS).optional(),
    status: z.enum(NOTIFICATION_LOG_STATUSES).optional(),
    dateFrom: optionalDate,
    dateTo: optionalDate
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

export const emptyBodySchema = z.object({}).strict();

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;
export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
