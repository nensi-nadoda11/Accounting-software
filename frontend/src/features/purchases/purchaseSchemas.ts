import { z } from "zod";

import { GST_RATE_OPTIONS } from "../products/productOptions";
import type { PurchaseFormInput, PurchasePaymentInput, PurchaseReturnInput, PurchaseReturnRefundInput } from "../../types/purchase";

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

const purchaseItemSchema = z
  .object({
    productId: z.uuid("Select product"),
    warehouseId: z.preprocess(trimToNull, z.uuid().nullable()),
    batchId: z.preprocess(trimToNull, z.uuid().nullable()),
    batchNumber: optionalNullableText(80),
    quantity: decimalField(Number.EPSILON),
    freeQuantity: decimalField(0),
    purchaseRate: decimalField(0),
    priceTaxType: z.enum(["inclusive", "exclusive"]),
    discountPercent: decimalField(0, 100),
    discountAmount: decimalField(0),
    gstRate: decimalField(0, 28),
    cessRate: decimalField(0, 100),
    manufacturingDate: nullableDateString,
    expiryDate: nullableDateString,
    remarks: optionalNullableText(500),
    productType: z.enum(["goods", "service"]).optional(),
    decimalAllowed: z.boolean().optional(),
    batchTrackingEnabled: z.boolean().optional(),
    expiryTrackingEnabled: z.boolean().optional(),
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

    if (value.decimalAllowed === false && !Number.isInteger(value.freeQuantity)) {
      ctx.addIssue({
        code: "custom",
        path: ["freeQuantity"],
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

    if (value.batchTrackingEnabled && !value.batchId && !value.batchNumber) {
      ctx.addIssue({
        code: "custom",
        path: ["batchNumber"],
        message: "Batch is required",
      });
    }

    if (value.expiryTrackingEnabled && !value.expiryDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date is required",
      });
    }

    if (value.expiryDate && value.manufacturingDate && value.expiryDate <= value.manufacturingDate) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryDate"],
        message: "Expiry date must be after MFG date",
      });
    }
  });

export const purchaseFormSchema = z
  .object({
    supplierId: z.uuid("Select supplier"),
    supplierInvoiceNumber: optionalNullableText(100),
    invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select invoice date"),
    dueDate: nullableDateString,
    warehouseId: z.preprocess(trimToNull, z.uuid().nullable()),
    purchaseStatus: z.enum(["draft", "posted"]),
    items: z.array(purchaseItemSchema).min(1, "Add at least one item"),
    invoiceDiscountTotal: decimalField(0),
    additionalCharges: decimalField(0),
    freightCharges: decimalField(0),
    paidAmount: decimalField(0),
    paymentMode: z.preprocess(trimToNull, z.enum(["cash", "bank", "upi", "card", "cheque"]).nullable()),
    paymentReference: optionalNullableText(150),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable()),
    notes: optionalNullableText(2000),
    termsConditions: optionalNullableText(2000),
    attachmentUrl: optionalNullableText(500),
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

    if (value.paidAmount > 0 && value.paymentMode && ["bank", "upi", "card", "cheque"].includes(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["bankAccountId"],
        message: "Bank account is required",
      });
    }

    value.items.forEach((item, index) => {
      if (!value.warehouseId && item.productType === "goods" && !item.warehouseId) {
        ctx.addIssue({
          code: "custom",
          path: ["warehouseId"],
          message: "Warehouse is required",
        });
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "warehouseId"],
          message: "Warehouse is required",
        });
      }
    });
  })
  .transform(
    (value): PurchaseFormInput => ({
      supplierId: value.supplierId,
      supplierInvoiceNumber: value.supplierInvoiceNumber,
      invoiceDate: value.invoiceDate,
      dueDate: value.dueDate,
      warehouseId: value.warehouseId,
      purchaseStatus: value.purchaseStatus,
      items: value.items.map((item) => ({
        productId: item.productId,
        warehouseId: item.productType === "service" ? null : item.warehouseId ?? value.warehouseId,
        batchId: item.batchId,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
        freeQuantity: item.freeQuantity,
        purchaseRate: item.purchaseRate,
        priceTaxType: item.priceTaxType,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        gstRate: item.gstRate,
        cessRate: item.cessRate,
        manufacturingDate: item.manufacturingDate,
        expiryDate: item.expiryDate,
        remarks: item.remarks,
      })),
      invoiceDiscountTotal: value.invoiceDiscountTotal,
      additionalCharges: value.additionalCharges,
      freightCharges: value.freightCharges,
      paidAmount: value.paidAmount,
      paymentMode: value.paidAmount > 0 ? value.paymentMode : null,
      paymentReference: value.paymentReference,
      bankAccountId: value.paidAmount > 0 ? value.bankAccountId : null,
      notes: value.notes,
      termsConditions: value.termsConditions,
      attachmentUrl: value.attachmentUrl,
    }),
  );

