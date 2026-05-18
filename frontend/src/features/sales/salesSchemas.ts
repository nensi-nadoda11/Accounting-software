import { z } from "zod";

import { GST_RATE_OPTIONS } from "../products/productOptions";
import type { SalesFormInput, SalesPaymentInput, SalesReturnInput } from "../../types/sales";

const trim = (value: unknown) => (typeof value === "string" ? value.trim() : value);

const trimToNull = (value: unknown) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const next = value.trim();
    return next ? next : null;
  }

  return value;
};

const dateToNull = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return value;
};

const decimalField = (min: number, max?: number) =>
  z.coerce
    .number({ message: "Enter a valid number" })
    .refine((value) => Number.isFinite(value), "Enter a valid number")
    .min(min, `Must be at least ${min}`)
    .refine((value) => (max === undefined ? true : value <= max), max === undefined ? undefined : `Must be ${max} or less`);

const optionalNullableText = (max: number) =>
  z.preprocess(trimToNull, z.string().max(max, `Must be ${max} characters or fewer`).nullable());

const nullableDateString = z.preprocess(dateToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());

const mobileRegex = /^[6-9]\d{9}$/;

const salesItemSchema = z
  .object({
    productId: z.uuid("Select product"),
    warehouseId: z.preprocess(trimToNull, z.uuid().nullable()),
    batchId: z.preprocess(trimToNull, z.uuid().nullable()),
    quantity: decimalField(Number.EPSILON),
    saleRate: decimalField(0),
    mrp: decimalField(0),
    priceTaxType: z.enum(["inclusive", "exclusive"]),
    discountPercent: decimalField(0, 100),
    discountAmount: decimalField(0),
    gstRate: decimalField(0, 28),
    cessRate: decimalField(0, 100),
    remarks: optionalNullableText(500),
    productType: z.enum(["goods", "service"]).optional(),
    decimalAllowed: z.boolean().optional(),
    batchTrackingEnabled: z.boolean().optional(),
    expiryTrackingEnabled: z.boolean().optional(),
    minimumSalePrice: decimalField(0).optional(),
    batchStatus: z.string().nullable().optional(),
    batchExpiryDate: nullableDateString.optional(),
    availableQuantity: decimalField(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (!GST_RATE_OPTIONS.includes(value.gstRate as (typeof GST_RATE_OPTIONS)[number])) {
      ctx.addIssue({
        code: "custom",
        path: ["gstRate"],
        message: `GST rate must be one of ${GST_RATE_OPTIONS.join(", ")}`,
      });
    }

    if (value.decimalAllowed === false && !Number.isInteger(value.quantity)) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "This product allows whole quantity only",
      });
    }

    if (value.productType === "goods" && !value.warehouseId) {
      ctx.addIssue({
        code: "custom",
        path: ["warehouseId"],
        message: "Warehouse is required",
      });
    }

    if (value.productType === "service" && value.warehouseId) {
      ctx.addIssue({
        code: "custom",
        path: ["warehouseId"],
        message: "Services cannot use warehouse",
      });
    }

    if (value.batchTrackingEnabled && !value.batchId && value.productType === "goods") {
      ctx.addIssue({
        code: "custom",
        path: ["batchId"],
        message: "Batch is required",
      });
    }

    if (value.batchStatus === "expired") {
      ctx.addIssue({
        code: "custom",
        path: ["batchId"],
        message: "Expired batch cannot be sold",
      });
    }

    if (value.minimumSalePrice !== undefined && value.saleRate < value.minimumSalePrice) {
      ctx.addIssue({
        code: "custom",
        path: ["saleRate"],
        message: `Sale rate cannot be below ${value.minimumSalePrice.toFixed(2)}`,
      });
    }
  });

