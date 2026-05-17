import { z } from "zod";

import {
  GST_RATE_OPTIONS,
  PRODUCT_CATEGORY_MUTABLE_STATUSES,
  PRODUCT_CATEGORY_STATUSES,
  PRODUCT_EXPORT_FORMATS,
  PRODUCT_MUTABLE_STATUSES,
  PRODUCT_PRICE_TAX_TYPES,
  PRODUCT_SORT_FIELDS,
  PRODUCT_TAX_TYPES,
  PRODUCT_TYPES,
  PRODUCT_UNIT_MUTABLE_STATUSES,
  PRODUCT_UNIT_STATUSES
} from "./products.types";

const meaningfulTextRegex = /[\p{L}\p{N}]/u;
const skuRegex = /^[A-Z0-9._/-]+$/;
const barcodeRegex = /^[A-Z0-9-]{4,32}$/;
const hsnSacRegex = /^\d{4,8}$/;

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

const optionalNullableString = (maxLength: number) =>
  z.preprocess(trimToNull, z.string().max(maxLength).nullable().optional());

const optionalNullableUuid = z.preprocess(trimToNull, z.uuid().nullable().optional());

const optionalSku = z.preprocess(
  trimToNull,
  z
    .string()
    .transform((value) => value.toUpperCase())
    .refine((value) => skuRegex.test(value), "SKU must be uppercase and cannot contain spaces")
    .nullable()
    .optional()
);

const optionalBarcode = z.preprocess(
  trimToNull,
  z
    .string()
    .transform((value) => value.toUpperCase())
    .refine((value) => barcodeRegex.test(value), "Barcode must be 4-32 alphanumeric characters")
    .nullable()
    .optional()
);

const optionalHsnSacCode = z.preprocess(
  trimToNull,
  z
    .string()
    .refine((value) => hsnSacRegex.test(value), "HSN/SAC code must be 4 to 8 digits")
    .nullable()
    .optional()
);

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

const productBodyFields = {
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(150, "Name must be at most 150 characters")
    .refine((value) => meaningfulTextRegex.test(value), "Name must contain letters or numbers"),
  productType: z.enum(PRODUCT_TYPES),
  sku: optionalSku,
  barcode: optionalBarcode,
  categoryId: z.uuid(),
  unitId: z.uuid(),
  brand: optionalNullableString(120),
  description: optionalNullableString(1000),
  hsnSacCode: optionalHsnSacCode,
  taxType: z.enum(PRODUCT_TAX_TYPES).optional().default("taxable"),
  gstRate: decimalNumber({ min: 0 }).optional().default(0),
  cessRate: decimalNumber({ min: 0 }).optional().default(0),
  priceTaxType: z.enum(PRODUCT_PRICE_TAX_TYPES).optional().default("exclusive"),
  purchasePrice: decimalNumber({ min: 0 }).optional().default(0),
  salePrice: decimalNumber({ min: 0 }).optional().default(0),
  mrp: decimalNumber({ min: 0 }).optional().default(0),
  wholesalePrice: decimalNumber({ min: 0 }).optional().default(0),
  minimumSalePrice: decimalNumber({ min: 0 }).optional().default(0),
  defaultDiscount: decimalNumber({ min: 0, max: 100 }).optional().default(0),
  stockTrackingEnabled: z.boolean().optional().default(false),
  openingStockQuantity: decimalNumber({ min: 0 }).optional().default(0),
  openingStockRate: decimalNumber({ min: 0 }).optional().default(0),
  minimumStockLevel: decimalNumber({ min: 0 }).optional().default(0),
  reorderLevel: decimalNumber({ min: 0 }).optional().default(0),
  maximumStockLevel: decimalNumber({ min: 0 }).optional().default(0),
  batchTrackingEnabled: z.boolean().optional().default(false),
  expiryTrackingEnabled: z.boolean().optional().default(false),
  serialTrackingEnabled: z.boolean().optional().default(false),
  negativeStockAllowed: z.boolean().optional().default(false),
  status: z.enum(PRODUCT_MUTABLE_STATUSES).optional().default("active")
} satisfies Record<string, z.ZodTypeAny>;