export type PurchaseFormValues = z.input<typeof purchaseFormSchema>;

export const purchasePaymentSchema = z
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
    (value): PurchasePaymentInput => ({
      paymentDate: value.paymentDate,
      amount: value.amount,
      paymentMode: value.paymentMode,
      bankAccountId: value.bankAccountId,
      referenceNumber: value.referenceNumber,
      notes: value.notes,
    }),
  );

export type PurchasePaymentValues = z.input<typeof purchasePaymentSchema>;

const purchaseReturnItemSchema = z
  .object({
    purchaseInvoiceItemId: z.uuid(),
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

export const purchaseReturnSchema = z
  .object({
    purchaseInvoiceId: z.uuid("Select purchase invoice"),
    returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select return date"),
    warehouseId: z.preprocess(trimToNull, z.uuid().nullable()),
    refundAmountReceived: decimalField(0),
    refundPaymentMode: z.preprocess(trimToNull, z.enum(["cash", "bank", "upi", "card", "cheque"]).nullable()),
    refundBankAccountId: z.preprocess(trimToNull, z.uuid().nullable()),
    refundReferenceNumber: optionalNullableText(150),
    refundNotes: optionalNullableText(1000),
    notes: z.preprocess(trim, z.string().min(3, "Reason is required").max(2000, "Must be 2000 characters or fewer")),
    items: z.array(purchaseReturnItemSchema).min(1),
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

    const selectedTotal = value.items.reduce((sum, item) => sum + (item.quantity > 0 ? item.quantity : 0), 0);
    if (value.refundAmountReceived > 0 && !value.refundPaymentMode) {
      ctx.addIssue({
        code: "custom",
        path: ["refundPaymentMode"],
        message: "Refund mode is required",
      });
    }

    if (value.refundAmountReceived > 0 && ["bank", "upi", "card", "cheque"].includes(value.refundPaymentMode ?? "") && !value.refundBankAccountId) {
      ctx.addIssue({
        code: "custom",
        path: ["refundBankAccountId"],
        message: "Bank account is required",
      });
    }

    if (selectedTotal <= 0 && value.refundAmountReceived > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["refundAmountReceived"],
        message: "Enter return quantity first",
      });
    }
  })
  .transform(
    (value): PurchaseReturnInput => ({
      purchaseInvoiceId: value.purchaseInvoiceId,
      returnDate: value.returnDate,
      warehouseId: value.warehouseId,
      refundAmountReceived: value.refundAmountReceived,
      refundPaymentMode: value.refundPaymentMode,
      refundBankAccountId: value.refundBankAccountId,
      refundReferenceNumber: value.refundReferenceNumber,
      refundNotes: value.refundNotes,
      notes: value.notes,
      items: value.items
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          purchaseInvoiceItemId: item.purchaseInvoiceItemId,
          quantity: item.quantity,
          remarks: item.remarks,
        })),
    }),
  );

export type PurchaseReturnValues = z.input<typeof purchaseReturnSchema>;

export const purchaseReturnRefundSchema = z
  .object({
    refundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select refund date"),
    amount: decimalField(Number.EPSILON),
    paymentMode: z.enum(["cash", "bank", "upi", "card", "cheque"], { message: "Select refund mode" }),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable()),
    referenceNumber: optionalNullableText(150),
    notes: optionalNullableText(1000),
    maxAmount: decimalField(0).optional().default(0),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.refundDate).getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["refundDate"],
        message: "Refund date cannot be in the future",
      });
    }

    if (value.amount > value.maxAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Amount cannot exceed pending refund",
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
    (value): PurchaseReturnRefundInput => ({
      refundDate: value.refundDate,
      amount: value.amount,
      paymentMode: value.paymentMode,
      bankAccountId: value.bankAccountId,
      referenceNumber: value.referenceNumber,
      notes: value.notes,
    }),
  );

export type PurchaseReturnRefundValues = z.input<typeof purchaseReturnRefundSchema>;