export const salesFormSchema = z
  .object({
    invoiceType: z.enum(["gst_invoice", "pos"]),
    invoiceStatus: z.enum(["draft", "posted"]),
    invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select invoice date"),
    dueDate: nullableDateString,
    customerId: z.preprocess(trimToNull, z.uuid().nullable()),
    isWalkIn: z.boolean(),
    walkInName: optionalNullableText(150),
    walkInMobile: z.preprocess(trimToNull, z.string().regex(mobileRegex, "Enter valid mobile").nullable()),
    placeOfSupply: optionalNullableText(100),
    warehouseId: z.string().uuid("Select warehouse"),
    priceTaxType: z.enum(["inclusive", "exclusive"]),
    items: z.array(salesItemSchema).min(1, "Add at least one item"),
    invoiceDiscountTotal: decimalField(0),
    deliveryCharges: decimalField(0),
    packingCharges: decimalField(0),
    otherCharges: decimalField(0),
    paidAmount: decimalField(0),
    paymentMode: z.preprocess(trimToNull, z.enum(["cash", "bank", "upi", "card", "cheque"]).nullable()),
    paymentReference: optionalNullableText(150),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable()),
    notes: optionalNullableText(2000),
    termsConditions: optionalNullableText(2000),
    grandTotalPreview: decimalField(0).optional().default(0),
  })
  .superRefine((value, ctx) => {
    const invoiceDate = new Date(value.invoiceDate);
    if (invoiceDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["invoiceDate"],
        message: "Invoice date cannot be in the future",
      });
    }

    if (value.dueDate && value.dueDate < value.invoiceDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date must be on or after invoice date",
      });
    }

    if (!value.isWalkIn && !value.customerId) {
      ctx.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Customer is required",
      });
    }

    if (value.isWalkIn && !value.walkInName) {
      ctx.addIssue({
        code: "custom",
        path: ["walkInName"],
        message: "Walk-in name is required",
      });
    }

    if (value.paidAmount > value.grandTotalPreview) {
      ctx.addIssue({
        code: "custom",
        path: ["paidAmount"],
        message: "Paid amount cannot exceed grand total",
      });
    }

    if (value.paidAmount > 0 && !value.paymentMode) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMode"],
        message: "Payment mode is required",
      });
    }

    if (value.paymentMode && ["bank", "upi", "card", "cheque"].includes(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required",
      });
    }

    value.items.forEach((item, index) => {
      if (item.productType === "goods" && !item.warehouseId && !value.warehouseId) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "warehouseId"],
          message: "Warehouse is required",
        });
      }
    });
  })
  .transform(
    (value): SalesFormInput => ({
      invoiceType: value.invoiceType,
      invoiceStatus: value.invoiceStatus,
      invoiceDate: value.invoiceDate,
      dueDate: value.dueDate,
      customerId: value.isWalkIn ? null : value.customerId,
      isWalkIn: value.isWalkIn,
      walkInName: value.isWalkIn ? value.walkInName : null,
      walkInMobile: value.isWalkIn ? value.walkInMobile : null,
      placeOfSupply: value.placeOfSupply,
      warehouseId: value.warehouseId,
      priceTaxType: value.priceTaxType,
      items: value.items.map((item) => ({
        productId: item.productId,
        warehouseId: item.productType === "service" ? null : item.warehouseId ?? value.warehouseId,
        batchId: item.batchId,
        quantity: item.quantity,
        saleRate: item.saleRate,
        mrp: item.mrp,
        priceTaxType: item.priceTaxType,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        gstRate: item.gstRate,
        cessRate: item.cessRate,
        remarks: item.remarks,
      })),
      invoiceDiscountTotal: value.invoiceDiscountTotal,
      deliveryCharges: value.deliveryCharges,
      packingCharges: value.packingCharges,
      otherCharges: value.otherCharges,
      paidAmount: value.paidAmount,
      paymentMode: value.paidAmount > 0 ? value.paymentMode : null,
      paymentReference: value.paymentReference,
      bankAccountId: value.paidAmount > 0 ? value.bankAccountId : null,
      notes: value.notes,
      termsConditions: value.termsConditions,
    }),
  );

export type SalesFormValues = z.input<typeof salesFormSchema>;

export const salesPaymentSchema = z
  .object({
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select payment date"),
    amount: decimalField(Number.EPSILON),
    paymentMode: z.enum(["cash", "bank", "upi", "card", "cheque"], { message: "Select payment mode" }),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable()),
    referenceNumber: optionalNullableText(150),
    notes: optionalNullableText(1000),
    maxAmount: decimalField(0).optional().default(0),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.paymentDate).getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentDate"],
        message: "Payment date cannot be in the future",
      });
    }

    if (value.amount > value.maxAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Amount cannot exceed due",
      });
    }

    if (["bank", "upi", "card", "cheque"].includes(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required",
      });
    }
  })
  .transform(
    (value): SalesPaymentInput => ({
      paymentDate: value.paymentDate,
      amount: value.amount,
      paymentMode: value.paymentMode,
      bankAccountId: value.bankAccountId,
      referenceNumber: value.referenceNumber,
      notes: value.notes,
    }),
  );

export type SalesPaymentValues = z.input<typeof salesPaymentSchema>;

const salesReturnItemSchema = z
  .object({
    salesInvoiceItemId: z.uuid(),
    quantity: decimalField(0),
    remarks: optionalNullableText(500),
    maxReturnableQty: decimalField(0).optional().default(0),
  })
  .superRefine((value, ctx) => {
    if (value.quantity > 0 && value.quantity > value.maxReturnableQty) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Quantity exceeds returnable qty",
      });
    }
  });

export const salesReturnSchema = z
  .object({
    salesInvoiceId: z.uuid("Select sales invoice"),
    returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select return date"),
    warehouseId: z.preprocess(trimToNull, z.uuid().nullable()),
    reason: z.preprocess(trim, z.string().min(3, "Reason is required").max(500, "Must be 500 characters or fewer")),
    notes: optionalNullableText(2000),
    items: z.array(salesReturnItemSchema).min(1),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.returnDate).getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["returnDate"],
        message: "Return date cannot be in the future",
      });
    }

    if (!value.items.some((item) => item.quantity > 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Enter at least one return quantity",
      });
    }
  })
  .transform(
    (value): SalesReturnInput => ({
      salesInvoiceId: value.salesInvoiceId,
      returnDate: value.returnDate,
      warehouseId: value.warehouseId,
      reason: value.reason,
      notes: value.notes,
      items: value.items
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          salesInvoiceItemId: item.salesInvoiceItemId,
          quantity: item.quantity,
          remarks: item.remarks,
        })),
    }),
  );

export type SalesReturnValues = z.input<typeof salesReturnSchema>;
