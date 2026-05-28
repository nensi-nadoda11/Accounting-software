import { z } from "zod";

import { GST_RATE_OPTIONS } from "./productOptions";
import type { ProductCategoryFormInput, ProductFormInput, ProductUnitFormInput } from "../../types/product";

const SKU_REGEX = /^[A-Z0-9._/-]+$/;
const BARCODE_REGEX = /^[A-Z0-9-]{4,32}$/;
const HSN_REGEX = /^\d{4,8}$/;

const trim = (value: unknown) => (typeof value === "string" ? value.trim() : value);

const trimToNull = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const next = value.trim();
  return next ? next : null;
};

const decimalField = (min: number, max?: number) =>
  z.coerce
    .number({ message: "Enter a valid number" })
    .refine((value) => Number.isFinite(value), "Enter a valid number")
    .min(min, `Must be at least ${min}`)
    .refine((value) => (max === undefined ? true : value <= max), max === undefined ? undefined : `Must be ${max} or less`);

const nullableText = (max: number) =>
  z.preprocess(trimToNull, z.string().max(max, `Must be ${max} characters or fewer`).nullable());

export const productFormSchema = z
  .object({
    productType: z.enum(["goods", "service"], { message: "Select product type" }),
    name: z.preprocess(trim, z.string().min(2, "Name must be at least 2 characters").max(150, "Name must be at most 150 characters")),
    sku: z.preprocess(
      trimToNull,
      z
        .string()
        .transform((value) => value.toUpperCase())
        .refine((value) => SKU_REGEX.test(value), "SKU must be uppercase and cannot contain spaces")
        .nullable(),
    ),
    barcode: z.preprocess(
      trimToNull,
      z
        .string()
        .transform((value) => value.toUpperCase())
        .refine((value) => BARCODE_REGEX.test(value), "Barcode must be 4-32 alphanumeric characters")
        .nullable(),
    ),
    categoryId: z.uuid("Select category"),
    unitId: z.preprocess(trimToNull, z.uuid("Select unit").nullable()),
    brand: nullableText(120),
    description: nullableText(1000),
    hsnSacCode: z.preprocess(
      trimToNull,
      z
        .string()
        .refine((value) => HSN_REGEX.test(value), "HSN/SAC code must be 4 to 8 digits")
        .nullable(),
    ),
    taxType: z.enum(["taxable", "exempt", "nil_rated", "non_gst"]),
    gstRate: decimalField(0),
    cessRate: decimalField(0),
    priceTaxType: z.enum(["inclusive", "exclusive"]),
    purchasePrice: decimalField(0),
    salePrice: decimalField(0),
    mrp: decimalField(0),
    wholesalePrice: decimalField(0),
    minimumSalePrice: decimalField(0),
    defaultDiscount: decimalField(0, 100),
    stockTrackingEnabled: z.boolean(),
    openingStockQuantity: decimalField(0),
    openingStockRate: decimalField(0),
    minimumStockLevel: decimalField(0),
    reorderLevel: decimalField(0),
    maximumStockLevel: decimalField(0),
    batchTrackingEnabled: z.boolean(),
    expiryTrackingEnabled: z.boolean(),
    serialTrackingEnabled: z.boolean(),
    negativeStockAllowed: z.boolean(),
    status: z.enum(["active", "inactive"]),
  })
  .superRefine((value, ctx) => {
    if (!GST_RATE_OPTIONS.includes(value.gstRate as (typeof GST_RATE_OPTIONS)[number])) {
      ctx.addIssue({
        code: "custom",
        path: ["gstRate"],
        message: `GST rate must be one of ${GST_RATE_OPTIONS.join(", ")}`,
      });
    }

    if (value.taxType === "taxable" && !value.hsnSacCode) {
      ctx.addIssue({
        code: "custom",
        path: ["hsnSacCode"],
        message: "HSN/SAC code is required for taxable products",
      });
    }

    if (value.salePrice < value.minimumSalePrice) {
      ctx.addIssue({
        code: "custom",
        path: ["salePrice"],
        message: "Sale price must be greater than or equal to minimum sale price",
      });
    }

    if (value.mrp < value.salePrice) {
      ctx.addIssue({
        code: "custom",
        path: ["mrp"],
        message: "MRP must be greater than or equal to sale price",
      });
    }

    if (value.reorderLevel < value.minimumStockLevel) {
      ctx.addIssue({
        code: "custom",
        path: ["reorderLevel"],
        message: "Reorder level must be greater than or equal to minimum stock level",
      });
    }

    if (value.maximumStockLevel > 0 && value.maximumStockLevel < value.reorderLevel) {
      ctx.addIssue({
        code: "custom",
        path: ["maximumStockLevel"],
        message: "Maximum stock level must be greater than or equal to reorder level",
      });
    }

    if (value.expiryTrackingEnabled && !value.batchTrackingEnabled) {
      ctx.addIssue({
        code: "custom",
        path: ["batchTrackingEnabled"],
        message: "Batch tracking is required when expiry tracking is enabled",
      });
    }

    if (value.productType === "service") {
      if (value.stockTrackingEnabled) {
        ctx.addIssue({
          code: "custom",
          path: ["stockTrackingEnabled"],
          message: "Service products cannot track stock",
        });
      }

      for (const field of [
        "openingStockQuantity",
        "openingStockRate",
        "minimumStockLevel",
        "reorderLevel",
        "maximumStockLevel",
      ] as const) {
        if (value[field] > 0) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Service products cannot have stock values",
          });
        }
      }

      return;
    }

    if (!value.unitId) {
      ctx.addIssue({
        code: "custom",
        path: ["unitId"],
        message: "Select unit",
      });
    }
  })
  .transform(
    (value): ProductFormInput => ({
      ...value,
      gstRate: value.taxType === "taxable" ? value.gstRate : 0,
      cessRate: value.taxType === "taxable" ? value.cessRate : 0,
      stockTrackingEnabled: value.productType === "goods" ? value.stockTrackingEnabled : false,
      openingStockQuantity: value.productType === "goods" ? value.openingStockQuantity : 0,
      openingStockRate: value.productType === "goods" ? value.openingStockRate : 0,
      minimumStockLevel: value.productType === "goods" ? value.minimumStockLevel : 0,
      reorderLevel: value.productType === "goods" ? value.reorderLevel : 0,
      maximumStockLevel: value.productType === "goods" ? value.maximumStockLevel : 0,
      batchTrackingEnabled: value.productType === "goods" ? value.batchTrackingEnabled : false,
      expiryTrackingEnabled: value.productType === "goods" ? value.expiryTrackingEnabled : false,
      serialTrackingEnabled: value.productType === "goods" ? value.serialTrackingEnabled : false,
      negativeStockAllowed: value.productType === "goods" ? value.negativeStockAllowed : false,
    }),
  );

