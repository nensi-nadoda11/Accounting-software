import { z } from "zod";

import { BATCH_STATUS_OPTIONS, STOCK_ADJUSTMENT_TYPE_LABELS, WAREHOUSE_STATUS_OPTIONS } from "./inventoryUtils";

const indianMobileRegex = /^[6-9]\d{9}$/;
const pincodeRegex = /^\d{6}$/;

const nullableText = (maxLength: number) =>
  z
    .string()
    .max(maxLength)
    .transform((value) => value.trim())
    .transform((value) => value || null);

const optionalDateString = z.string().transform((value) => value.trim()).transform((value) => value || "");

export const warehouseFormSchema = z.object({
  warehouseCode: z.string().max(30).transform((value) => value.trim().toUpperCase()),
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters"),
  addressLine1: nullableText(150),
  addressLine2: nullableText(150),
  city: nullableText(80),
  state: nullableText(80),
  pincode: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === "" || pincodeRegex.test(value), "Pincode must be 6 digits")
    .transform((value) => value || null),
  contactPerson: nullableText(80),
  mobile: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === "" || indianMobileRegex.test(value), "Mobile must be a valid 10 digit Indian number")
    .transform((value) => value || null),
  isDefault: z.boolean(),
  status: z.enum(WAREHOUSE_STATUS_OPTIONS.filter((item) => item.value).map((item) => item.value) as ["active", "inactive"]),
});

export const batchFormSchema = z
  .object({
    productId: z.string().uuid("Product is required"),
    warehouseId: z.string().uuid("Warehouse is required"),
    batchNumber: z.string().trim().min(1, "Batch number is required").max(80, "Batch number is too long"),
    manufacturingDate: optionalDateString,
    expiryDate: optionalDateString,
    purchaseRate: z.coerce.number().min(0, "Purchase rate cannot be negative"),
    status: z.enum(BATCH_STATUS_OPTIONS.filter((item) => item.value).map((item) => item.value) as ["active", "expired", "blocked"]),
  })
  .superRefine((value, ctx) => {
    if (value.manufacturingDate && value.expiryDate && value.expiryDate <= value.manufacturingDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date must be after manufacturing date",
      });
    }
  });

export const openingStockFormSchema = z
  .object({
    productId: z.string().uuid("Product is required"),
    warehouseId: z.string().uuid("Warehouse is required"),
    batchId: z.string().optional(),
    batchNumber: z.string().max(80).transform((value) => value.trim()),
    manufacturingDate: optionalDateString,
    expiryDate: optionalDateString,
    quantity: z.coerce.number().gt(0, "Quantity must be greater than 0"),
    rate: z.coerce.number().min(0, "Rate cannot be negative"),
    movementDate: optionalDateString,
    remarks: z.string().max(500).transform((value) => value.trim()).transform((value) => value || null),
  })
  .superRefine((value, ctx) => {
    if (value.manufacturingDate && value.expiryDate && value.expiryDate <= value.manufacturingDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date must be after manufacturing date",
      });
    }

    if (value.movementDate && value.movementDate > new Date().toISOString().slice(0, 10)) {
      ctx.addIssue({
        code: "custom",
        path: ["movementDate"],
        message: "Date cannot be in the future",
      });
    }
  });

export const adjustmentFormSchema = z
  .object({
    productId: z.string().uuid("Product is required"),
    warehouseId: z.string().uuid("Warehouse is required"),
    batchId: z.string().optional(),
    batchNumber: z.string().max(80).transform((value) => value.trim()),
    manufacturingDate: optionalDateString,
    expiryDate: optionalDateString,
    adjustmentType: z.enum(
      Object.keys(STOCK_ADJUSTMENT_TYPE_LABELS) as [
        "increase",
        "decrease",
        "damaged",
        "lost",
        "expired_writeoff",
        "found",
        "opening_correction",
        "manual_correction",
      ],
    ),
    quantity: z.coerce.number().gt(0, "Quantity must be greater than 0"),
    rate: z.coerce.number().min(0, "Rate cannot be negative"),
    reason: z.string().trim().min(1, "Reason is required").max(500, "Reason is too long"),
    adjustmentDate: optionalDateString,
    remarks: z.string().max(500).transform((value) => value.trim()).transform((value) => value || null),
  })
  .superRefine((value, ctx) => {
    if (value.manufacturingDate && value.expiryDate && value.expiryDate <= value.manufacturingDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date must be after manufacturing date",
      });
    }

    if (value.adjustmentDate && value.adjustmentDate > new Date().toISOString().slice(0, 10)) {
      ctx.addIssue({
        code: "custom",
        path: ["adjustmentDate"],
        message: "Date cannot be in the future",
      });
    }
  });

export type WarehouseFormInputValues = z.input<typeof warehouseFormSchema>;
export type WarehouseFormValues = z.output<typeof warehouseFormSchema>;
export type BatchFormInputValues = z.input<typeof batchFormSchema>;
export type BatchFormValues = z.output<typeof batchFormSchema>;
export type OpeningStockFormInputValues = z.input<typeof openingStockFormSchema>;
export type OpeningStockFormValues = z.output<typeof openingStockFormSchema>;
export type AdjustmentFormInputValues = z.input<typeof adjustmentFormSchema>;
export type AdjustmentFormValues = z.output<typeof adjustmentFormSchema>;
