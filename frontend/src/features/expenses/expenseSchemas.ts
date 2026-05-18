import { z } from "zod";

import {
  BANK_LINKED_PAYMENT_MODES,
  REFERENCE_REQUIRED_PAYMENT_MODES,
} from "./expenseOptions";
import type { ExpenseFormInput, RecurringExpenseFormInput } from "../../types/expense";

const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const hsnSacRegex = /^[0-9]{4,8}$/;
const safeColorRegex = /^#[0-9A-Fa-f]{6}$/;

const trimToNull = (value: unknown) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const nullableString = (max: number) =>
  z.preprocess(trimToNull, z.string().max(max, `Must be ${max} characters or fewer`).nullable());

const nullableDateString = z.preprocess(trimToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());

const decimalField = (min: number, max?: number) =>
  z.coerce
    .number({ message: "Enter a valid number" })
    .refine((value) => Number.isFinite(value), "Enter a valid number")
    .min(min, min > 0 ? `Must be greater than ${min}` : `Must be at least ${min}`)
    .refine((value) => (max === undefined ? true : value <= max), max === undefined ? undefined : `Must be ${max} or less`);

export const expenseFormSchema = z
  .object({
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expense date is required"),
    categoryId: z.uuid("Category is required"),
    expenseAccountId: z.preprocess(trimToNull, z.uuid().nullable()),
    payeeName: nullableString(150),
    vendorGstNumber: z.preprocess(
      trimToNull,
      z
        .string()
        .regex(gstRegex, "Vendor GST number is invalid")
        .transform((value) => value.toUpperCase())
        .nullable(),
    ),
    vendorPanNumber: z.preprocess(
      trimToNull,
      z
        .string()
        .regex(panRegex, "Vendor PAN number is invalid")
        .transform((value) => value.toUpperCase())
        .nullable(),
    ),
    hsnSacCode: z.preprocess(trimToNull, z.string().regex(hsnSacRegex, "HSN / SAC code is invalid").nullable()),
    description: z.string().trim().min(2, "Description is required").max(500, "Must be 500 characters or fewer"),
    amount: decimalField(Number.EPSILON),
    gstApplicable: z.boolean(),
    gstRate: decimalField(0, 28),
    priceTaxType: z.enum(["inclusive", "exclusive"]),
    paymentMode: z.enum(["cash", "bank", "upi", "card", "cheque", "neft", "rtgs", "imps", "other"]),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable()),
    referenceNumber: nullableString(150),
    chequeNumber: nullableString(100),
    chequeDate: nullableDateString,
    chequeStatus: z.enum(["issued", "deposited", "cleared", "bounced", "cancelled"]).nullable(),
    notes: nullableString(2000),
    status: z.enum(["draft", "posted"]).optional().default("draft"),
  })
  .superRefine((value, ctx) => {
    const expenseDate = new Date(value.expenseDate);
    if (Number.isNaN(expenseDate.getTime())) {
      ctx.addIssue({ code: "custom", path: ["expenseDate"], message: "Expense date is required" });
    } else if (expenseDate.getTime() > Date.now()) {
      ctx.addIssue({ code: "custom", path: ["expenseDate"], message: "Expense date cannot be in the future" });
    }

    if (!value.gstApplicable && value.gstRate !== 0) {
      ctx.addIssue({ code: "custom", path: ["gstRate"], message: "GST rate must be 0 when GST is not applicable" });
    }

    if (value.gstApplicable && ![0, 0.25, 3, 5, 12, 18, 28].includes(value.gstRate)) {
      ctx.addIssue({ code: "custom", path: ["gstRate"], message: "GST rate must be one of 0, 0.25, 3, 5, 12, 18, 28" });
    }

    if (BANK_LINKED_PAYMENT_MODES.has(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({ code: "custom", path: ["bankAccountId"], message: "Bank account is required" });
    }

    if (REFERENCE_REQUIRED_PAYMENT_MODES.has(value.paymentMode) && !value.referenceNumber) {
      ctx.addIssue({ code: "custom", path: ["referenceNumber"], message: "Reference number is required" });
    }

    if (value.paymentMode === "cheque") {
      if (!value.chequeNumber) {
        ctx.addIssue({ code: "custom", path: ["chequeNumber"], message: "Cheque number is required" });
      }

      if (!value.chequeDate) {
        ctx.addIssue({ code: "custom", path: ["chequeDate"], message: "Cheque date is required" });
      }
    }
  })
  .transform((value): ExpenseFormInput => ({
    expenseDate: value.expenseDate,
    categoryId: value.categoryId,
    expenseAccountId: value.expenseAccountId,
    payeeName: value.payeeName,
    vendorGstNumber: value.vendorGstNumber,
    vendorPanNumber: value.vendorPanNumber,
    hsnSacCode: value.hsnSacCode,
    description: value.description.trim(),
    amount: value.amount,
    gstApplicable: value.gstApplicable,
    gstRate: value.gstRate as ExpenseFormInput["gstRate"],
    priceTaxType: value.priceTaxType,
    paymentMode: value.paymentMode,
    bankAccountId: value.bankAccountId,
    referenceNumber: value.referenceNumber,
    chequeNumber: value.chequeNumber,
    chequeDate: value.chequeDate,
    chequeStatus: value.chequeStatus,
    notes: value.notes,
    status: value.status,
  }));

export type ExpenseFormValues = z.output<typeof expenseFormSchema>;
export type ExpenseFormInputValues = z.input<typeof expenseFormSchema>;

export const expenseCancelSchema = z.object({
  cancellationReason: z.string().trim().min(3, "Reason is required").max(500, "Must be 500 characters or fewer"),
});

export type ExpenseCancelValues = z.output<typeof expenseCancelSchema>;
export type ExpenseCancelInputValues = z.input<typeof expenseCancelSchema>;

export const expenseCategorySchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(100, "Must be 100 characters or fewer"),
    parentId: z.preprocess(trimToNull, z.uuid().nullable()),
    defaultAccountId: z.preprocess(trimToNull, z.uuid().nullable()),
    color: z.preprocess(trimToNull, z.string().regex(safeColorRegex, "Color must be a hex value").nullable()),
    icon: nullableString(100),
    description: nullableString(500),
    status: z.enum(["active", "inactive"]),
    currentId: z.preprocess(trimToNull, z.uuid().nullable()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.currentId && value.parentId && value.currentId === value.parentId) {
      ctx.addIssue({ code: "custom", path: ["parentId"], message: "A category cannot be its own parent" });
    }
  })
  .transform((value) => ({
    name: value.name.trim(),
    parentId: value.parentId,
    defaultAccountId: value.defaultAccountId,
    color: value.color,
    icon: value.icon,
    description: value.description,
    status: value.status,
  }));

