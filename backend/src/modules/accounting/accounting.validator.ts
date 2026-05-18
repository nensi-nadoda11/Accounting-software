import { z } from "zod";

import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ACCOUNTING_EVENT_STATUSES,
  ACCOUNTING_EXPORT_FORMATS,
  FINANCIAL_LOCK_TYPES,
  JOURNAL_PARTY_TYPES,
  JOURNAL_STATUSES,
  JOURNAL_VOUCHER_TYPES
} from "./accounting.types";

const accountCodeRegex = /^[A-Z0-9_-]{2,30}$/;
const meaningfulTextRegex = /[\p{L}\p{N}]/u;

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

const parseDateInput = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
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

const optionalDate = z.preprocess(parseDateInput, z.coerce.date().nullable().optional());
const requiredDate = z.coerce.date();

const optionalNullableString = (maxLength: number) =>
  z.preprocess(trimToNull, z.string().trim().max(maxLength).nullable().optional());

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

const positiveMoney = decimalNumber({ min: Number.EPSILON });
const nonNegativeMoney = decimalNumber({ min: 0 });

const dateRangeSchema = z
  .object({
    dateFrom: optionalDate,
    dateTo: optionalDate
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateTo < value.dateFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["dateTo"],
        message: "dateTo must be greater than or equal to dateFrom"
      });
    }
  });

export const accountIdParamSchema = z.object({
  id: z.uuid()
});

export const openingBalanceIdParamSchema = z.object({
  id: z.uuid()
});

export const journalIdParamSchema = z.object({
  id: z.uuid()
});

export const accountLedgerParamSchema = z.object({
  accountId: z.uuid()
});

export const customerLedgerParamSchema = z.object({
  customerId: z.uuid()
});

export const supplierLedgerParamSchema = z.object({
  supplierId: z.uuid()
});

export const accountingEventIdParamSchema = z.object({
  id: z.uuid()
});

export const financialPeriodLockIdParamSchema = z.object({
  id: z.uuid()
});

export const listAccountsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  type: z.enum(ACCOUNT_TYPES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  parentId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
  hierarchy: z.preprocess(parseBooleanQuery, z.boolean().optional().default(false))
});

export const createAccountSchema = z
  .object({
    accountCode: z
      .preprocess(trimToNull, z.string().trim().toUpperCase().regex(accountCodeRegex, "Invalid account code").nullable().optional()),
    accountName: z
      .string()
      .trim()
      .min(2, "Account name must be at least 2 characters")
      .max(150, "Account name must be at most 150 characters")
      .refine((value) => meaningfulTextRegex.test(value), "Account name must contain letters or numbers"),
    accountType: z.enum(ACCOUNT_TYPES),
    accountSubtype: optionalNullableString(100),
    parentId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    openingBalance: nonNegativeMoney.optional().default(0),
    openingBalanceType: z.enum(["debit", "credit", "none"]).optional().default("none"),
    description: optionalNullableString(500)
  })
  .strict();

export const updateAccountSchema = z
  .object({
    accountName: z.string().trim().min(2).max(150).optional(),
    accountSubtype: optionalNullableString(100),
    parentId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    status: z.enum(["active", "inactive"]).optional(),
    description: optionalNullableString(500)
  })
  .strict();

export const seedDefaultAccountsSchema = z.object({}).strict();

export const listOpeningBalancesQuerySchema = dateRangeSchema.safeExtend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  accountId: z.uuid().optional(),
  financialYearId: z.uuid().optional(),
  isLocked: z.preprocess(parseBooleanQuery, z.boolean().optional())
});

const openingBalanceEntrySchema = z
  .object({
    accountId: z.uuid(),
    debit: nonNegativeMoney.optional().default(0),
    credit: nonNegativeMoney.optional().default(0),
    description: optionalNullableString(300)
  })
  .strict()
  .superRefine((value, ctx) => {
    const debit = Number(value.debit ?? 0);
    const credit = Number(value.credit ?? 0);
    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["debit"],
        message: "Exactly one of debit or credit must be greater than 0"
      });
    }
  });

export const createOpeningBalancesSchema = z
  .object({
    openingDate: requiredDate,
    financialYearId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    description: optionalNullableString(300),
    entries: z.array(openingBalanceEntrySchema).min(1, "At least one opening balance entry is required")
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.openingDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["openingDate"],
        message: "Opening date cannot be in the future"
      });
    }
  });