const validateProductBody = (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
  const gstRate = value.gstRate as number | undefined;
  const salePrice = value.salePrice as number | undefined;
  const minimumSalePrice = value.minimumSalePrice as number | undefined;
  const mrp = value.mrp as number | undefined;
  const reorderLevel = value.reorderLevel as number | undefined;
  const minimumStockLevel = value.minimumStockLevel as number | undefined;
  const maximumStockLevel = value.maximumStockLevel as number | undefined;
  const expiryTrackingEnabled = value.expiryTrackingEnabled as boolean | undefined;

  if (gstRate !== undefined && !GST_RATE_OPTIONS.includes(gstRate as (typeof GST_RATE_OPTIONS)[number])) {
    ctx.addIssue({
      code: "custom",
      path: ["gstRate"],
      message: `GST rate must be one of ${GST_RATE_OPTIONS.join(", ")}`
    });
  }

  if (
    salePrice !== undefined &&
    minimumSalePrice !== undefined &&
    salePrice < minimumSalePrice
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["salePrice"],
      message: "Sale price must be greater than or equal to minimum sale price"
    });
  }

  if (mrp !== undefined && salePrice !== undefined && mrp < salePrice) {
    ctx.addIssue({
      code: "custom",
      path: ["mrp"],
      message: "MRP must be greater than or equal to sale price"
    });
  }

  if (
    reorderLevel !== undefined &&
    minimumStockLevel !== undefined &&
    reorderLevel < minimumStockLevel
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["reorderLevel"],
      message: "Reorder level must be greater than or equal to minimum stock level"
    });
  }

  if (
    maximumStockLevel !== undefined &&
    reorderLevel !== undefined &&
    maximumStockLevel > 0 &&
    maximumStockLevel < reorderLevel
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["maximumStockLevel"],
      message: "Maximum stock level must be greater than or equal to reorder level"
    });
  }

  if (expiryTrackingEnabled && value.batchTrackingEnabled === false) {
    ctx.addIssue({
      code: "custom",
      path: ["batchTrackingEnabled"],
      message: "Batch tracking must be enabled when expiry tracking is enabled"
    });
  }
};

export const createProductSchema = z
  .object(productBodyFields)
  .strict()
  .superRefine(validateProductBody);

export const updateProductSchema = z
  .object({
    name: productBodyFields.name.optional(),
    productType: productBodyFields.productType.optional(),
    sku: productBodyFields.sku,
    barcode: productBodyFields.barcode,
    categoryId: z.uuid().optional(),
    unitId: z.uuid().optional(),
    brand: productBodyFields.brand,
    description: productBodyFields.description,
    hsnSacCode: productBodyFields.hsnSacCode,
    taxType: z.enum(PRODUCT_TAX_TYPES).optional(),
    gstRate: decimalNumber({ min: 0 }).optional(),
    cessRate: decimalNumber({ min: 0 }).optional(),
    priceTaxType: z.enum(PRODUCT_PRICE_TAX_TYPES).optional(),
    purchasePrice: decimalNumber({ min: 0 }).optional(),
    salePrice: decimalNumber({ min: 0 }).optional(),
    mrp: decimalNumber({ min: 0 }).optional(),
    wholesalePrice: decimalNumber({ min: 0 }).optional(),
    minimumSalePrice: decimalNumber({ min: 0 }).optional(),
    defaultDiscount: decimalNumber({ min: 0, max: 100 }).optional(),
    stockTrackingEnabled: z.boolean().optional(),
    openingStockQuantity: decimalNumber({ min: 0 }).optional(),
    openingStockRate: decimalNumber({ min: 0 }).optional(),
    minimumStockLevel: decimalNumber({ min: 0 }).optional(),
    reorderLevel: decimalNumber({ min: 0 }).optional(),
    maximumStockLevel: decimalNumber({ min: 0 }).optional(),
    batchTrackingEnabled: z.boolean().optional(),
    expiryTrackingEnabled: z.boolean().optional(),
    serialTrackingEnabled: z.boolean().optional(),
    negativeStockAllowed: z.boolean().optional(),
    status: z.enum(PRODUCT_MUTABLE_STATUSES).optional()
  })
  .strict()
  .superRefine(validateProductBody);

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().max(150).nullable().optional()),
  productType: z.enum(PRODUCT_TYPES).optional(),
  categoryId: z.uuid().optional(),
  unitId: z.uuid().optional(),
  gstRate: optionalDecimalNumber({ min: 0 }).refine((value) => {
    if (value === undefined) {
      return true;
    }

    return GST_RATE_OPTIONS.includes(value as (typeof GST_RATE_OPTIONS)[number]);
  }, "GST rate must be a supported value"),
  status: z.enum(["active", "inactive", "deleted"]).optional(),
  stockTrackingEnabled: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  lowStock: z.preprocess(parseBooleanQuery, z.boolean().optional()),
  taxType: z.enum(PRODUCT_TAX_TYPES).optional(),
  sortBy: z.enum(PRODUCT_SORT_FIELDS).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc")
});

