import { z } from "zod";

import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  FINANCIAL_LOCK_TYPES,
  JOURNAL_VOUCHER_TYPES,
} from "../../types/accounting";

const moneyNumber = z
  .coerce
  .number()
  .refine((value) => Number.isFinite(value), "Enter a valid amount")
  .refine((value) => value >= 0, "Amount cannot be negative");

const nullableTrimmedString = (maxLength: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return null;
      }

      const normalized = String(value).trim();
      return normalized ? normalized : null;
    },
    z.string().max(maxLength).nullable(),
  );

const requiredDateString = z
  .string()
  .min(1, "Date is required")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Date is invalid");

const notFutureDate = (label: string) =>
  requiredDateString.refine((value) => new Date(value).getTime() <= Date.now(), `${label} cannot be in the future`);

export const accountFormSchema = z.object({
  accountCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{2,30}$/, "Use 2-30 uppercase letters, numbers, _ or -")
    .or(z.literal("")),
  accountName: z.string().trim().min(2, "Account name must be at least 2 characters").max(150, "Account name must be at most 150 characters"),
  accountType: z.enum(ACCOUNT_TYPES),
  accountSubtype: nullableTrimmedString(100),
  parentId: z.string().nullable(),
  openingBalance: moneyNumber,
  openingBalanceType: z.enum(["debit", "credit", "none"]),
  status: z.enum(["active", "inactive"]),
  description: nullableTrimmedString(500),
});

export const openingBalanceFormSchema = z
  .object({
    accountId: z.string().min(1, "Account is required"),
    financialYearId: z.string().nullable(),
    openingDate: notFutureDate("Opening date"),
    debit: moneyNumber,
    credit: moneyNumber,
    description: nullableTrimmedString(300),
  })
  .superRefine((value, ctx) => {
    if ((value.debit > 0 && value.credit > 0) || (value.debit <= 0 && value.credit <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["debit"],
        message: "Enter either debit or credit",
      });
    }
  });

export const journalLineFormSchema = z
  .object({
    accountId: z.string().min(1, "Account is required"),
    description: nullableTrimmedString(300),
    debit: moneyNumber,
    credit: moneyNumber,
  })
  .superRefine((value, ctx) => {
    if ((value.debit > 0 && value.credit > 0) || (value.debit <= 0 && value.credit <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["debit"],
        message: "Use one side only",
      });
    }
  });

export const journalFormSchema = z
  .object({
    financialYearId: z.string().nullable(),
    journalNumber: nullableTrimmedString(40),
    entryDate: notFutureDate("Journal date"),
    voucherType: z.enum(JOURNAL_VOUCHER_TYPES),
    referenceType: nullableTrimmedString(100),
    referenceId: z.string().nullable(),
    referenceNumber: nullableTrimmedString(100),
    description: z.string().trim().min(3, "Description must be at least 3 characters").max(500, "Description must be at most 500 characters"),
    lines: z.array(journalLineFormSchema).min(2, "At least two journal lines are required"),
  })
  .superRefine((value, ctx) => {
    const totalDebit = value.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = value.lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Total debit must equal total credit",
      });
    }
  });

export const journalReasonSchema = z.object({
  reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(500, "Reason must be at most 500 characters"),
  reversalDate: z.string().nullable(),
});

export const dateRangeSchema = z
  .object({
    dateFrom: z.string().min(1, "From date is required"),
    dateTo: z.string().min(1, "To date is required"),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.dateTo).getTime() < new Date(value.dateFrom).getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "To date must be on or after from date",
      });
    }
  });

export const reportRangeSchema = z
  .object({
    financialYearId: z.string().nullable(),
    dateFrom: z.string(),
    dateTo: z.string(),
  })
  .superRefine((value, ctx) => {
    if (!value.financialYearId && (!value.dateFrom || !value.dateTo)) {
      ctx.addIssue({
        code: "custom",
        path: ["financialYearId"],
        message: "Select a financial year or date range",
      });
    }

    if (value.dateFrom && value.dateTo && new Date(value.dateTo).getTime() < new Date(value.dateFrom).getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "To date must be on or after from date",
      });
    }
  });

export const balanceSheetFilterSchema = z.object({
  financialYearId: z.string().nullable(),
  asOfDate: z.string(),
});

export const periodLockFormSchema = z
  .object({
    financialYearId: z.string().nullable(),
    periodStart: requiredDateString,
    periodEnd: requiredDateString,
    lockType: z.enum(FINANCIAL_LOCK_TYPES),
    reason: nullableTrimmedString(500),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.periodEnd).getTime() < new Date(value.periodStart).getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "Period end must be on or after start",
      });
    }
  });

export const accountFilterStatusOptions = ["", ...ACCOUNT_STATUSES.filter((status) => status !== "deleted")] as const;

export type AccountFormValues = z.infer<typeof accountFormSchema>;
export type AccountFormInputValues = z.input<typeof accountFormSchema>;
export type OpeningBalanceFormValues = z.infer<typeof openingBalanceFormSchema>;
export type OpeningBalanceFormInputValues = z.input<typeof openingBalanceFormSchema>;
export type JournalFormValues = z.infer<typeof journalFormSchema>;
export type JournalFormInputValues = z.input<typeof journalFormSchema>;
export type JournalReasonFormValues = z.infer<typeof journalReasonSchema>;
export type JournalReasonFormInputValues = z.input<typeof journalReasonSchema>;
export type PeriodLockFormValues = z.infer<typeof periodLockFormSchema>;
export type PeriodLockFormInputValues = z.input<typeof periodLockFormSchema>;