export type ProductFormValues = z.input<typeof productFormSchema>;

export const categoryFormSchema = z
  .object({
    name: z.preprocess(trim, z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters")),
    parentId: z.preprocess(trimToNull, z.uuid().nullable()),
    description: nullableText(500),
    status: z.enum(["active", "inactive"]),
  })
  .transform((value): ProductCategoryFormInput => value);

export type CategoryFormValues = z.input<typeof categoryFormSchema>;

export const unitFormSchema = z
  .object({
    name: z.preprocess(trim, z.string().min(2, "Name must be at least 2 characters").max(80, "Name must be at most 80 characters")),
    symbol: z.preprocess(
      trim,
      z
        .string()
        .min(1, "Symbol is required")
        .max(20, "Symbol must be at most 20 characters")
        .transform((value) => value.toUpperCase())
        .refine((value) => !/\s/.test(value), "Symbol cannot contain spaces"),
    ),
    decimalAllowed: z.boolean(),
    baseUnitId: z.preprocess(trimToNull, z.uuid().nullable()),
    conversionRate: z.preprocess(
      (value) => {
        if (value === undefined || value === "") {
          return null;
        }

        return value;
      },
      z.coerce.number().positive("Conversion must be greater than 0").nullable(),
    ),
    status: z.enum(["active", "inactive"]),
  })
  .superRefine((value, ctx) => {
    if (value.baseUnitId && !value.conversionRate) {
      ctx.addIssue({
        code: "custom",
        path: ["conversionRate"],
        message: "Conversion rate is required when base unit is selected",
      });
    }

    if (!value.baseUnitId && value.conversionRate !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["baseUnitId"],
        message: "Base unit is required when conversion rate is provided",
      });
    }
  })
  .transform((value): ProductUnitFormInput => value);

export type UnitFormValues = z.input<typeof unitFormSchema>;
