import fs from "fs/promises";
import path from "path";

import { db } from "../../db";
import { env } from "../../config/env";
import { auditLogService } from "../audit-logs/audit-log.service";
import { accountingRepository } from "../accounting/accounting.repository";
import { accountingService } from "../accounting/accounting.service";
import { companyRepository } from "../company/company.repository";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
import {
  compareDecimals,
  normalizeMoney as normalizeMoneyValue
} from "../inventory/inventory.utils";
import { AppError } from "../../utils/app-error";
import {
  buildPrivateUploadReference,
  deleteUploadFileByUrl,
  getContentTypeFromFileName,
  resolveStoredUploadPath
} from "../../utils/upload";
import { getPagination } from "../../utils/pagination";
import {
  calculateExpenseTotals,
  calculateNextRunDate,
  normalizeMoney
} from "./expenses.calculation";
import { expensesRepository } from "./expenses.repository";
import { getExpenseUploadRelativeDirectory } from "./expenses.upload";
import type {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  CreateRecurringExpenseInput,
  ExpenseReportQuery,
  ExportExpensesQuery,
  ListExpenseCategoriesQuery,
  ListExpensesQuery,
  ListRecurringExpensesQuery,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
  UpdateRecurringExpenseInput,
  CancelExpenseInput
} from "./expenses.validator";
import type {
  ExpenseActor,
  ExpenseExportPayload,
  ExpenseMutationPolicy,
  ExpenseRequestContext
} from "./expenses.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

const INDIAN_GST_STATE_CODE_LENGTH = 2;

class ExpensesService {
  private assertExpenseDraftState(input: {
    expenseDate: Date;
    gstApplicable: boolean;
    gstRate: number;
    paymentMode: "cash" | "bank" | "upi" | "card" | "cheque" | "neft" | "rtgs" | "imps" | "other";
    bankAccountId: string | null;
    referenceNumber: string | null;
    chequeNumber: string | null;
    chequeDate: Date | null;
  }) {
    const bankLinkedModes = new Set(["bank", "upi", "card", "cheque", "neft", "rtgs", "imps"]);
    const referenceRequiredModes = new Set(["bank", "upi", "card", "neft", "rtgs", "imps"]);
    const allowedGstRates = new Set([0, 0.25, 3, 5, 12, 18, 28]);

    if (input.expenseDate.getTime() > Date.now()) {
      throw new AppError("Expense date cannot be in the future", 400);
    }

    if (!input.gstApplicable && input.gstRate !== 0) {
      throw new AppError("GST rate must be 0 when GST is not applicable", 400);
    }

    if (input.gstApplicable && !allowedGstRates.has(input.gstRate)) {
      throw new AppError("GST rate must be one of 0, 0.25, 3, 5, 12, 18, or 28", 400);
    }

    if (bankLinkedModes.has(input.paymentMode) && !input.bankAccountId) {
      throw new AppError("Bank account is required for the selected payment mode", 400);
    }

    if (referenceRequiredModes.has(input.paymentMode) && !input.referenceNumber) {
      throw new AppError("Reference number is required for the selected payment mode", 400);
    }

    if (input.paymentMode === "cheque") {
      if (!input.chequeNumber) {
        throw new AppError("Cheque number is required for cheque payments", 400);
      }

      if (!input.chequeDate) {
        throw new AppError("Cheque date is required for cheque payments", 400);
      }
    }
  }

  private assertRecurringTemplateState(input: {
    startDate: Date;
    endDate: Date | null;
    nextRunDate: Date;
    gstApplicable: boolean;
    gstRate: number;
    paymentMode: "cash" | "bank" | "upi" | "card" | "cheque" | "neft" | "rtgs" | "imps" | "other";
    bankAccountId: string | null;
  }) {
    const bankLinkedModes = new Set(["bank", "upi", "card", "cheque", "neft", "rtgs", "imps"]);
    const allowedGstRates = new Set([0, 0.25, 3, 5, 12, 18, 28]);

    if (input.endDate && input.endDate < input.startDate) {
      throw new AppError("End date must be greater than or equal to start date", 400);
    }

    if (input.nextRunDate < input.startDate) {
      throw new AppError("Next run date must be greater than or equal to start date", 400);
    }

    if (!input.gstApplicable && input.gstRate !== 0) {
      throw new AppError("GST rate must be 0 when GST is not applicable", 400);
    }

    if (input.gstApplicable && !allowedGstRates.has(input.gstRate)) {
      throw new AppError("GST rate must be one of 0, 0.25, 3, 5, 12, 18, or 28", 400);
    }

    if (bankLinkedModes.has(input.paymentMode) && !input.bankAccountId) {
      throw new AppError("Bank account is required for the selected payment mode", 400);
    }
  }

  private buildExpenseAttachmentDownloadPath(expenseId: string, attachmentId: string) {
    return `/api/v1/expenses/${expenseId}/attachments/${attachmentId}/download`;
  }

  private buildNextSequenceNumber(previousValue: string | null, prefix: string) {
    const match = previousValue?.match(/(\d+)$/);
    const nextNumber = match ? Number(match[1]) + 1 : 1;
    return `${prefix}${String(Number.isFinite(nextNumber) ? nextNumber : 1).padStart(6, "0")}`;
  }

  private toDateOnly(value: Date) {
    return new Date(value.toISOString().slice(0, 10));
  }

  private getResumedRecurringNextRunDate(input: {
    startDate: Date;
    nextRunDate: Date;
    resumeFrom: Date;
  }) {
    const startDate = this.toDateOnly(input.startDate);
    const nextRunDate = this.toDateOnly(input.nextRunDate);
    const resumeFrom = this.toDateOnly(input.resumeFrom);
    const minimumAllowedDate = resumeFrom > startDate ? resumeFrom : startDate;

    return nextRunDate < minimumAllowedDate ? minimumAllowedDate : nextRunDate;
  }

  private isDateWithinRange(target: Date, startDate: Date, endDate: Date) {
    const time = this.toDateOnly(target).getTime();
    return time >= this.toDateOnly(startDate).getTime() && time <= this.toDateOnly(endDate).getTime();
  }

  private normalizeStateCodeFromGst(gstNumber: string | null | undefined) {
    const normalized = gstNumber?.trim().toUpperCase() ?? null;
    if (!normalized || normalized.length < INDIAN_GST_STATE_CODE_LENGTH) {
      return null;
    }

    return normalized.slice(0, INDIAN_GST_STATE_CODE_LENGTH);
  }

  private normalizeStateCodeFromStateName(state: string | null | undefined) {
    const normalized = state?.trim().toUpperCase() ?? null;
    if (!normalized) {
      return null;
    }

    return normalized;
  }