export const productLookupQuerySchema = z.object({
  search: z.preprocess(trimToNull, z.string().max(150).nullable().optional()),
  limit: z.coerce.number().int().positive().max(50).optional().default(20)
});

export const exportProductsQuerySchema = listProductsQuerySchema.extend({
  format: z.enum(PRODUCT_EXPORT_FORMATS).optional().default("csv")
});

export const productIdParamSchema = z.object({
  id: z.uuid()
});

export const priceHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

export const barcodeRequestSchema = z
  .object({
    replaceExisting: z.boolean().optional().default(false)
  })
  .strict();

const categoryBodyFields = {
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .refine((value) => meaningfulTextRegex.test(value), "Name must contain letters or numbers"),
  parentId: optionalNullableUuid,
  description: optionalNullableString(500),
  status: z.enum(PRODUCT_CATEGORY_MUTABLE_STATUSES).optional().default("active")
} satisfies Record<string, z.ZodTypeAny>;

export const createCategorySchema = z.object(categoryBodyFields).strict();

export const updateCategorySchema = z
  .object({
    name: categoryBodyFields.name.optional(),
    parentId: categoryBodyFields.parentId,
    description: categoryBodyFields.description,
    status: z.enum(PRODUCT_CATEGORY_MUTABLE_STATUSES).optional()
  })
  .strict();

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().max(100).nullable().optional()),
  status: z.enum(PRODUCT_CATEGORY_STATUSES).optional(),
  parentId: z.uuid().optional()
});

const unitBodyFields = {
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters")
    .refine((value) => meaningfulTextRegex.test(value), "Name must contain letters or numbers"),
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Symbol is required")
    .max(20, "Symbol must be at most 20 characters")
    .refine((value) => !/\s/.test(value), "Symbol cannot contain spaces"),
  decimalAllowed: z.boolean().optional().default(false),
  baseUnitId: optionalNullableUuid,
  conversionRate: z.preprocess(
    (value) => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null || value === "") {
        return null;
      }

      return value;
    },
    z.union([z.coerce.number().positive("Conversion rate must be greater than 0"), z.null()]).optional()
  ),
  status: z.enum(PRODUCT_UNIT_MUTABLE_STATUSES).optional().default("active")
} satisfies Record<string, z.ZodTypeAny>;

const validateUnitBody = (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
  const baseUnitId = value.baseUnitId as string | null | undefined;
  const conversionRate = value.conversionRate as number | null | undefined;

  if (baseUnitId && !conversionRate) {
    ctx.addIssue({
      code: "custom",
      path: ["conversionRate"],
      message: "Conversion rate is required when base unit is selected"
    });
  }

  if (!baseUnitId && conversionRate !== null && conversionRate !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["baseUnitId"],
      message: "Base unit is required when conversion rate is provided"
    });
  }
};

export const createUnitSchema = z.object(unitBodyFields).strict().superRefine(validateUnitBody);

export const updateUnitSchema = z
  .object({
    name: unitBodyFields.name.optional(),
    symbol: unitBodyFields.symbol.optional(),
    decimalAllowed: z.boolean().optional(),
    baseUnitId: unitBodyFields.baseUnitId,
    conversionRate: unitBodyFields.conversionRate,
    status: z.enum(PRODUCT_UNIT_MUTABLE_STATUSES).optional()
  })
  .strict()
  .superRefine(validateUnitBody);

export const listUnitsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().max(100).nullable().optional()),
  status: z.enum(PRODUCT_UNIT_STATUSES).optional(),
  decimalAllowed: z.preprocess(parseBooleanQuery, z.boolean().optional())
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type ProductLookupQuery = z.infer<typeof productLookupQuerySchema>;
export type ExportProductsQuery = z.infer<typeof exportProductsQuerySchema>;
export type ProductPriceHistoryQuery = z.infer<typeof priceHistoryQuerySchema>;
export type BarcodeRequestInput = z.infer<typeof barcodeRequestSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type ListUnitsQuery = z.infer<typeof listUnitsQuerySchema>;
