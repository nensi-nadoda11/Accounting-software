import { z } from "zod";

import { indianMobileRegex } from "../../validators/common.validator";
import {
  BATCH_MUTABLE_STATUSES,
  BATCH_STATUSES,
  INVENTORY_ALERT_SEVERITIES,
  INVENTORY_ALERT_TYPES,
  INVENTORY_EXPORT_FORMATS,
  INVENTORY_VALUATION_METHODS,
  STOCK_ADJUSTMENT_TYPES,
  STOCK_MOVEMENT_TYPES,
  WAREHOUSE_MUTABLE_STATUSES,
  WAREHOUSE_STATUSES
} from "./inventory.types";

const meaningfulTextRegex = /[\p{L}\p{N}]/u;
const pincodeRegex = /^\d{6}$/;

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

const optionalNullableString = (maxLength: number) =>
  z.preprocess(trimToNull, z.string().trim().max(maxLength).nullable().optional());

const optionalNullableUuid = z.preprocess(trimToNull, z.uuid().nullable().optional());

const optionalDate = z.preprocess(parseDateInput, z.coerce.date().nullable().optional());

const decimalNumber = (options?: { min?: number; max?: number }) =>
  z.coerce
    .number()
    .refine((value) => Number.isFinite(value), "Invalid number")
    .refine((value) => (options?.min === undefined ? true : value >= options.min), {
      message: options?.min === undefined ? "Invalid number" : `Value must be at least ${options.min}`
    })
    .refine((value) => (options?.max === undefined ? true : value <= options.max), {
      message: options?.max === undefined ? "Invalid number" : `Value must be at most ${options.max}`
    });

const optionalDecimalNumber = (options?: { min?: number; max?: number }) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }

      return value;
    },
    decimalNumber(options).optional()
  );

const warehouseBodyFields = {
  warehouseCode: z.preprocess(
    trimToNull,
    z.string().trim().toUpperCase().min(2).max(30).nullable().optional()
  ),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .refine((value) => meaningfulTextRegex.test(value), "Name must contain letters or numbers"),
  addressLine1: optionalNullableString(150),
  addressLine2: optionalNullableString(150),
  city: optionalNullableString(80),
  state: optionalNullableString(80),
  pincode: z.preprocess(
    trimToNull,
    z
      .string()
      .refine((value) => pincodeRegex.test(value), "Pincode must be 6 digits")
      .nullable()
      .optional()
  ),
  contactPerson: optionalNullableString(80),
  mobile: z.preprocess(
    trimToNull,
    z
      .string()
      .refine((value) => indianMobileRegex.test(value), "Mobile number must be a valid Indian 10 digit number")
      .nullable()
      .optional()
  ),
  isDefault: z.boolean().optional().default(false),
  status: z.enum(WAREHOUSE_MUTABLE_STATUSES).optional().default("active")
} satisfies Record<string, z.ZodTypeAny>;

export const createWarehouseSchema = z.object(warehouseBodyFields).strict();

export const updateWarehouseSchema = z
  .object({
    warehouseCode: warehouseBodyFields.warehouseCode,
    name: warehouseBodyFields.name.optional(),
    addressLine1: warehouseBodyFields.addressLine1,
    addressLine2: warehouseBodyFields.addressLine2,
    city: warehouseBodyFields.city,
    state: warehouseBodyFields.state,
    pincode: warehouseBodyFields.pincode,
    contactPerson: warehouseBodyFields.contactPerson,
    mobile: warehouseBodyFields.mobile,
    isDefault: z.boolean().optional(),
    status: z.enum(WAREHOUSE_MUTABLE_STATUSES).optional()
  })
  .strict();

export const listWarehousesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().max(100).nullable().optional()),
  status: z.enum(WAREHOUSE_STATUSES).optional()
});

const batchBodyFields = {
  productId: z.uuid(),
  warehouseId: z.uuid(),
  batchNumber: z
    .string()
    .trim()
    .min(1, "Batch number is required")
    .max(80, "Batch number must be at most 80 characters"),
  manufacturingDate: optionalDate,
  expiryDate: optionalDate,
  purchaseRate: decimalNumber({ min: 0 }).optional().default(0),
  saleRate: decimalNumber({ min: 0 }).optional().default(0),
  status: z.enum(BATCH_MUTABLE_STATUSES).optional().default("active")
} satisfies Record<string, z.ZodTypeAny>;

const validateBatchDates = (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
  const manufacturingDate = value.manufacturingDate as Date | null | undefined;
  const expiryDate = value.expiryDate as Date | null | undefined;

  if (manufacturingDate && expiryDate && expiryDate <= manufacturingDate) {
    ctx.addIssue({
      code: "custom",
      path: ["expiryDate"],
      message: "Expiry date must be after manufacturing date"
    });
  }
};

export const createBatchSchema = z.object(batchBodyFields).strict().superRefine(validateBatchDates);

export const updateBatchSchema = z
  .object({
    productId: z.uuid().optional(),
    warehouseId: z.uuid().optional(),
    batchNumber: batchBodyFields.batchNumber.optional(),
    manufacturingDate: batchBodyFields.manufacturingDate,
    expiryDate: batchBodyFields.expiryDate,
    purchaseRate: decimalNumber({ min: 0 }).optional(),
    saleRate: decimalNumber({ min: 0 }).optional(),
    status: z.enum(BATCH_MUTABLE_STATUSES).optional()
  })
  .strict()
  .superRefine(validateBatchDates);