export const updateOpeningBalanceSchema = z
  .object({
    openingDate: requiredDate.optional(),
    debit: nonNegativeMoney.optional(),
    credit: nonNegativeMoney.optional(),
    description: optionalNullableString(300)
  })
  .strict()
  .superRefine((value, ctx) => {
    const debit = value.debit ?? 0;
    const credit = value.credit ?? 0;
    const provided = value.debit !== undefined || value.credit !== undefined;

    if (provided && ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0))) {
      ctx.addIssue({
        code: "custom",
        path: ["debit"],
        message: "Exactly one of debit or credit must be greater than 0"
      });
    }
  });

export const lockOpeningBalancesSchema = z
  .object({
    ids: z.array(z.uuid()).min(1, "At least one opening balance id is required")
  })
  .strict();

const journalLineSchema = z
  .object({
    accountId: z.uuid(),
    description: optionalNullableString(300),
    debit: nonNegativeMoney.optional().default(0),
    credit: nonNegativeMoney.optional().default(0),
    partyType: z.preprocess(trimToNull, z.enum(JOURNAL_PARTY_TYPES).nullable().optional()),
    partyId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceType: optionalNullableString(100),
    referenceId: z.preprocess(trimToNull, z.uuid().nullable().optional())
  })
  .strict()
  .superRefine((value, ctx) => {
    const debit = Number(value.debit ?? 0);
    const credit = Number(value.credit ?? 0);

    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["debit"],
        message: "Each journal line must contain only one positive side"
      });
    }

    if ((value.partyType && !value.partyId) || (!value.partyType && value.partyId)) {
      ctx.addIssue({
        code: "custom",
        path: ["partyId"],
        message: "partyType and partyId must be provided together"
      });
    }
  });

const baseJournalSchema = z
  .object({
    financialYearId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    journalNumber: z.preprocess(trimToNull, z.string().trim().max(40).toUpperCase().nullable().optional()),
    entryDate: requiredDate,
    voucherType: z.enum(JOURNAL_VOUCHER_TYPES),
    referenceType: optionalNullableString(100),
    referenceId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceNumber: optionalNullableString(100),
    description: z
      .string()
      .trim()
      .min(3, "Description must be at least 3 characters")
      .max(500, "Description must be at most 500 characters"),
    status: z.enum(["draft", "posted"]).optional().default("draft"),
    lines: z.array(journalLineSchema).min(2, "At least two journal lines are required")
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.entryDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["entryDate"],
        message: "Entry date cannot be in the future"
      });
    }

    const totalDebit = value.lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0);
    const totalCredit = value.lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0);
    if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Total debit must equal total credit"
      });
    }
  });

export const createJournalSchema = baseJournalSchema;

export const updateJournalSchema = z
  .object({
    financialYearId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    entryDate: requiredDate.optional(),
    voucherType: z.enum(JOURNAL_VOUCHER_TYPES).optional(),
    referenceType: optionalNullableString(100),
    referenceId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    referenceNumber: optionalNullableString(100),
    description: z.string().trim().min(3).max(500).optional(),
    lines: z.array(journalLineSchema).min(2).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.entryDate && value.entryDate.getTime() > Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["entryDate"],
        message: "Entry date cannot be in the future"
      });
    }

    if (value.lines) {
      const totalDebit = value.lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0);
      const totalCredit = value.lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0);
      if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
        ctx.addIssue({
          code: "custom",
          path: ["lines"],
          message: "Total debit must equal total credit"
        });
      }
    }
  });

export const listJournalsQuerySchema = dateRangeSchema.safeExtend({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToNull, z.string().trim().max(150).nullable().optional()),
  voucherType: z.enum(JOURNAL_VOUCHER_TYPES).optional(),
  status: z.enum(JOURNAL_STATUSES).optional(),
  referenceType: z.preprocess(trimToNull, z.string().trim().max(100).nullable().optional()),
  financialYearId: z.uuid().optional()
});

export const postJournalSchema = z
  .object({
    entryDate: requiredDate.optional()
  })
  .strict();

export const cancelOrReverseJournalSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be at least 3 characters")
      .max(500, "Reason must be at most 500 characters"),
    reversalDate: optionalDate
  })
  .strict();

export const ledgerQuerySchema = dateRangeSchema
  .safeExtend({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(200).optional().default(50)
  })
  .superRefine((value, ctx) => {
    if (!value.dateFrom || !value.dateTo) {
      ctx.addIssue({
        code: "custom",
        path: ["dateFrom"],
        message: "dateFrom and dateTo are required"
      });
    }
  });

export const bookQuerySchema = ledgerQuerySchema.safeExtend({
  bankAccountId: z.uuid().optional()
});

