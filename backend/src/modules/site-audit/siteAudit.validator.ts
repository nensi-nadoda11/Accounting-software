import { z } from "zod";

const trimToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const optionalNullableString = (max = 1000) =>
  z.preprocess(trimToNull, z.string().trim().max(max).nullable().optional());

const notFutureDate = (value: Date) => value <= new Date();

export const siteAuditIdParamSchema = z.object({
  id: z.uuid()
});

export const siteAuditFindingIdParamSchema = z.object({
  id: z.uuid(),
  findingId: z.uuid()
});

export const siteAuditAttachmentIdParamSchema = z.object({
  id: z.uuid(),
  attachmentId: z.uuid()
});

const checklistItemSchema = z
  .object({
    checklistKey: z.enum([
      "stock_verified",
      "cash_verified",
      "purchase_records_verified",
      "sales_records_verified",
      "expense_records_verified",
      "gst_records_verified",
      "damaged_stock_verified",
      "user_activity_verified"
    ]),
    isChecked: z.coerce.boolean().optional().default(false),
    remarks: optionalNullableString(500)
  })
  .strict();

export const siteAuditFindingSchema = z
  .object({
    findingTitle: z.string().trim().min(1, "Finding title is required").max(200),
    findingDescription: optionalNullableString(2000),
    severity: z.enum(["low", "medium", "high", "critical"], { error: "Severity is required" }),
    status: z.enum(["open", "resolved", "ignored"]).optional().default("open"),
    relatedModule: optionalNullableString(80),
    relatedReferenceId: z.uuid().nullable().optional()
  })
  .strict();

export const updateSiteAuditFindingSchema = siteAuditFindingSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});

export const createSiteAuditSchema = z
  .object({
    auditDate: z.coerce.date().refine(notFutureDate, "Audit date cannot be future"),
    warehouseId: z.uuid().nullable().optional(),
    auditorUserId: z.uuid(),
    linkedStockCheckId: z.uuid().nullable().optional(),
    linkedCashVerificationId: z.uuid().nullable().optional(),
    finalResult: z.enum(["passed", "issues_found", "needs_review"]).optional().default("needs_review"),
    overallRemarks: optionalNullableString(2000),
    checklist: z.array(checklistItemSchema).optional(),
    findings: z.array(siteAuditFindingSchema).optional()
  })
  .strict();

export const updateSiteAuditSchema = z
  .object({
    auditDate: z.coerce.date().refine(notFutureDate, "Audit date cannot be future").optional(),
    warehouseId: z.uuid().nullable().optional(),
    auditorUserId: z.uuid().optional(),
    linkedStockCheckId: z.uuid().nullable().optional(),
    linkedCashVerificationId: z.uuid().nullable().optional(),
    finalResult: z.enum(["passed", "issues_found", "needs_review"]).optional(),
    overallRemarks: optionalNullableString(2000),
    checklist: z.array(checklistItemSchema).optional()
  })
  .strict();

export const completeSiteAuditSchema = z
  .object({
    finalResult: z.enum(["passed", "issues_found", "needs_review"])
  })
  .strict();

export const listSiteAuditsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  status: z.enum(["draft", "completed", "approved", "cancelled"]).optional(),
  finalResult: z.enum(["passed", "issues_found", "needs_review"]).optional(),
  warehouseId: z.uuid().optional(),
  auditorId: z.uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional()
});

export const exportSiteAuditQuerySchema = z.object({
  format: z.enum(["pdf", "csv"]).optional().default("pdf")
});

export type CreateSiteAuditInput = z.infer<typeof createSiteAuditSchema>;
export type UpdateSiteAuditInput = z.infer<typeof updateSiteAuditSchema>;
export type CompleteSiteAuditInput = z.infer<typeof completeSiteAuditSchema>;
export type SiteAuditFindingInput = z.infer<typeof siteAuditFindingSchema>;
export type UpdateSiteAuditFindingInput = z.infer<typeof updateSiteAuditFindingSchema>;
export type ListSiteAuditsQuery = z.infer<typeof listSiteAuditsQuerySchema>;
export type ExportSiteAuditQuery = z.infer<typeof exportSiteAuditQuerySchema>;
