import { z } from "zod";

const trimToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

const optionalNullableString = (max = 500) =>
  z.preprocess(trimToNull, z.string().trim().max(max).nullable().optional());

export const stockCheckIdParamSchema = z.object({
  id: z.uuid()
});

const stockCheckItemInputSchema = z
  .object({
    productId: z.uuid(),
    batchId: z.uuid().nullable().optional(),
    physicalQty: z.coerce.number().min(0, "Physical quantity cannot be negative"),
    reason: optionalNullableString(500)
  })
  .strict();

export const createStockCheckSchema = z
  .object({
    warehouseId: z.uuid(),
    checkDate: z.coerce.date().optional(),
    remarks: optionalNullableString(1000),
    items: z.array(stockCheckItemInputSchema).min(1, "At least one item is required")
  })
  .strict();

export const updateStockCheckSchema = z
  .object({
    warehouseId: z.uuid().optional(),
    checkDate: z.coerce.date().optional(),
    remarks: optionalNullableString(1000),
    items: z.array(stockCheckItemInputSchema).min(1, "At least one item is required").optional()
  })
  .strict();

export const listStockChecksQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  status: z.enum(["draft", "completed", "approved", "cancelled"]).optional(),
  warehouseId: z.uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional()
});

export const exportStockCheckQuerySchema = z.object({
  format: z.enum(["pdf", "xlsx"]).optional().default("pdf")
});

export type CreateStockCheckInput = z.infer<typeof createStockCheckSchema>;
export type UpdateStockCheckInput = z.infer<typeof updateStockCheckSchema>;
export type ListStockChecksQuery = z.infer<typeof listStockChecksQuerySchema>;
export type ExportStockCheckQuery = z.infer<typeof exportStockCheckQuerySchema>;