export const listBatchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  productId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  expired: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  expiringSoon: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  status: z.enum(BATCH_STATUSES).optional()
});

export const inventoryIdParamSchema = z.object({
  id: z.uuid()
});

export const productIdParamSchema = z.object({
  productId: z.uuid()
});

export const openingStockSchema = z
  .object({
    productId: z.uuid(),
    warehouseId: z.uuid(),
    batchId: optionalNullableUuid,
    batchNumber: z.preprocess(trimToNull, z.string().trim().max(80).nullable().optional()),
    manufacturingDate: optionalDate,
    expiryDate: optionalDate,
    purchaseRate: optionalDecimalNumber({ min: 0 }),
    saleRate: optionalDecimalNumber({ min: 0 }),
    quantity: decimalNumber({ min: Number.EPSILON }),
    rate: decimalNumber({ min: 0 }),
    movementDate: z.coerce.date().optional(),
    remarks: optionalNullableString(500)
  })
  .strict()
  .superRefine(validateBatchDates);

export const createAdjustmentSchema = z
  .object({
    productId: z.uuid(),
    warehouseId: z.uuid(),
    batchId: optionalNullableUuid,
    batchNumber: z.preprocess(trimToNull, z.string().trim().max(80).nullable().optional()),
    manufacturingDate: optionalDate,
    expiryDate: optionalDate,
    purchaseRate: optionalDecimalNumber({ min: 0 }),
    saleRate: optionalDecimalNumber({ min: 0 }),
    adjustmentType: z.enum(STOCK_ADJUSTMENT_TYPES),
    quantity: decimalNumber({ min: Number.EPSILON }),
    rate: optionalDecimalNumber({ min: 0 }),
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be at least 3 characters")
      .max(500, "Reason must be at most 500 characters"),
    adjustmentDate: z.coerce.date().optional(),
    remarks: optionalNullableString(500)
  })
  .strict()
  .superRefine(validateBatchDates);

export const listAdjustmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  productId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  adjustmentType: z.enum(STOCK_ADJUSTMENT_TYPES).optional(),
  dateFrom: optionalDate,
  dateTo: optionalDate
});

export const listMovementsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  productId: z.uuid().optional(),
  warehouseId: z.uuid().optional(),
  batchId: z.uuid().optional(),
  movementType: z.enum(STOCK_MOVEMENT_TYPES).optional(),
  referenceType: z.preprocess(trimToNull, z.string().trim().max(50).nullable().optional()),
  dateFrom: optionalDate,
  dateTo: optionalDate
});

export const exportMovementsQuerySchema = listMovementsQuerySchema.extend({
  format: z.enum(INVENTORY_EXPORT_FORMATS).optional().default("pdf")
});

export const listStockQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().max(150).nullable().optional()),
  warehouseId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  productId: z.uuid().optional(),
  lowStock: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  outOfStock: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  expired: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  expiringSoon: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  status: z.enum(["active", "inactive", "deleted"]).optional()
});

export const stockSummaryQuerySchema = z.object({
  warehouseId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  productId: z.uuid().optional()
});

export const exportStockQuerySchema = listStockQuerySchema.extend({
  format: z.enum(INVENTORY_EXPORT_FORMATS).optional().default("pdf")
});

export const listAlertsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  type: z.enum(INVENTORY_ALERT_TYPES).optional(),
  severity: z.enum(INVENTORY_ALERT_SEVERITIES).optional(),
  read: z.preprocess(parseBooleanQuery, z.boolean().optional())
});

export const markAlertReadSchema = z
  .object({
    isRead: z.boolean().optional().default(true)
  })
  .strict();

export const recalculateAlertsSchema = z
  .object({
    productId: z.uuid().optional(),
    warehouseId: z.uuid().optional(),
    batchId: z.uuid().optional()
  })
  .strict();

export const valuationQuerySchema = z.object({
  method: z.enum(INVENTORY_VALUATION_METHODS).optional().default("weighted_average"),
  warehouseId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  productId: z.uuid().optional()
});

export const exportValuationQuerySchema = valuationQuerySchema.extend({
  format: z.enum(INVENTORY_EXPORT_FORMATS).optional().default("pdf")
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type ListWarehousesQuery = z.infer<typeof listWarehousesQuerySchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>;
export type ListBatchesQuery = z.infer<typeof listBatchesQuerySchema>;
export type AddOpeningStockInput = z.infer<typeof openingStockSchema>;
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
export type ListAdjustmentsQuery = z.infer<typeof listAdjustmentsQuerySchema>;
export type ListMovementsQuery = z.infer<typeof listMovementsQuerySchema>;
export type ExportMovementsQuery = z.infer<typeof exportMovementsQuerySchema>;
export type ListStockQuery = z.infer<typeof listStockQuerySchema>;
export type StockSummaryQuery = z.infer<typeof stockSummaryQuerySchema>;
export type ExportStockQuery = z.infer<typeof exportStockQuerySchema>;
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
export type MarkAlertReadInput = z.infer<typeof markAlertReadSchema>;
export type RecalculateAlertsInput = z.infer<typeof recalculateAlertsSchema>;
export type ValuationQuery = z.infer<typeof valuationQuerySchema>;
export type ExportValuationQuery = z.infer<typeof exportValuationQuerySchema>;