export const trialBalanceQuerySchema = dateRangeSchema
  .safeExtend({
    financialYearId: z.uuid().optional()
  })
  .superRefine((value, ctx) => {
    if (!value.financialYearId && (!value.dateFrom || !value.dateTo)) {
      ctx.addIssue({
        code: "custom",
        path: ["financialYearId"],
        message: "Either financialYearId or both dateFrom and dateTo are required"
      });
    }
  });

export const profitLossQuerySchema = trialBalanceQuerySchema;

export const balanceSheetQuerySchema = z.object({
  asOfDate: requiredDate.optional(),
  financialYearId: z.uuid().optional()
});

export const listAccountingEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(ACCOUNTING_EVENT_STATUSES).optional(),
  eventType: z.preprocess(trimToNull, z.string().trim().max(100).nullable().optional()),
  referenceType: z.preprocess(trimToNull, z.string().trim().max(100).nullable().optional())
});

export const postPendingAccountingEventsSchema = z
  .object({
    limit: z.coerce.number().int().positive().max(200).optional().default(50)
  })
  .strict();

export const listFinancialPeriodLocksQuerySchema = z.object({
  financialYearId: z.uuid().optional(),
  isLocked: z.preprocess(parseBooleanQuery, z.boolean().optional())
});

export const createFinancialPeriodLockSchema = z
  .object({
    financialYearId: z.preprocess(trimToNull, z.uuid().nullable().optional()),
    periodStart: requiredDate,
    periodEnd: requiredDate,
    lockType: z.enum(FINANCIAL_LOCK_TYPES),
    reason: optionalNullableString(500)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.periodEnd < value.periodStart) {
      ctx.addIssue({
        code: "custom",
        path: ["periodEnd"],
        message: "periodEnd must be greater than or equal to periodStart"
      });
    }
  });

export const exportLedgerQuerySchema = ledgerQuerySchema.safeExtend({
  format: z.enum(ACCOUNTING_EXPORT_FORMATS).optional().default("csv")
});

export const exportTrialBalanceQuerySchema = trialBalanceQuerySchema.safeExtend({
  format: z.enum(ACCOUNTING_EXPORT_FORMATS).optional().default("csv")
});

export const exportProfitLossQuerySchema = profitLossQuerySchema.safeExtend({
  format: z.enum(ACCOUNTING_EXPORT_FORMATS).optional().default("csv")
});

export const exportBalanceSheetQuerySchema = balanceSheetQuerySchema.safeExtend({
  format: z.enum(ACCOUNTING_EXPORT_FORMATS).optional().default("csv")
});

export const emptyBodySchema = z.object({}).strict();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ListAccountsQuery = z.infer<typeof listAccountsQuerySchema>;
export type ListOpeningBalancesQuery = z.infer<typeof listOpeningBalancesQuerySchema>;
export type CreateOpeningBalancesInput = z.infer<typeof createOpeningBalancesSchema>;
export type UpdateOpeningBalanceInput = z.infer<typeof updateOpeningBalanceSchema>;
export type LockOpeningBalancesInput = z.infer<typeof lockOpeningBalancesSchema>;
export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
export type ListJournalsQuery = z.infer<typeof listJournalsQuerySchema>;
export type PostJournalInput = z.infer<typeof postJournalSchema>;
export type CancelOrReverseJournalInput = z.infer<typeof cancelOrReverseJournalSchema>;
export type LedgerQuery = z.infer<typeof ledgerQuerySchema>;
export type BookQuery = z.infer<typeof bookQuerySchema>;
export type TrialBalanceQuery = z.infer<typeof trialBalanceQuerySchema>;
export type ProfitLossQuery = z.infer<typeof profitLossQuerySchema>;
export type BalanceSheetQuery = z.infer<typeof balanceSheetQuerySchema>;
export type ListAccountingEventsQuery = z.infer<typeof listAccountingEventsQuerySchema>;
export type PostPendingAccountingEventsInput = z.infer<typeof postPendingAccountingEventsSchema>;
export type ListFinancialPeriodLocksQuery = z.infer<typeof listFinancialPeriodLocksQuerySchema>;
export type CreateFinancialPeriodLockInput = z.infer<typeof createFinancialPeriodLockSchema>;
export type ExportLedgerQuery = z.infer<typeof exportLedgerQuerySchema>;
export type ExportTrialBalanceQuery = z.infer<typeof exportTrialBalanceQuerySchema>;
export type ExportProfitLossQuery = z.infer<typeof exportProfitLossQuerySchema>;
export type ExportBalanceSheetQuery = z.infer<typeof exportBalanceSheetQuerySchema>;