  private resolveIntraState(company: { gstNumber: string | null; state: string | null }, vendorGstNumber: string | null | undefined) {
    const companyStateCode = this.normalizeStateCodeFromGst(company.gstNumber) ?? this.normalizeStateCodeFromStateName(company.state);
    const vendorStateCode = this.normalizeStateCodeFromGst(vendorGstNumber);

    if (!companyStateCode || !vendorStateCode) {
      return true;
    }

    return companyStateCode === vendorStateCode;
  }

  private extractVendorGstNumber(
    input:
      | CreateExpenseInput
      | UpdateExpenseInput
      | Pick<
          CreateRecurringExpenseInput,
          "categoryId" | "expenseAccountId" | "payeeName" | "description" | "amount" | "gstApplicable" | "gstRate" | "priceTaxType" | "paymentMode" | "bankAccountId"
        >
  ) {
    return "vendorGstNumber" in input ? input.vendorGstNumber ?? null : null;
  }

  private normalizeExpenseChequeStatus(
    value: "received" | "issued" | "deposited" | "cleared" | "bounced" | "cancelled" | null | undefined
  ) {
    if (!value || value === "received") {
      return null;
    }

    return value;
  }

  private async assertPeriodUnlocked(companyId: string, expenseDate: Date, executor?: TransactionClient) {
    const periodLock = await accountingRepository.findBlockingPeriodLock(companyId, expenseDate, executor);
    if (periodLock) {
      throw new AppError("The selected period is locked for accounting", 409);
    }

    const years = await accountingRepository.listFinancialYears(companyId, executor);
    const year = years.find((item) => this.isDateWithinRange(expenseDate, item.startDate, item.endDate)) ?? null;
    if (year?.isLocked) {
      throw new AppError("The selected financial year is locked for accounting", 409);
    }
  }

  private async getExpenseAccountOrThrow(companyId: string, accountId: string, executor?: TransactionClient) {
    const account = await accountingRepository.findAccountById(companyId, accountId, executor);
    if (!account) {
      throw new AppError("Expense account not found", 404);
    }

    if (account.accountType !== "expense" || account.status !== "active" || account.deletedAt) {
      throw new AppError("Expense account must be an active expense ledger", 400);
    }

    return account;
  }

  private async getCategoryOrThrow(companyId: string, categoryId: string, executor?: TransactionClient) {
    const category = await expensesRepository.findCategoryById(companyId, categoryId, executor);
    if (!category) {
      throw new AppError("Expense category not found", 404);
    }

    return category;
  }

  private async getExpenseOrThrow(companyId: string, expenseId: string, executor?: TransactionClient) {
    const expense = await expensesRepository.findExpenseById(companyId, expenseId, executor);
    if (!expense) {
      throw new AppError("Expense not found", 404);
    }

    return expense;
  }

  private async getRecurringOrThrow(companyId: string, recurringExpenseId: string, executor?: TransactionClient) {
    const recurring = await expensesRepository.findRecurringExpenseById(companyId, recurringExpenseId, executor);
    if (!recurring) {
      throw new AppError("Recurring expense not found", 404);
    }

    return recurring;
  }

  private async getBankAccountOrThrow(companyId: string, bankAccountId: string) {
    const bankAccount = await companyRepository.findBankAccountById(companyId, bankAccountId);
    if (!bankAccount || !bankAccount.isActive) {
      throw new AppError("Active bank account not found", 404);
    }

    return bankAccount;
  }

  private async validateCategoryParent(companyId: string, categoryId: string | null, parentId: string | null | undefined, executor?: TransactionClient) {
    if (!parentId) {
      return null;
    }

    if (categoryId && categoryId === parentId) {
      throw new AppError("A category cannot be its own parent", 400);
    }

    const parent = await this.getCategoryOrThrow(companyId, parentId, executor);
    if (parent.status !== "active") {
      throw new AppError("Parent category must be active", 400);
    }

    let currentParentId = parent.parentId;
    while (currentParentId) {
      if (currentParentId === categoryId) {
        throw new AppError("Circular expense category hierarchy is not allowed", 400);
      }

      const currentParent = await expensesRepository.findCategoryById(companyId, currentParentId, executor);
      currentParentId = currentParent?.parentId ?? null;
    }

    return parent;
  }

  private async resolveExpenseAccount(
    companyId: string,
    expenseAccountId: string | null | undefined,
    categoryDefaultAccountId: string | null,
    requireResolved: boolean,
    executor?: TransactionClient
  ) {
    const resolvedId = expenseAccountId ?? categoryDefaultAccountId ?? null;

    if (!resolvedId) {
      if (requireResolved) {
        throw new AppError("An active expense account or category default account is required", 400);
      }

      return null;
    }

    return this.getExpenseAccountOrThrow(companyId, resolvedId, executor);
  }

  private async buildExpenseMutationData(
    companyId: string,
    input:
      | CreateExpenseInput
      | UpdateExpenseInput
      | Pick<
          CreateRecurringExpenseInput,
          "categoryId" | "expenseAccountId" | "payeeName" | "description" | "amount" | "gstApplicable" | "gstRate" | "priceTaxType" | "paymentMode" | "bankAccountId"
        >,
    existingCategoryId?: string,
    existingVendorGstNumber?: string | null,
    executor?: TransactionClient
  ) {
    const categoryId = input.categoryId ?? existingCategoryId;
    if (!categoryId) {
      throw new AppError("Expense category is required", 400);
    }

    const category = await this.getCategoryOrThrow(companyId, categoryId, executor);
    if (category.status !== "active") {
      throw new AppError("Only active expense categories can be used", 400);
    }

    const account = await this.resolveExpenseAccount(
      companyId,
      input.expenseAccountId ?? null,
      category.defaultAccountId,
      false,
      executor
    );

    if (input.bankAccountId) {
      await this.getBankAccountOrThrow(companyId, input.bankAccountId);
    }

    const company = await expensesRepository.findCompanyTaxContext(companyId, executor);
    if (!company) {
      throw new AppError("Company not found", 404);
    }

    const intraState = this.resolveIntraState(company, this.extractVendorGstNumber(input) ?? existingVendorGstNumber ?? null);
    const totals = calculateExpenseTotals({
      amount: String(input.amount),
      gstApplicable: input.gstApplicable ?? false,
      gstRate: String(input.gstRate ?? 0),
      priceTaxType: input.priceTaxType ?? "exclusive",
      intraState
    });

    return {
      category,
      account,
      totals
    };
  }

  private mapExpenseAttachment(row: typeof import("../../db/schema").expenseAttachments.$inferSelect) {
    return {
      id: row.id,
      fileName: row.fileName,
      originalName: row.originalName,
      fileUrl: this.buildExpenseAttachmentDownloadPath(row.expenseId, row.id),
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      uploadedBy: row.uploadedBy,
      createdAt: row.createdAt
    };
  }

