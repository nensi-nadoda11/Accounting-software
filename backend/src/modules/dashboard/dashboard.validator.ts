import { z } from "zod";

import { DASHBOARD_CHART_KEYS, DASHBOARD_RANGE_TYPES } from "./dashboard.types";

const optionalDate = z.preprocess(
  (value) => (value === undefined || value === null || value === "" ? undefined : value),
  z.coerce.date().optional()
);

export const dashboardDateRangeQuerySchema = z
  .object({
    range: z.enum(DASHBOARD_RANGE_TYPES).optional().default("monthly"),
    dateFrom: optionalDate,
    dateTo: optionalDate
  })
  .superRefine((value, ctx) => {
    if (value.range === "custom" && (!value.dateFrom || !value.dateTo)) {
      ctx.addIssue({
        code: "custom",
        message: "dateFrom and dateTo are required when range is custom",
        path: ["dateFrom"]
      });
    }

    if ((value.dateFrom && !value.dateTo) || (!value.dateFrom && value.dateTo)) {
      ctx.addIssue({
        code: "custom",
        message: "dateFrom and dateTo must be provided together",
        path: ["dateTo"]
      });
    }

    if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        message: "dateTo must be greater than or equal to dateFrom",
        path: ["dateTo"]
      });
    }
  });

export const dashboardChartParamsSchema = z.object({
  chart: z.enum(DASHBOARD_CHART_KEYS)
});

export const dashboardRecentActivitiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(20).optional().default(8)
});

export const dashboardTopProductsQuerySchema = dashboardDateRangeQuerySchema.extend({
  limit: z.coerce.number().int().positive().max(10).optional().default(5)
});

export type DashboardDateRangeQuery = z.infer<typeof dashboardDateRangeQuerySchema>;
export type DashboardRecentActivitiesQuery = z.infer<typeof dashboardRecentActivitiesQuerySchema>;
export type DashboardTopProductsQuery = z.infer<typeof dashboardTopProductsQuerySchema>;