export type ExpenseCategoryValues = z.output<typeof expenseCategorySchema>;
export type ExpenseCategoryInputValues = z.input<typeof expenseCategorySchema>;

export const recurringExpenseSchema = z
  .object({
    templateName: z.string().trim().min(2, "Template name is required").max(120, "Must be 120 characters or fewer"),
    categoryId: z.uuid("Category is required"),
    expenseAccountId: z.preprocess(trimToNull, z.uuid().nullable()),
    payeeName: nullableString(150),
    description: z.string().trim().min(2, "Description is required").max(500, "Must be 500 characters or fewer"),
    amount: decimalField(Number.EPSILON),
    gstApplicable: z.boolean(),
    gstRate: decimalField(0, 28),
    priceTaxType: z.enum(["inclusive", "exclusive"]),
    paymentMode: z.enum(["cash", "bank", "upi", "card", "cheque", "neft", "rtgs", "imps", "other"]),
    bankAccountId: z.preprocess(trimToNull, z.uuid().nullable()),
    frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
    endDate: nullableDateString,
    nextRunDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Next run date is required"),
    autoCreateEnabled: z.boolean(),
    createAsStatus: z.enum(["draft", "posted"]),
    reminderDaysBefore: z.coerce.number().int().min(0, "Reminder days must be 0 or more"),
    status: z.enum(["active", "paused", "completed", "cancelled"]).optional().default("active"),
  })
  .superRefine((value, ctx) => {
    if (value.gstApplicable && ![0, 0.25, 3, 5, 12, 18, 28].includes(value.gstRate)) {
      ctx.addIssue({ code: "custom", path: ["gstRate"], message: "GST rate must be one of 0, 0.25, 3, 5, 12, 18, 28" });
    }

    if (!value.gstApplicable && value.gstRate !== 0) {
      ctx.addIssue({ code: "custom", path: ["gstRate"], message: "GST rate must be 0 when GST is not applicable" });
    }

    if (BANK_LINKED_PAYMENT_MODES.has(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({ code: "custom", path: ["bankAccountId"], message: "Bank account is required" });
    }

    const startDate = new Date(value.startDate);
    const nextRunDate = new Date(value.nextRunDate);
    const endDate = value.endDate ? new Date(value.endDate) : null;

    if (endDate && endDate < startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date" });
    }

    if (nextRunDate < startDate) {
      ctx.addIssue({ code: "custom", path: ["nextRunDate"], message: "Next run date must be on or after start date" });
    }
  })
  .transform((value): RecurringExpenseFormInput => ({
    templateName: value.templateName.trim(),
    categoryId: value.categoryId,
    expenseAccountId: value.expenseAccountId,
    payeeName: value.payeeName,
    description: value.description.trim(),
    amount: value.amount,
    gstApplicable: value.gstApplicable,
    gstRate: value.gstRate as RecurringExpenseFormInput["gstRate"],
    priceTaxType: value.priceTaxType,
    paymentMode: value.paymentMode,
    bankAccountId: value.bankAccountId,
    frequency: value.frequency,
    startDate: value.startDate,
    endDate: value.endDate,
    nextRunDate: value.nextRunDate,
    autoCreateEnabled: value.autoCreateEnabled,
    createAsStatus: value.createAsStatus,
    reminderDaysBefore: value.reminderDaysBefore,
    status: value.status,
  }));

export type RecurringExpenseValues = z.output<typeof recurringExpenseSchema>;
export type RecurringExpenseInputValues = z.input<typeof recurringExpenseSchema>;
