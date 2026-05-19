import { z } from "zod";

import { AUDIT_LOG_STATUSES, LOGIN_LOG_TYPES, RESTORE_LOG_STATUSES, RESTORE_MODES } from "./audit.types";

const trimToUndefined = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
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

const optionalDate = z.preprocess(trimToUndefined, z.coerce.date().optional());

export const listAuditLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    module: z.preprocess(trimToUndefined, z.string().max(100).optional()),
    action: z.preprocess(trimToUndefined, z.string().max(150).optional()),
    user: z.preprocess(trimToUndefined, z.string().max(150).optional()),
    status: z.enum(AUDIT_LOG_STATUSES).optional(),
    entityType: z.preprocess(trimToUndefined, z.string().max(100).optional()),
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

export const listLoginLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    email: z.preprocess(trimToUndefined, z.string().max(150).optional()),
    loginType: z.enum(LOGIN_LOG_TYPES).optional(),
    success: z.preprocess(parseBooleanQuery, z.boolean().optional()),
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

export const listRestoreLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    status: z.enum(RESTORE_LOG_STATUSES).optional(),
    restoreMode: z.enum(RESTORE_MODES).optional(),
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

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
export type ListLoginLogsQuery = z.infer<typeof listLoginLogsQuerySchema>;
export type ListRestoreLogsQuery = z.infer<typeof listRestoreLogsQuerySchema>;
