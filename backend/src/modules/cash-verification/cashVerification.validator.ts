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

export const cashVerificationIdParamSchema = z.object({
  id: z.uuid()
});

export const createCashVerificationSchema = z
  .object({
    verificationDate: z.coerce.date(),
    actualCash: z.coerce.number().min(0, "Actual cash cannot be negative"),
    remarks: optionalNullableString(1000)
  })
  .strict();

export const updateCashVerificationSchema = z
  .object({
    verificationDate: z.coerce.date().optional(),
    actualCash: z.coerce.number().min(0, "Actual cash cannot be negative").optional(),
    remarks: optionalNullableString(1000)
  })
  .strict();

export const listCashVerificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  status: z.enum(["matched", "short_cash", "excess_cash"]).optional(),
  recordStatus: z.enum(["draft", "completed", "approved", "cancelled"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional()
});

export const exportCashVerificationQuerySchema = z.object({
  format: z.enum(["pdf", "xlsx"]).optional().default("pdf")
});

export type CreateCashVerificationInput = z.infer<typeof createCashVerificationSchema>;
export type UpdateCashVerificationInput = z.infer<typeof updateCashVerificationSchema>;
export type ListCashVerificationsQuery = z.infer<typeof listCashVerificationsQuerySchema>;
export type ExportCashVerificationQuery = z.infer<typeof exportCashVerificationQuerySchema>;