  private async mapExpenseDetail(companyId: string, expenseId: string) {
    const detail = await expensesRepository.findExpenseDetail(companyId, expenseId);
    if (!detail) {
      throw new AppError("Expense not found", 404);
    }

    const attachments = await expensesRepository.listExpenseAttachments(companyId, expenseId);

    return {
      expense: {
        id: detail.expense.id,
        expenseNumber: detail.expense.expenseNumber,
        expenseDate: detail.expense.expenseDate,
        categoryId: detail.expense.categoryId,
        expenseAccountId: detail.expense.expenseAccountId,
        payeeName: detail.expense.payeeName,
        vendorGstNumber: detail.expense.vendorGstNumber,
        vendorPanNumber: detail.expense.vendorPanNumber,
        hsnSacCode: detail.expense.hsnSacCode,
        description: detail.expense.description,
        amount: normalizeMoney(detail.expense.amount),
        gstApplicable: detail.expense.gstApplicable,
        gstRate: normalizeMoney(detail.expense.gstRate),
        priceTaxType: detail.expense.priceTaxType,
        taxableAmount: normalizeMoney(detail.expense.taxableAmount),
        cgstAmount: normalizeMoney(detail.expense.cgstAmount),
        sgstAmount: normalizeMoney(detail.expense.sgstAmount),
        igstAmount: normalizeMoney(detail.expense.igstAmount),
        gstAmount: normalizeMoney(detail.expense.gstAmount),
        totalAmount: normalizeMoney(detail.expense.totalAmount),
        paymentMode: detail.expense.paymentMode,
        bankAccountId: detail.expense.bankAccountId,
        referenceNumber: detail.expense.referenceNumber,
        chequeNumber: detail.expense.chequeNumber,
        chequeDate: detail.expense.chequeDate,
        chequeStatus: detail.expense.chequeStatus,
        status: detail.expense.status,
        recurringExpenseId: detail.expense.recurringExpenseId,
        accountingEventCreated: detail.expense.accountingEventCreated,
        postedAt: detail.expense.postedAt,
        cancelledAt: detail.expense.cancelledAt,
        cancellationReason: detail.expense.cancellationReason,
        notes: detail.expense.notes,
        createdBy: detail.expense.createdBy,
        updatedBy: detail.expense.updatedBy,
        createdAt: detail.expense.createdAt,
        updatedAt: detail.expense.updatedAt,
        category: {
          id: detail.category.id,
          categoryCode: detail.category.categoryCode,
          name: detail.category.name,
          status: detail.category.status
        },
        account: detail.account
          ? {
              id: detail.account.id,
              accountCode: detail.account.accountCode,
              accountName: detail.account.accountName
            }
          : null,
        bankAccount: detail.bankAccount
          ? {
              id: detail.bankAccount.id,
              bankName: detail.bankAccount.bankName,
              accountNumber: detail.bankAccount.accountNumber,
              upiId: detail.bankAccount.upiId
            }
          : null,
        attachments: attachments.map((row) => this.mapExpenseAttachment(row))
      }
    };
  }

  private async getNextExpenseNumber(companyId: string, executor: TransactionClient) {
    await expensesRepository.acquireScopedLock("expense-number", companyId, executor);
    const latest = await expensesRepository.findLatestExpenseNumber(companyId, executor);
    return this.buildNextSequenceNumber(latest, "EXP-");
  }

  private async getNextCategoryCode(companyId: string, executor: TransactionClient) {
    await expensesRepository.acquireScopedLock("expense-category-code", companyId, executor);
    const latest = await expensesRepository.findLatestCategoryCode(companyId, executor);
    return this.buildNextSequenceNumber(latest, "EXCAT-");
  }

  private async postExpenseAccountingEvent(
    actor: ExpenseActor,
    expense: typeof import("../../db/schema").expenses.$inferSelect,
    executor: TransactionClient
  ) {
    const event = await expensesRepository.createAccountingEvent(
      {
        companyId: actor.companyId,
        eventType: "expense_posted",
        referenceType: "expense",
        referenceId: expense.id,
        payload: {
          expenseNumber: expense.expenseNumber,
          paymentMode: expense.paymentMode,
          totalAmount: normalizeMoney(expense.totalAmount)
        },
        status: "pending"
      },
      executor
    );

    if (!event) {
      throw new AppError("Failed to create accounting event for expense", 500);
    }

    await accountingService.postEventInTransaction(actor, event.id, executor);
    return event;
  }

  private async createExpenseFromSource(
    actor: ExpenseActor,
    input: CreateExpenseInput,
    context: ExpenseRequestContext,
    status: "draft" | "posted",
    executor: TransactionClient,
    recurringExpenseId?: string | null
  ) {
    const mutation = await this.buildExpenseMutationData(actor.companyId, input, undefined, undefined, executor);
    if (status === "posted") {
      await this.assertPeriodUnlocked(actor.companyId, input.expenseDate, executor);
      await this.resolveExpenseAccount(actor.companyId, input.expenseAccountId, mutation.category.defaultAccountId, true, executor);
    }

    const expenseNumber = await this.getNextExpenseNumber(actor.companyId, executor);
    const created = await expensesRepository.createExpense(
      {
        companyId: actor.companyId,
        expenseNumber,
        expenseDate: input.expenseDate,
        categoryId: mutation.category.id,
        expenseAccountId: mutation.account?.id ?? input.expenseAccountId ?? mutation.category.defaultAccountId ?? null,
        payeeName: input.payeeName ?? null,
        vendorGstNumber: input.vendorGstNumber ?? null,
        vendorPanNumber: input.vendorPanNumber ?? null,
        hsnSacCode: input.hsnSacCode ?? null,
        description: input.description.trim(),
        amount: mutation.totals.amount,
        gstApplicable: mutation.totals.gstApplicable,
        gstRate: mutation.totals.gstRate,
        priceTaxType: input.priceTaxType ?? "exclusive",
        taxableAmount: mutation.totals.taxableAmount,
        cgstAmount: mutation.totals.cgstAmount,
        sgstAmount: mutation.totals.sgstAmount,
        igstAmount: mutation.totals.igstAmount,
        gstAmount: mutation.totals.gstAmount,
        totalAmount: mutation.totals.totalAmount,
        paymentMode: input.paymentMode,
        bankAccountId: input.bankAccountId ?? null,
        referenceNumber: input.referenceNumber ?? null,
        chequeNumber: input.chequeNumber ?? null,
        chequeDate: input.chequeDate ?? null,
        chequeStatus: input.chequeStatus ?? (input.paymentMode === "cheque" ? "issued" : null),
        status,
        recurringExpenseId: recurringExpenseId ?? null,
        accountingEventCreated: false,
        postedAt: status === "posted" ? new Date() : null,
        notes: input.notes ?? null,
        createdBy: actor.id,
        updatedBy: actor.id
      },
      executor
    );

    if (!created) {
      throw new AppError("Failed to create expense", 500);
    }

    if (status === "posted") {
      await this.postExpenseAccountingEvent(actor, created, executor);
      const updated = await expensesRepository.updateExpense(
        actor.companyId,
        created.id,
        {
          accountingEventCreated: true,
          updatedBy: actor.id
        },
        executor
      );

      if (!updated) {
        throw new AppError("Failed to update expense accounting state", 500);
      }

      return updated;
    }

    return created;
  }

