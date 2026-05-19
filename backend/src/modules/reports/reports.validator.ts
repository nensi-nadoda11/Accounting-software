import { z } from "zod";

import { REPORT_EXPORT_FORMATS, REPORT_TYPES } from "./reports.types";

const trimToUndefined = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return value;
};

const parseOptionalDate = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return value;
};

const parseOptionalBoolean = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return value;
};

const parseFiltersJson = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }

  return value;
};

const optionalString = z.preprocess(trimToUndefined, z.string().trim().max(200).optional());
const optionalUuid = z.preprocess(trimToUndefined, z.uuid().optional());
const optionalDate = z.preprocess(parseOptionalDate, z.coerce.date().optional());
const optionalBoolean = z.preprocess(parseOptionalBoolean, z.boolean().optional());

const reportQueryBaseSchema = z
  .object({
    dateFrom: optionalDate,
    dateTo: optionalDate,
    financialYearId: optionalUuid,
    customerId: optionalUuid,
    supplierId: optionalUuid,
    productId: optionalUuid,
    categoryId: optionalUuid,
    employeeId: optionalUuid,
    department: optionalString,
    paymentMode: optionalString,
    gstRate: z.coerce.number().min(0).max(28).optional(),
    status: optionalString,
    includeDrafts: optionalBoolean,
    includeCancelled: optionalBoolean
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

export const reportSummaryQuerySchema = reportQueryBaseSchema;

export const reportPaginatedQuerySchema = reportQueryBaseSchema.extend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

export const reportTopQuerySchema = reportQueryBaseSchema.extend({
  limit: z.coerce.number().int().positive().max(20).optional().default(10)
});

export const reportLedgerQuerySchema = reportPaginatedQuerySchema;

export const reportOverviewQuerySchema = reportSummaryQuerySchema;

export const reportExportsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).optional().default(10)
});

export const exportReportQuerySchema = reportQueryBaseSchema.extend({
  reportType: z.enum(REPORT_TYPES),
  format: z.enum(REPORT_EXPORT_FORMATS),
  filters: z.preprocess(parseFiltersJson, z.record(z.string(), z.unknown()).optional())
});

export type ReportSummaryQuery = z.infer<typeof reportSummaryQuerySchema>;
export type ReportPaginatedQuery = z.infer<typeof reportPaginatedQuerySchema>;
export type ReportTopQuery = z.infer<typeof reportTopQuerySchema>;
export type ReportLedgerQuery = z.infer<typeof reportLedgerQuerySchema>;
export type ReportOverviewQuery = z.infer<typeof reportOverviewQuerySchema>;
export type ReportExportsQuery = z.infer<typeof reportExportsQuerySchema>;
export type ExportReportQuery = z.infer<typeof exportReportQuerySchema>;