  public async listExpenses(actor: Pick<ExpenseActor, "companyId">, query: ListExpensesQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await expensesRepository.listExpenses({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      categoryId: query.categoryId,
      paymentMode: query.paymentMode,
      status: query.status,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      gstApplicable: query.gstApplicable,
      recurringExpenseId: query.recurringExpenseId
    });

    return {
      items: result.rows.map((row) => ({
        id: row.expense.id,
        expenseNumber: row.expense.expenseNumber,
        expenseDate: row.expense.expenseDate,
        description: row.expense.description,
        payeeName: row.expense.payeeName,
        paymentMode: row.expense.paymentMode,
        status: row.expense.status,
        amount: normalizeMoney(row.expense.amount),
        gstAmount: normalizeMoney(row.expense.gstAmount),
        totalAmount: normalizeMoney(row.expense.totalAmount),
        category: {
          id: row.expense.categoryId,
          name: row.categoryName,
          categoryCode: row.categoryCode
        },
        account:
          row.accountName && row.accountCode
            ? {
                accountCode: row.accountCode,
                accountName: row.accountName
              }
            : null
      })),
      summary: {
        amount: normalizeMoney(result.summary.amount),
        taxableAmount: normalizeMoney(result.summary.taxableAmount),
        gstAmount: normalizeMoney(result.summary.gstAmount),
        totalAmount: normalizeMoney(result.summary.totalAmount)
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createExpense(
    actor: ExpenseActor,
    input: CreateExpenseInput,
    context: ExpenseRequestContext,
    policy: ExpenseMutationPolicy
  ) {
    if (input.status === "posted" && !policy.canPost) {
      throw new AppError("You do not have permission to create a posted expense", 403);
    }

    const expense = await db.transaction((transaction) =>
      this.createExpenseFromSource(actor, input, context, input.status, transaction)
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_created",
      entityType: "expense",
      entityId: expense.id,
      metadata: {
        expenseNumber: expense.expenseNumber,
        status: expense.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    if (expense.status === "posted") {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "expense_posted",
        entityType: "expense",
        entityId: expense.id,
        metadata: {
          expenseNumber: expense.expenseNumber
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    return this.mapExpenseDetail(actor.companyId, expense.id);
  }

  public async getExpense(actor: Pick<ExpenseActor, "companyId">, expenseId: string) {
    return this.mapExpenseDetail(actor.companyId, expenseId);
  }

  public async updateExpense(
    actor: ExpenseActor,
    expenseId: string,
    input: UpdateExpenseInput,
    context: ExpenseRequestContext
  ) {
    const updated = await db.transaction(async (transaction) => {
      const existing = await this.getExpenseOrThrow(actor.companyId, expenseId, transaction);
      if (existing.status !== "draft") {
        throw new AppError("Only draft expenses can be edited", 400);
      }

      const mutation = await this.buildExpenseMutationData(
        actor.companyId,
        {
          categoryId: input.categoryId ?? existing.categoryId,
          expenseAccountId: input.expenseAccountId ?? existing.expenseAccountId,
          payeeName: input.payeeName ?? existing.payeeName,
          vendorGstNumber: input.vendorGstNumber ?? existing.vendorGstNumber,
          vendorPanNumber: input.vendorPanNumber ?? existing.vendorPanNumber,
          hsnSacCode: input.hsnSacCode ?? existing.hsnSacCode,
          description: input.description ?? existing.description,
          amount: input.amount ?? Number(existing.amount),
          gstApplicable: input.gstApplicable ?? existing.gstApplicable,
          gstRate: input.gstRate ?? Number(existing.gstRate),
          priceTaxType: input.priceTaxType ?? existing.priceTaxType,
          paymentMode: input.paymentMode ?? existing.paymentMode,
          bankAccountId: input.bankAccountId ?? existing.bankAccountId,
          referenceNumber: input.referenceNumber ?? existing.referenceNumber,
          chequeNumber: input.chequeNumber ?? existing.chequeNumber,
          chequeDate: input.chequeDate ?? existing.chequeDate,
          chequeStatus: this.normalizeExpenseChequeStatus(input.chequeStatus ?? existing.chequeStatus),
          notes: input.notes ?? existing.notes
        },
        existing.categoryId,
        existing.vendorGstNumber,
        transaction
      );

      const expenseDate = input.expenseDate ?? existing.expenseDate;
      this.assertExpenseDraftState({
        expenseDate,
        gstApplicable: mutation.totals.gstApplicable,
        gstRate: Number(mutation.totals.gstRate),
        paymentMode: input.paymentMode ?? existing.paymentMode,
        bankAccountId: input.bankAccountId ?? existing.bankAccountId,
        referenceNumber: input.referenceNumber ?? existing.referenceNumber,
        chequeNumber: input.chequeNumber ?? existing.chequeNumber,
        chequeDate: input.chequeDate ?? existing.chequeDate
      });

      const updatedExpense = await expensesRepository.updateExpense(
        actor.companyId,
        expenseId,
        {
          expenseDate,
          categoryId: mutation.category.id,
          expenseAccountId: mutation.account?.id ?? input.expenseAccountId ?? mutation.category.defaultAccountId ?? null,
          payeeName: input.payeeName ?? existing.payeeName,
          vendorGstNumber: input.vendorGstNumber ?? existing.vendorGstNumber,
          vendorPanNumber: input.vendorPanNumber ?? existing.vendorPanNumber,
          hsnSacCode: input.hsnSacCode ?? existing.hsnSacCode,
          description: input.description?.trim() ?? existing.description,
          amount: mutation.totals.amount,
          gstApplicable: mutation.totals.gstApplicable,
          gstRate: mutation.totals.gstRate,
          priceTaxType: input.priceTaxType ?? existing.priceTaxType,
          taxableAmount: mutation.totals.taxableAmount,
          cgstAmount: mutation.totals.cgstAmount,
          sgstAmount: mutation.totals.sgstAmount,
          igstAmount: mutation.totals.igstAmount,
          gstAmount: mutation.totals.gstAmount,
          totalAmount: mutation.totals.totalAmount,
          paymentMode: input.paymentMode ?? existing.paymentMode,
          bankAccountId: input.bankAccountId ?? existing.bankAccountId,
          referenceNumber: input.referenceNumber ?? existing.referenceNumber,
          chequeNumber: input.chequeNumber ?? existing.chequeNumber,
          chequeDate: input.chequeDate ?? existing.chequeDate,
          chequeStatus: this.normalizeExpenseChequeStatus(input.chequeStatus ?? existing.chequeStatus),
          notes: input.notes ?? existing.notes,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updatedExpense) {
        throw new AppError("Failed to update expense", 500);
      }

      return updatedExpense;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_updated",
      entityType: "expense",
      entityId: updated.id,
      metadata: {
        expenseNumber: updated.expenseNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.mapExpenseDetail(actor.companyId, updated.id);
  }

  public async postExpense(actor: ExpenseActor, expenseId: string, context: ExpenseRequestContext) {
    const posted = await db.transaction(async (transaction) => {
      const existing = await this.getExpenseOrThrow(actor.companyId, expenseId, transaction);
      if (existing.status !== "draft") {
        throw new AppError("Only draft expenses can be posted", 400);
      }

      await this.assertPeriodUnlocked(actor.companyId, existing.expenseDate, transaction);
      const category = await this.getCategoryOrThrow(actor.companyId, existing.categoryId, transaction);
      await this.resolveExpenseAccount(actor.companyId, existing.expenseAccountId, category.defaultAccountId, true, transaction);

      const updated = await expensesRepository.updateExpense(
        actor.companyId,
        expenseId,
        {
          status: "posted",
          postedAt: new Date(),
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to post expense", 500);
      }

      await this.postExpenseAccountingEvent(actor, updated, transaction);
      const accountingUpdated = await expensesRepository.updateExpense(
        actor.companyId,
        expenseId,
        {
          accountingEventCreated: true,
          updatedBy: actor.id
        },
        transaction
      );

      if (!accountingUpdated) {
        throw new AppError("Failed to persist expense accounting state", 500);
      }

      return accountingUpdated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_posted",
      entityType: "expense",
      entityId: posted.id,
      metadata: {
        expenseNumber: posted.expenseNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.mapExpenseDetail(actor.companyId, posted.id);
  }

  public async cancelExpense(
    actor: ExpenseActor,
    expenseId: string,
    input: CancelExpenseInput,
    context: ExpenseRequestContext
  ) {
    const cancelled = await db.transaction(async (transaction) => {
      const existing = await this.getExpenseOrThrow(actor.companyId, expenseId, transaction);
      if (existing.status !== "posted") {
        throw new AppError("Only posted expenses can be cancelled", 400);
      }

      await this.assertPeriodUnlocked(actor.companyId, existing.expenseDate, transaction);
      const updated = await expensesRepository.updateExpense(
        actor.companyId,
        expenseId,
        {
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: input.cancellationReason,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to cancel expense", 500);
      }

      const event = await expensesRepository.createAccountingEvent(
        {
          companyId: actor.companyId,
          eventType: "expense_cancelled",
          referenceType: "expense",
          referenceId: existing.id,
          payload: {
            expenseNumber: existing.expenseNumber,
            reason: input.cancellationReason
          },
          status: "pending"
        },
        transaction
      );

      if (!event) {
        throw new AppError("Failed to create reversal accounting event", 500);
      }

      await accountingService.postEventInTransaction(actor, event.id, transaction);
      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_cancelled",
      entityType: "expense",
      entityId: cancelled.id,
      metadata: {
        expenseNumber: cancelled.expenseNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.mapExpenseDetail(actor.companyId, cancelled.id);
  }

  public async deleteExpense(actor: ExpenseActor, expenseId: string, context: ExpenseRequestContext) {
    const deletedAttachmentUrls = await db.transaction(async (transaction) => {
      const existing = await this.getExpenseOrThrow(actor.companyId, expenseId, transaction);
      if (existing.status !== "draft") {
        throw new AppError("Only draft expenses can be deleted", 400);
      }

      const attachments = await expensesRepository.listExpenseAttachments(actor.companyId, expenseId, transaction);
      await expensesRepository.softDeleteAttachmentsByExpense(actor.companyId, expenseId, transaction);
      const deleted = await expensesRepository.softDeleteExpense(actor.companyId, expenseId, actor.id, transaction);
      if (!deleted) {
        throw new AppError("Failed to delete expense", 500);
      }

      return attachments.map((attachment) => attachment.fileUrl);
    });

    await Promise.all(deletedAttachmentUrls.map((fileUrl) => deleteUploadFileByUrl(fileUrl)));

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_deleted",
      entityType: "expense",
      entityId: expenseId,
      metadata: {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async exportExpenses(
    actor: ExpenseActor,
    query: ExportExpensesQuery,
    context: ExpenseRequestContext
  ): Promise<ExpenseExportPayload> {
    const rows = await expensesRepository.listExpensesForExport({
      companyId: actor.companyId,
      search: query.search ?? null,
      categoryId: query.categoryId,
      paymentMode: query.paymentMode,
      status: query.status,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      gstApplicable: query.gstApplicable,
      recurringExpenseId: query.recurringExpenseId
    });

    const dataset: ReportExportDataset = {
      title: "Expenses",
      columns: [
        { key: "expenseNumber", label: "Expense No" },
        { key: "expenseDate", label: "Date" },
        { key: "categoryName", label: "Category" },
        { key: "description", label: "Description" },
        { key: "payeeName", label: "Payee" },
        { key: "paymentMode", label: "Payment Mode" },
        { key: "gstAmount", label: "GST", type: "number" },
        { key: "totalAmount", label: "Total", type: "number" },
        { key: "status", label: "Status" },
        { key: "referenceNumber", label: "Reference" }
      ],
      rows: rows.map((row) => ({
        expenseNumber: row.expense.expenseNumber,
        expenseDate: row.expense.expenseDate.toISOString().slice(0, 10),
        categoryName: row.categoryName,
        description: row.expense.description,
        payeeName: row.expense.payeeName ?? "",
        paymentMode: row.expense.paymentMode,
        gstAmount: normalizeMoney(row.expense.gstAmount),
        totalAmount: normalizeMoney(row.expense.totalAmount),
        status: row.expense.status,
        referenceNumber: row.expense.referenceNumber ?? ""
      }))
    };
    const file = buildReportFile(dataset, query.format, `expenses-${new Date().toISOString().slice(0, 10)}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_exported",
      entityType: "expense",
      metadata: {
        format: query.format,
        rowCount: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }

  public async listCategories(actor: Pick<ExpenseActor, "companyId">, query: ListExpenseCategoriesQuery) {
    const rows = await expensesRepository.listCategories({
      companyId: actor.companyId,
      search: query.search ?? null,
      status: query.status,
      parentId: query.parentId
    });

    const accountIds = Array.from(new Set(rows.map((row) => row.defaultAccountId).filter((value): value is string => Boolean(value))));
    const accounts = accountIds.length > 0 ? await accountingRepository.findAccountsByIds(actor.companyId, accountIds) : [];
    const accountMap = new Map(accounts.map((account) => [account.id, account]));

    return {
      items: rows.map((row) => ({
        id: row.id,
        categoryCode: row.categoryCode,
        name: row.name,
        parentId: row.parentId,
        defaultAccountId: row.defaultAccountId,
        color: row.color,
        icon: row.icon,
        description: row.description,
        status: row.status,
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        defaultAccount: row.defaultAccountId
          ? (() => {
              const account = accountMap.get(row.defaultAccountId);
              return account
                ? {
                    id: account.id,
                    accountCode: account.accountCode,
                    accountName: account.accountName
                  }
                : null;
            })()
          : null
      }))
    };
  }

  public async createCategory(actor: ExpenseActor, input: CreateExpenseCategoryInput, context: ExpenseRequestContext) {
    const category = await db.transaction(async (transaction) => {
      const existing = await expensesRepository.findCategoryByName(actor.companyId, input.name.trim(), undefined, transaction);
      if (existing) {
        throw new AppError("An expense category with this name already exists", 409);
      }

      await this.validateCategoryParent(actor.companyId, null, input.parentId ?? null, transaction);
      if (input.defaultAccountId) {
        await this.getExpenseAccountOrThrow(actor.companyId, input.defaultAccountId, transaction);
      }

      const categoryCode = await this.getNextCategoryCode(actor.companyId, transaction);
      const created = await expensesRepository.createCategory(
        {
          companyId: actor.companyId,
          categoryCode,
          name: input.name.trim(),
          parentId: input.parentId ?? null,
          defaultAccountId: input.defaultAccountId ?? null,
          color: input.color ?? null,
          icon: input.icon ?? null,
          description: input.description ?? null,
          status: input.status ?? "active",
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!created) {
        throw new AppError("Failed to create expense category", 500);
      }

      return created;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_category_created",
      entityType: "expense_category",
      entityId: category.id,
      metadata: {
        categoryCode: category.categoryCode
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      category
    };
  }

  public async updateCategory(
    actor: ExpenseActor,
    categoryId: string,
    input: UpdateExpenseCategoryInput,
    context: ExpenseRequestContext
  ) {
    const category = await db.transaction(async (transaction) => {
      const existing = await this.getCategoryOrThrow(actor.companyId, categoryId, transaction);
      if (input.name && input.name.trim() !== existing.name) {
        const duplicate = await expensesRepository.findCategoryByName(actor.companyId, input.name.trim(), categoryId, transaction);
        if (duplicate) {
          throw new AppError("An expense category with this name already exists", 409);
        }
      }

      await this.validateCategoryParent(actor.companyId, categoryId, input.parentId ?? existing.parentId, transaction);
      if (input.defaultAccountId) {
        await this.getExpenseAccountOrThrow(actor.companyId, input.defaultAccountId, transaction);
      }

      const updated = await expensesRepository.updateCategory(
        actor.companyId,
        categoryId,
        {
          name: input.name?.trim() ?? existing.name,
          parentId: input.parentId ?? existing.parentId,
          defaultAccountId: input.defaultAccountId ?? existing.defaultAccountId,
          color: input.color ?? existing.color,
          icon: input.icon ?? existing.icon,
          description: input.description ?? existing.description,
          status: input.status ?? existing.status,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update expense category", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_category_updated",
      entityType: "expense_category",
      entityId: category.id,
      metadata: {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      category
    };
  }

  public async deleteCategory(actor: ExpenseActor, categoryId: string, context: ExpenseRequestContext) {
    await db.transaction(async (transaction) => {
      await this.getCategoryOrThrow(actor.companyId, categoryId, transaction);
      const [expenseCount, recurringCount] = await Promise.all([
        expensesRepository.countExpensesByCategory(actor.companyId, categoryId, transaction),
        expensesRepository.countRecurringByCategory(actor.companyId, categoryId, transaction)
      ]);

      if (expenseCount > 0 || recurringCount > 0) {
        throw new AppError("This expense category is already in use and cannot be deleted", 409);
      }

      const deleted = await expensesRepository.updateCategory(
        actor.companyId,
        categoryId,
        {
          status: "deleted",
          deletedAt: new Date(),
          updatedBy: actor.id
        },
        transaction
      );

      if (!deleted) {
        throw new AppError("Failed to delete expense category", 500);
      }
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_category_deleted",
      entityType: "expense_category",
      entityId: categoryId,
      metadata: {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async uploadAttachments(
    actor: ExpenseActor,
    expenseId: string,
    files: Express.Multer.File[],
    context: ExpenseRequestContext
  ) {
    if (files.length === 0) {
      throw new AppError("At least one attachment is required", 400);
    }

    const created = await db.transaction(async (transaction) => {
      const expense = await this.getExpenseOrThrow(actor.companyId, expenseId, transaction);
      const existingCount = await expensesRepository.countActiveAttachments(actor.companyId, expenseId, transaction);
      if (existingCount + files.length > env.EXPENSE_MAX_ATTACHMENTS) {
        throw new AppError("Maximum attachment limit reached for this expense", 400);
      }

      void expense;
      const rows = await expensesRepository.createExpenseAttachments(
        files.map((file) => {
          const relativePath = path.posix.join(getExpenseUploadRelativeDirectory(actor.companyId, expenseId), file.filename);

          return {
            companyId: actor.companyId,
            expenseId,
            fileName: file.filename,
            originalName: file.originalname,
            fileUrl: buildPrivateUploadReference(relativePath),
            mimeType: file.mimetype,
            sizeBytes: file.size,
            uploadedBy: actor.id
          };
        }),
        transaction
      );

      return rows;
    }).catch(async (error) => {
      await Promise.all(
        files.map((file) =>
          deleteUploadFileByUrl(buildPrivateUploadReference(path.posix.join(getExpenseUploadRelativeDirectory(actor.companyId, expenseId), file.filename)))
        )
      );
      throw error;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_receipt_uploaded",
      entityType: "expense",
      entityId: expenseId,
      metadata: {
        count: created.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      attachments: created.map((row) => this.mapExpenseAttachment(row))
    };
  }

  public async deleteAttachment(
    actor: ExpenseActor,
    expenseId: string,
    attachmentId: string,
    context: ExpenseRequestContext
  ) {
    const deletedFileUrl = await db.transaction(async (transaction) => {
      const expense = await this.getExpenseOrThrow(actor.companyId, expenseId, transaction);
      if (expense.status === "posted" && actor.role !== "admin") {
        throw new AppError("Posted expense receipts can only be removed by an admin", 403);
      }

      const attachment = await expensesRepository.findAttachmentById(actor.companyId, attachmentId, transaction);
      if (!attachment || attachment.expenseId !== expenseId) {
        throw new AppError("Expense attachment not found", 404);
      }

      const deleted = await expensesRepository.softDeleteAttachment(actor.companyId, attachmentId, transaction);
      if (!deleted) {
        throw new AppError("Failed to delete expense attachment", 500);
      }

      return attachment.fileUrl;
    });

    await deleteUploadFileByUrl(deletedFileUrl);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "expense_receipt_deleted",
      entityType: "expense",
      entityId: expenseId,
      metadata: {
        attachmentId
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async downloadAttachment(actor: Pick<ExpenseActor, "companyId">, expenseId: string, attachmentId: string) {
    const attachment = await expensesRepository.findAttachmentById(actor.companyId, attachmentId);
    if (!attachment || attachment.expenseId !== expenseId) {
      throw new AppError("Expense attachment not found", 404);
    }

    const absolutePath = resolveStoredUploadPath(attachment.fileUrl);
    if (!absolutePath) {
      throw new AppError("Expense attachment path is invalid", 400);
    }

    let content: Buffer;
    try {
      content = await fs.readFile(absolutePath);
    } catch {
      throw new AppError("Expense attachment could not be read", 404);
    }

    return {
      fileName: attachment.originalName,
      contentType: attachment.mimeType || getContentTypeFromFileName(absolutePath),
      content
    };
  }

  public async listRecurring(actor: Pick<ExpenseActor, "companyId">, query: ListRecurringExpensesQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await expensesRepository.listRecurringExpenses({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      status: query.status,
      frequency: query.frequency,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null
    });

    return {
      items: result.rows.map((row) => ({
        id: row.recurring.id,
        templateName: row.recurring.templateName,
        categoryId: row.recurring.categoryId,
        expenseAccountId: row.recurring.expenseAccountId,
        payeeName: row.recurring.payeeName,
        description: row.recurring.description,
        amount: normalizeMoney(row.recurring.amount),
        gstApplicable: row.recurring.gstApplicable,
        gstRate: normalizeMoney(row.recurring.gstRate),
        priceTaxType: row.recurring.priceTaxType,
        paymentMode: row.recurring.paymentMode,
        bankAccountId: row.recurring.bankAccountId,
        frequency: row.recurring.frequency,
        startDate: row.recurring.startDate,
        endDate: row.recurring.endDate,
        nextRunDate: row.recurring.nextRunDate,
        autoCreateEnabled: row.recurring.autoCreateEnabled,
        createAsStatus: row.recurring.createAsStatus,
        reminderDaysBefore: row.recurring.reminderDaysBefore,
        lastRunAt: row.recurring.lastRunAt,
        status: row.recurring.status,
        categoryName: row.categoryName,
        accountName: row.accountName
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createRecurring(actor: ExpenseActor, input: CreateRecurringExpenseInput, context: ExpenseRequestContext) {
    const recurring = await db.transaction(async (transaction) => {
      const category = await this.getCategoryOrThrow(actor.companyId, input.categoryId, transaction);
      if (category.status !== "active") {
        throw new AppError("Only active expense categories can be used", 400);
      }

      this.assertRecurringTemplateState({
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        nextRunDate: input.nextRunDate,
        gstApplicable: input.gstApplicable ?? false,
        gstRate: input.gstRate ?? 0,
        paymentMode: input.paymentMode,
        bankAccountId: input.bankAccountId ?? null
      });

      await this.resolveExpenseAccount(
        actor.companyId,
        input.expenseAccountId ?? null,
        category.defaultAccountId,
        true,
        transaction
      );
      if (input.bankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, input.bankAccountId);
      }

      const created = await expensesRepository.createRecurringExpense(
        {
          companyId: actor.companyId,
          templateName: input.templateName.trim(),
          categoryId: input.categoryId,
          expenseAccountId: input.expenseAccountId ?? null,
          payeeName: input.payeeName ?? null,
          description: input.description.trim(),
          amount: normalizeMoney(input.amount),
          gstApplicable: input.gstApplicable ?? false,
          gstRate: normalizeMoney(input.gstRate ?? 0),
          priceTaxType: input.priceTaxType ?? "exclusive",
          paymentMode: input.paymentMode,
          bankAccountId: input.bankAccountId ?? null,
          frequency: input.frequency,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          nextRunDate: input.nextRunDate,
          autoCreateEnabled: input.autoCreateEnabled ?? true,
          createAsStatus: "posted",
          reminderDaysBefore: input.reminderDaysBefore ?? 0,
          status: input.status ?? "active",
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!created) {
        throw new AppError("Failed to create recurring expense", 500);
      }

      return created;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "recurring_expense_created",
      entityType: "recurring_expense",
      entityId: recurring.id,
      metadata: {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      recurringExpense: recurring
    };
  }

  public async updateRecurring(
    actor: ExpenseActor,
    recurringExpenseId: string,
    input: UpdateRecurringExpenseInput,
    context: ExpenseRequestContext
  ) {
    const recurring = await db.transaction(async (transaction) => {
      const existing = await this.getRecurringOrThrow(actor.companyId, recurringExpenseId, transaction);
      const categoryId = input.categoryId ?? existing.categoryId;
      const category = await this.getCategoryOrThrow(actor.companyId, categoryId, transaction);
      if (category.status !== "active") {
        throw new AppError("Only active expense categories can be used", 400);
      }

      const nextStartDate = input.startDate ?? existing.startDate;
      const nextEndDate = input.endDate ?? existing.endDate;
      const nextGstApplicable = input.gstApplicable ?? existing.gstApplicable;
      const nextGstRate = input.gstRate ?? Number(existing.gstRate);
      const nextPaymentMode = input.paymentMode ?? existing.paymentMode;
      const nextBankAccountId = input.bankAccountId ?? existing.bankAccountId;
      const nextCreateAsStatus = "posted";
      const requestedStatus = input.status ?? existing.status;
      const isResumingRecurring = existing.status === "paused" && requestedStatus === "active";
      const nextRunDate = isResumingRecurring
        ? this.getResumedRecurringNextRunDate({
            startDate: input.startDate ?? existing.startDate,
            nextRunDate: input.nextRunDate ?? existing.nextRunDate,
            resumeFrom: new Date(),
          })
        : input.nextRunDate ?? existing.nextRunDate;

      this.assertRecurringTemplateState({
        startDate: nextStartDate,
        endDate: nextEndDate,
        nextRunDate,
        gstApplicable: nextGstApplicable,
        gstRate: nextGstRate,
        paymentMode: nextPaymentMode,
        bankAccountId: nextBankAccountId
      });

      await this.resolveExpenseAccount(
        actor.companyId,
        input.expenseAccountId ?? existing.expenseAccountId,
        category.defaultAccountId,
        true,
        transaction
      );
      if (nextBankAccountId) {
        await this.getBankAccountOrThrow(actor.companyId, nextBankAccountId);
      }

      const updated = await expensesRepository.updateRecurringExpense(
        actor.companyId,
        recurringExpenseId,
        {
          templateName: input.templateName?.trim() ?? existing.templateName,
          categoryId,
          expenseAccountId: input.expenseAccountId ?? existing.expenseAccountId,
          payeeName: input.payeeName ?? existing.payeeName,
          description: input.description?.trim() ?? existing.description,
          amount: input.amount !== undefined ? normalizeMoney(input.amount) : existing.amount,
          gstApplicable: nextGstApplicable,
          gstRate: input.gstRate !== undefined ? normalizeMoney(input.gstRate) : existing.gstRate,
          priceTaxType: input.priceTaxType ?? existing.priceTaxType,
          paymentMode: nextPaymentMode,
          bankAccountId: nextBankAccountId,
          frequency: input.frequency ?? existing.frequency,
          startDate: nextStartDate,
          endDate: nextEndDate,
          nextRunDate,
          autoCreateEnabled: input.autoCreateEnabled ?? existing.autoCreateEnabled,
          createAsStatus: nextCreateAsStatus,
          reminderDaysBefore: input.reminderDaysBefore ?? existing.reminderDaysBefore,
          status: requestedStatus,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update recurring expense", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "recurring_expense_updated",
      entityType: "recurring_expense",
      entityId: recurring.id,
      metadata: {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      recurringExpense: recurring
    };
  }

  public async runRecurring(actor: ExpenseActor, recurringExpenseId: string, context: ExpenseRequestContext) {
    const result = await db.transaction(async (transaction) => {
      const recurring = await this.getRecurringOrThrow(actor.companyId, recurringExpenseId, transaction);
      if (recurring.status === "paused") {
        throw new AppError("Paused recurring expense must be activated before running", 400);
      }

      if (recurring.status === "cancelled" || recurring.status === "completed") {
        throw new AppError("This recurring expense can no longer be executed", 400);
      }

      await expensesRepository.acquireScopedLock(`recurring-expense-run:${recurringExpenseId}`, actor.companyId, transaction);

      const createStatus = "posted";
      const expense = await this.createExpenseFromSource(
        actor,
        {
          expenseDate: recurring.nextRunDate,
          categoryId: recurring.categoryId,
          expenseAccountId: recurring.expenseAccountId,
          payeeName: recurring.payeeName,
          vendorGstNumber: null,
          vendorPanNumber: null,
          hsnSacCode: null,
          description: recurring.description,
          amount: Number(recurring.amount),
          gstApplicable: recurring.gstApplicable,
          gstRate: Number(recurring.gstRate),
          priceTaxType: recurring.priceTaxType,
          paymentMode: recurring.paymentMode,
          bankAccountId: recurring.bankAccountId,
          referenceNumber: null,
          chequeNumber: null,
          chequeDate: null,
          chequeStatus: recurring.paymentMode === "cheque" ? "issued" : null,
          notes: null,
          status: createStatus
        },
        context,
        createStatus,
        transaction,
        recurring.id
      );

      const nextRunDate = calculateNextRunDate(recurring.nextRunDate, recurring.frequency);
      const isCompleted = recurring.endDate !== null && nextRunDate > recurring.endDate;
      const updatedRecurring = await expensesRepository.updateRecurringExpense(
        actor.companyId,
        recurring.id,
        {
          nextRunDate,
          lastRunAt: new Date(),
          status: isCompleted ? "completed" : recurring.status,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updatedRecurring) {
        throw new AppError("Failed to update recurring expense after execution", 500);
      }

      return {
        expense,
        recurringExpense: updatedRecurring
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "recurring_expense_executed",
      entityType: "recurring_expense",
      entityId: recurringExpenseId,
      metadata: {
        expenseId: result.expense.id
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      recurringExpense: result.recurringExpense,
      expense: await this.mapExpenseDetail(actor.companyId, result.expense.id)
    };
  }

  public async runDueRecurring(actor: ExpenseActor, context: ExpenseRequestContext) {
    const dueItems = await expensesRepository.listDueRecurringExpenses(actor.companyId, new Date());
    const results: Array<{ recurringExpenseId: string; expenseId: string }> = [];

    for (const recurring of dueItems) {
      try {
        const executed = await this.runRecurring(actor, recurring.id, context);
        results.push({
          recurringExpenseId: recurring.id,
          expenseId: (executed.expense as { expense: { id: string } }).expense.id
        });
      } catch (error) {
        if (
          error instanceof AppError &&
          (error.message === "Paused recurring expense must be activated before running" ||
            error.message === "This recurring expense can no longer be executed")
        ) {
          continue;
        }

        throw error;
      }
    }

    return {
      total: results.length,
      executed: results
    };
  }

  public async getCategoryWiseReport(actor: Pick<ExpenseActor, "companyId">, query: ExpenseReportQuery) {
    const rows = await expensesRepository.getCategoryWiseReport({
      companyId: actor.companyId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      categoryId: query.categoryId,
      paymentMode: query.paymentMode,
      includeDrafts: query.includeDrafts
    });

    return {
      items: rows.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        expenseCount: row.expenseCount,
        taxableAmount: normalizeMoneyValue(row.taxableAmount),
        gstAmount: normalizeMoneyValue(row.gstAmount),
        totalAmount: normalizeMoneyValue(row.totalAmount)
      }))
    };
  }

  public async getMonthlyReport(actor: Pick<ExpenseActor, "companyId">, query: ExpenseReportQuery) {
    const rows = await expensesRepository.getMonthlyReport({
      companyId: actor.companyId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      categoryId: query.categoryId,
      paymentMode: query.paymentMode,
      includeDrafts: query.includeDrafts
    });

    return {
      items: rows.map((row) => ({
        month: row.month,
        expenseCount: row.expenseCount,
        taxableAmount: normalizeMoneyValue(row.taxableAmount),
        gstAmount: normalizeMoneyValue(row.gstAmount),
        totalAmount: normalizeMoneyValue(row.totalAmount)
      }))
    };
  }

  public async getPaymentModeReport(actor: Pick<ExpenseActor, "companyId">, query: ExpenseReportQuery) {
    const rows = await expensesRepository.getPaymentModeReport({
      companyId: actor.companyId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      categoryId: query.categoryId,
      paymentMode: query.paymentMode,
      includeDrafts: query.includeDrafts
    });

    return {
      items: rows.map((row) => ({
        paymentMode: row.paymentMode,
        expenseCount: row.expenseCount,
        totalAmount: normalizeMoneyValue(row.totalAmount)
      }))
    };
  }

  public async getGstReport(actor: Pick<ExpenseActor, "companyId">, query: ExpenseReportQuery) {
    const rows = await expensesRepository.getGstReport({
      companyId: actor.companyId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      categoryId: query.categoryId,
      paymentMode: query.paymentMode,
      includeDrafts: query.includeDrafts
    });

    return {
      items: rows.map((row) => ({
        gstApplicable: row.gstApplicable,
        gstRate: normalizeMoneyValue(row.gstRate),
        expenseCount: row.expenseCount,
        taxableAmount: normalizeMoneyValue(row.taxableAmount),
        cgstAmount: normalizeMoneyValue(row.cgstAmount),
        sgstAmount: normalizeMoneyValue(row.sgstAmount),
        igstAmount: normalizeMoneyValue(row.igstAmount),
        gstAmount: normalizeMoneyValue(row.gstAmount),
        totalAmount: normalizeMoneyValue(row.totalAmount)
      }))
    };
  }
}

export const expensesService = new ExpensesService();
