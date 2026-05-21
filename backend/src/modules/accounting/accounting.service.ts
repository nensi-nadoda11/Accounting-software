import { auditLogService } from "../audit-logs/audit-log.service";
import { companyRepository } from "../company/company.repository";
import { customersRepository } from "../customers/customers.repository";
import { db } from "../../db";
import { buildCsvBuffer, compareDecimals, decimalToScaledBigInt, scaledBigIntToDecimal } from "../inventory/inventory.utils";
import { suppliersRepository } from "../suppliers/suppliers.repository";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import {
  applyBalanceDelta,
  assertBalanced,
  calculateAccountBalanceByNormalSide,
  calculateBalanceSheet,
  calculateProfitLoss,
  calculateRunningBalance,
  calculateTrialBalance,
  normalizeMoney,
  splitBalanceBySide,
  sumCredits,
  sumDebits
} from "./accounting.calculation";
import { DEFAULT_SYSTEM_ACCOUNTS } from "./accounting.default-accounts";
import { accountingRepository } from "./accounting.repository";
import type {
  AccountingActor,
  AccountingRequestContext,
  JournalPartyType,
  JournalVoucherType,
  SystemAccountKey
} from "./accounting.types";
import { DEFAULT_NORMAL_BALANCE_BY_ACCOUNT_TYPE, JOURNAL_PREFIX_BY_VOUCHER } from "./accounting.types";
import type {
  BalanceSheetQuery,
  BookQuery,
  CancelOrReverseJournalInput,
  CreateAccountInput,
  CreateFinancialPeriodLockInput,
  CreateJournalInput,
  CreateOpeningBalancesInput,
  ExportBalanceSheetQuery,
  ExportLedgerQuery,
  ExportProfitLossQuery,
  ExportTrialBalanceQuery,
  LedgerQuery,
  ListAccountsQuery,
  ListAccountingEventsQuery,
  ListFinancialPeriodLocksQuery,
  ListJournalsQuery,
  ListOpeningBalancesQuery,
  LockOpeningBalancesInput,
  PostJournalInput,
  PostPendingAccountingEventsInput,
  ProfitLossQuery,
  TrialBalanceQuery,
  UpdateAccountInput,
  UpdateJournalInput,
  UpdateOpeningBalanceInput
} from "./accounting.validator";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

type JournalLineInput = {
  accountId: string;
  description?: string | null;
  debit: string;
  credit: string;
  partyType?: JournalPartyType | null;
  partyId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
};

type ExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

type MappedEventResult =
  | {
      kind: "journal";
      entryDate: Date;
      voucherType: JournalVoucherType;
      financialYearId?: string | null;
      referenceType: string;
      referenceId: string;
      referenceNumber: string | null;
      description: string;
      lines: JournalLineInput[];
    }
  | {
      kind: "reversal";
      sourceJournalId: string;
      reason: string;
      entryDate: Date | null;
    }
  | {
      kind: "ignored";
      message: string;
    };

type DateRange = {
  dateFrom: Date;
  dateTo: Date;
  financialYearId?: string | null;
};

const addMoney = (left: string, right: string) =>
  scaledBigIntToDecimal(decimalToScaledBigInt(left, 2) + decimalToScaledBigInt(right, 2), 2);

const subtractMoney = (left: string, right: string) =>
  scaledBigIntToDecimal(decimalToScaledBigInt(left, 2) - decimalToScaledBigInt(right, 2), 2);

class AccountingService {
  private toDate(value: Date | string | null | undefined, fieldName: string): Date {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    throw new AppError(`${fieldName} is invalid`, 400);
  }

  private normalizePrefix(prefix: string) {
    return prefix.replace(/-+$/, "");
  }

  private buildNextSequenceNumber(previousValue: string | null, prefix: string, padding = 6) {
    const match = previousValue?.match(/(\d+)$/);
    const nextNumber = match ? Number(match[1]) + 1 : 1;
    return `${this.normalizePrefix(prefix)}-${String(Number.isFinite(nextNumber) ? nextNumber : 1).padStart(padding, "0")}`;
  }

  private ensureCsvFormat(format: "csv" | "xlsx" | "pdf") {
    if (format !== "csv") {
      throw new AppError("Only CSV export is available right now", 400);
    }
  }

  private toDateOnly(value: Date) {
    return new Date(value.toISOString().slice(0, 10));
  }

  private previousDate(value: Date) {
    const date = new Date(value);
    date.setUTCDate(date.getUTCDate() - 1);
    return date;
  }

  private isDateWithinRange(target: Date, startDate: Date, endDate: Date) {
    const time = this.toDateOnly(target).getTime();
    return time >= this.toDateOnly(startDate).getTime() && time <= this.toDateOnly(endDate).getTime();
  }

  private async getFinancialYearForDate(companyId: string, targetDate: Date, executor?: TransactionClient) {
    const years = await accountingRepository.listFinancialYears(companyId, executor);
    const matchingYears = years.filter((year) => this.isDateWithinRange(targetDate, year.startDate, year.endDate));

    if (matchingYears.length > 1) {
      throw new AppError("Multiple financial years overlap the selected date. Fix financial year setup first", 409);
    }

    return matchingYears[0] ?? null;
  }

  private async resolveFinancialYear(companyId: string, entryDate: Date, financialYearId?: string | null, executor?: TransactionClient) {
    if (financialYearId) {
      const year = await accountingRepository.findFinancialYearById(companyId, financialYearId, executor);
      if (!year) {
        throw new AppError("Financial year not found", 404);
      }

      if (!this.isDateWithinRange(entryDate, year.startDate, year.endDate)) {
        throw new AppError("Entry date must be inside the selected financial year", 400);
      }

      return year;
    }

    return this.getFinancialYearForDate(companyId, entryDate, executor);
  }

  private async assertPeriodUnlocked(companyId: string, entryDate: Date, financialYearId?: string | null, executor?: TransactionClient) {
    const periodLock = await accountingRepository.findBlockingPeriodLock(companyId, entryDate, executor);
    if (periodLock) {
      throw new AppError("The selected period is locked for accounting", 409);
    }

    const financialYear = await this.resolveFinancialYear(companyId, entryDate, financialYearId, executor);
    if (financialYear?.isLocked) {
      throw new AppError("The selected financial year is locked for accounting", 409);
    }

    return financialYear;
  }

  private async assertPartyExists(companyId: string, partyType: JournalPartyType | null | undefined, partyId: string | null | undefined, executor?: TransactionClient) {
    if (!partyType && !partyId) {
      return;
    }

    if (!partyType || !partyId) {
      throw new AppError("partyType and partyId must be provided together", 400);
    }

    if (partyType === "customer") {
      const customer = await customersRepository.findById(companyId, partyId, false, executor);
      if (!customer) {
        throw new AppError("Customer not found", 404);
      }

      return;
    }

    const supplier = await suppliersRepository.findById(companyId, partyId, false, executor);
    if (!supplier) {
      throw new AppError("Supplier not found", 404);
    }
  }

  private mapAccount(row: Awaited<ReturnType<typeof accountingRepository.findAccountById>> extends infer T ? NonNullable<T> : never) {
    const currentBalance = splitBalanceBySide(row.currentBalance, row.normalBalance);
    return {
      id: row.id,
      companyId: row.companyId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      accountSubtype: row.accountSubtype,
      parentId: row.parentId,
      isSystem: row.isSystem,
      systemKey: row.systemKey,
      normalBalance: row.normalBalance,
      openingBalance: normalizeMoney(row.openingBalance),
      openingBalanceType: row.openingBalanceType,
      currentBalance: normalizeMoney(currentBalance.amount),
      currentBalanceSide: currentBalance.side,
      status: row.status,
      description: row.description,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt
    };
  }

  private buildHierarchy(items: ReturnType<AccountingService["mapAccount"]>[]) {
    const byId = new Map(items.map((item) => [item.id, { ...item, children: [] as Array<Record<string, unknown>> }]));
    const roots: Array<Record<string, unknown>> = [];

    for (const item of byId.values()) {
      if (item.parentId && byId.has(item.parentId)) {
        const parent = byId.get(item.parentId)!;
        (parent.children as Array<Record<string, unknown>>).push(item);
      } else {
        roots.push(item);
      }
    }

    return roots;
  }

  private async getNextAccountCode(companyId: string, accountType: CreateAccountInput["accountType"], executor: TransactionClient) {
    const prefixMap: Record<CreateAccountInput["accountType"], string> = {
      asset: "AST-",
      liability: "LIA-",
      equity: "EQT-",
      income: "INC-",
      expense: "EXP-"
    };

    const prefix = prefixMap[accountType];
    await accountingRepository.acquireScopedLock(`chart-code:${accountType}`, companyId, executor);
    const codes = await accountingRepository.listAccountCodesByPrefix(companyId, prefix, executor);
    const nextNumber =
      codes.reduce((max, code) => {
        const match = code.match(/(\d+)$/);
        return Math.max(max, match ? Number(match[1]) : 0);
      }, 0) + 1;

    return `${prefix}${String(nextNumber).padStart(4, "0")}`;
  }

  private async validateAccountParent(companyId: string, accountType: CreateAccountInput["accountType"], parentId?: string | null, executor?: TransactionClient) {
    if (!parentId) {
      return null;
    }

    const parent = await accountingRepository.findAccountById(companyId, parentId, executor);
    if (!parent) {
      throw new AppError("Parent account not found", 404);
    }

    if (parent.accountType !== accountType) {
      throw new AppError("Parent account must belong to the same account type", 400);
    }

    return parent;
  }

  private async assertNoCircularParent(companyId: string, accountId: string, parentId: string | null | undefined, executor?: TransactionClient) {
    if (!parentId) {
      return;
    }

    let currentParentId: string | null | undefined = parentId;
    while (currentParentId) {
      if (currentParentId === accountId) {
        throw new AppError("Circular account parent hierarchy is not allowed", 400);
      }

      const currentParent = await accountingRepository.findAccountById(companyId, currentParentId, executor);
      currentParentId = currentParent?.parentId ?? null;
    }
  }

  private normalizeJournalLines(lines: CreateJournalInput["lines"] | NonNullable<UpdateJournalInput["lines"]>) {
    return lines.map<JournalLineInput>((line) => ({
      accountId: line.accountId,
      description: line.description ?? null,
      debit: normalizeMoney(line.debit ?? 0),
      credit: normalizeMoney(line.credit ?? 0),
      partyType: line.partyType ?? null,
      partyId: line.partyId ?? null,
      referenceType: line.referenceType ?? null,
      referenceId: line.referenceId ?? null
    }));
  }

  private async validateJournalLines(companyId: string, lines: JournalLineInput[], executor?: TransactionClient) {
    const accountIds = Array.from(new Set(lines.map((line) => line.accountId)));
    const accounts = await accountingRepository.findAccountsByIds(companyId, accountIds, executor);
    const accountMap = new Map(accounts.map((account) => [account.id, account]));

    if (accounts.length !== accountIds.length) {
      throw new AppError("One or more journal accounts were not found", 404);
    }

    for (const line of lines) {
      const account = accountMap.get(line.accountId);
      if (!account) {
        throw new AppError("Journal account not found", 404);
      }

      if (account.status !== "active" || account.deletedAt) {
        throw new AppError(`Account ${account.accountCode} is not active`, 400);
      }

      await this.assertPartyExists(companyId, line.partyType ?? null, line.partyId ?? null, executor);
    }

    return accountMap;
  }

  private async getNextJournalNumber(companyId: string, voucherType: JournalVoucherType, executor: TransactionClient) {
    const prefix = JOURNAL_PREFIX_BY_VOUCHER[voucherType];
    await accountingRepository.acquireScopedLock(`journal-number:${voucherType}`, companyId, executor);
    const latest = await accountingRepository.findLatestJournalNumberByPrefix(companyId, prefix, executor);
    return this.buildNextSequenceNumber(latest, prefix, 6);
  }

  private mapJournalEntry(
    journal: NonNullable<Awaited<ReturnType<typeof accountingRepository.findJournalById>>>,
    lines: Awaited<ReturnType<typeof accountingRepository.listJournalLines>>
  ) {
    return {
      id: journal.id,
      companyId: journal.companyId,
      financialYearId: journal.financialYearId,
      journalNumber: journal.journalNumber,
      entryDate: journal.entryDate,
      voucherType: journal.voucherType,
      referenceType: journal.referenceType,
      referenceId: journal.referenceId,
      referenceNumber: journal.referenceNumber,
      description: journal.description,
      status: journal.status,
      totalDebit: normalizeMoney(journal.totalDebit),
      totalCredit: normalizeMoney(journal.totalCredit),
      postedAt: journal.postedAt,
      cancelledAt: journal.cancelledAt,
      reversedFromId: journal.reversedFromId,
      createdBy: journal.createdBy,
      updatedBy: journal.updatedBy,
      createdAt: journal.createdAt,
      updatedAt: journal.updatedAt,
      lines: lines.map((row) => ({
        id: row.line.id,
        accountId: row.line.accountId,
        accountCode: row.account.accountCode,
        accountName: row.account.accountName,
        lineNumber: row.line.lineNumber,
        description: row.line.description,
        debit: normalizeMoney(row.line.debit),
        credit: normalizeMoney(row.line.credit),
        balanceAfter:
          row.line.balanceAfter === null
            ? null
            : {
                amount: splitBalanceBySide(row.line.balanceAfter, row.account.normalBalance).amount,
                side: splitBalanceBySide(row.line.balanceAfter, row.account.normalBalance).side
              },
        partyType: row.line.partyType,
        partyId: row.line.partyId,
        referenceType: row.line.referenceType,
        referenceId: row.line.referenceId,
        createdAt: row.line.createdAt
      }))
    };
  }

  private async createDraftJournal(
    actor: AccountingActor,
    input: {
      financialYearId?: string | null;
      journalNumber?: string | null;
      entryDate: Date;
      voucherType: JournalVoucherType;
      referenceType?: string | null;
      referenceId?: string | null;
      referenceNumber?: string | null;
      description: string;
      lines: JournalLineInput[];
    },
    executor: TransactionClient
  ) {
    const { totalDebit, totalCredit } = assertBalanced(input.lines);
    const accountMap = await this.validateJournalLines(actor.companyId, input.lines, executor);
    const financialYear = await this.assertPeriodUnlocked(actor.companyId, input.entryDate, input.financialYearId, executor);
    void accountMap;

    const journalNumber = input.journalNumber ?? (await this.getNextJournalNumber(actor.companyId, input.voucherType, executor));
    const createdJournal = await accountingRepository.createJournal(
      {
        companyId: actor.companyId,
        financialYearId: financialYear?.id ?? input.financialYearId ?? null,
        journalNumber,
        entryDate: input.entryDate,
        voucherType: input.voucherType,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        referenceNumber: input.referenceNumber ?? null,
        description: input.description.trim(),
        status: "draft",
        totalDebit,
        totalCredit,
        createdBy: actor.id,
        updatedBy: actor.id
      },
      executor
    );

    if (!createdJournal) {
      throw new AppError("Failed to create journal entry", 500);
    }

    await accountingRepository.createJournalLines(
      input.lines.map((line, index) => ({
        companyId: actor.companyId,
        journalEntryId: createdJournal.id,
        accountId: line.accountId,
        lineNumber: index + 1,
        description: line.description ?? null,
        debit: line.debit,
        credit: line.credit,
        balanceAfter: null,
        partyType: line.partyType ?? null,
        partyId: line.partyId ?? null,
        referenceType: line.referenceType ?? null,
        referenceId: line.referenceId ?? null
      })),
      executor
    );

    return createdJournal;
  }

  private async finalizeJournalPosting(actor: AccountingActor, journalId: string, overrideEntryDate: Date | null, executor: TransactionClient) {
    const existing = await accountingRepository.findJournalById(actor.companyId, journalId, executor);
    if (!existing) {
      throw new AppError("Journal entry not found", 404);
    }

    if (existing.status !== "draft") {
      throw new AppError("Only draft journals can be posted", 400);
    }

    const entryDate = overrideEntryDate ?? existing.entryDate;
    const financialYear = await this.assertPeriodUnlocked(actor.companyId, entryDate, existing.financialYearId, executor);
    const currentLines = await accountingRepository.listJournalLines(actor.companyId, journalId, executor);
    if (currentLines.length < 2) {
      throw new AppError("Journal entry must contain at least two lines", 400);
    }

    const normalizedLines = currentLines.map<JournalLineInput>((row) => ({
      accountId: row.line.accountId,
      description: row.line.description ?? null,
      debit: normalizeMoney(row.line.debit),
      credit: normalizeMoney(row.line.credit),
      partyType: row.line.partyType ?? null,
      partyId: row.line.partyId ?? null,
      referenceType: row.line.referenceType ?? null,
      referenceId: row.line.referenceId ?? null
    }));

    assertBalanced(normalizedLines);
    const accountMap = await this.validateJournalLines(actor.companyId, normalizedLines, executor);

    const preparedLines = normalizedLines.map((line, index) => {
      const account = accountMap.get(line.accountId)!;
      const nextBalance = applyBalanceDelta(account.currentBalance, account.normalBalance, line.debit, line.credit);
      account.currentBalance = nextBalance;

      return {
        companyId: actor.companyId,
        journalEntryId: existing.id,
        accountId: line.accountId,
        lineNumber: index + 1,
        description: line.description ?? null,
        debit: line.debit,
        credit: line.credit,
        balanceAfter: nextBalance,
        partyType: line.partyType ?? null,
        partyId: line.partyId ?? null,
        referenceType: line.referenceType ?? null,
        referenceId: line.referenceId ?? null
      };
    });

    await accountingRepository.deleteJournalLines(actor.companyId, existing.id, executor);
    await accountingRepository.createJournalLines(preparedLines, executor);

    for (const account of accountMap.values()) {
      const updated = await accountingRepository.updateAccountBalance(actor.companyId, account.id, normalizeMoney(account.currentBalance), actor.id, executor);
      if (!updated) {
        throw new AppError("Failed to update account balance", 500);
      }
    }

    const updatedJournal = await accountingRepository.updateJournal(
      actor.companyId,
      existing.id,
      {
        entryDate,
        financialYearId: financialYear?.id ?? existing.financialYearId ?? null,
        status: "posted",
        postedAt: new Date(),
        updatedBy: actor.id
      },
      executor
    );

    if (!updatedJournal) {
      throw new AppError("Failed to post journal entry", 500);
    }

    return updatedJournal;
  }

  private async createAndPostJournal(
    actor: AccountingActor,
    input: {
      financialYearId?: string | null;
      journalNumber?: string | null;
      entryDate: Date;
      voucherType: JournalVoucherType;
      referenceType?: string | null;
      referenceId?: string | null;
      referenceNumber?: string | null;
      description: string;
      lines: JournalLineInput[];
      reversedFromId?: string | null;
    },
    executor: TransactionClient
  ) {
    const draft = await this.createDraftJournal(actor, input, executor);
    if (input.reversedFromId) {
      await accountingRepository.updateJournal(actor.companyId, draft.id, { reversedFromId: input.reversedFromId }, executor);
    }

    return this.finalizeJournalPosting(actor, draft.id, input.entryDate, executor);
  }

  private async syncAccountOpeningMetadata(companyId: string, accountId: string, actorId: string, executor: TransactionClient) {
    const account = await accountingRepository.findAccountById(companyId, accountId, executor);
    if (!account) {
      throw new AppError("Account not found", 404);
    }

    const totals = await accountingRepository.getOpeningBalanceTotalsForAccount(companyId, accountId, executor);
    const balance = calculateAccountBalanceByNormalSide(account.normalBalance, totals.debit, totals.credit);
    const split = splitBalanceBySide(balance, account.normalBalance);
    const openingBalanceType = compareDecimals(split.amount, "0.00", 2) === 0 ? "none" : split.side;

    await accountingRepository.updateAccount(
      companyId,
      accountId,
      {
        openingBalance: split.amount,
        openingBalanceType,
        updatedBy: actorId
      },
      executor
    );
  }

  private async createOpeningBalanceJournal(
    actor: AccountingActor,
    openingBalance: { id: string; accountId: string; openingDate: Date; debit: string; credit: string; financialYearId?: string | null },
    description: string | null | undefined,
    executor: TransactionClient
  ) {
    const targetAccount = await accountingRepository.findAccountById(actor.companyId, openingBalance.accountId, executor);
    if (!targetAccount) {
      throw new AppError("Opening balance account not found", 404);
    }

    const offsetKey: SystemAccountKey = targetAccount.systemKey === "retained_earnings" ? "capital" : "retained_earnings";
    const offsetAccount = await accountingRepository.findAccountBySystemKey(actor.companyId, offsetKey, executor);
    if (!offsetAccount) {
      throw new AppError("Default equity account required for opening balances was not found", 409);
    }

    const lines: JournalLineInput[] =
      compareDecimals(openingBalance.debit, "0.00", 2) > 0
        ? [
            {
              accountId: targetAccount.id,
              debit: normalizeMoney(openingBalance.debit),
              credit: "0.00",
              description: description ?? null
            },
            {
              accountId: offsetAccount.id,
              debit: "0.00",
              credit: normalizeMoney(openingBalance.debit),
              description: description ?? null
            }
          ]
        : [
            {
              accountId: offsetAccount.id,
              debit: normalizeMoney(openingBalance.credit),
              credit: "0.00",
              description: description ?? null
            },
            {
              accountId: targetAccount.id,
              debit: "0.00",
              credit: normalizeMoney(openingBalance.credit),
              description: description ?? null
            }
          ];

    return this.createAndPostJournal(
      actor,
      {
        financialYearId: openingBalance.financialYearId ?? null,
        entryDate: openingBalance.openingDate,
        voucherType: "opening",
        referenceType: "account_opening_balance",
        referenceId: openingBalance.id,
        referenceNumber: targetAccount.accountCode,
        description: description?.trim() || `Opening balance for ${targetAccount.accountName}`,
        lines
      },
      executor
    );
  }

  private async buildReversalJournal(
    actor: AccountingActor,
    sourceJournalId: string,
    reason: string,
    reversalDate: Date | null,
    executor: TransactionClient
  ) {
    const sourceJournal = await accountingRepository.findJournalById(actor.companyId, sourceJournalId, executor);
    if (!sourceJournal) {
      throw new AppError("Source journal entry not found", 404);
    }

    if (sourceJournal.status !== "posted") {
      throw new AppError("Only posted journals can be reversed", 400);
    }

    const sourceLines = await accountingRepository.listJournalLines(actor.companyId, sourceJournal.id, executor);
    const journal = await this.createAndPostJournal(
      actor,
      {
        financialYearId: sourceJournal.financialYearId,
        entryDate: reversalDate ?? new Date(),
        voucherType: "reversal",
        referenceType: sourceJournal.referenceType,
        referenceId: sourceJournal.referenceId,
        referenceNumber: sourceJournal.referenceNumber,
        description: `Reversal of ${sourceJournal.journalNumber}: ${reason.trim()}`,
        reversedFromId: sourceJournal.id,
        lines: sourceLines.map((row) => ({
          accountId: row.line.accountId,
          description: row.line.description,
          debit: normalizeMoney(row.line.credit),
          credit: normalizeMoney(row.line.debit),
          partyType: row.line.partyType ?? null,
          partyId: row.line.partyId ?? null,
          referenceType: row.line.referenceType ?? null,
          referenceId: row.line.referenceId ?? null
        }))
      },
      executor
    );

    await accountingRepository.updateJournal(
      actor.companyId,
      sourceJournal.id,
      {
        status: "reversed",
        cancelledAt: new Date(),
        updatedBy: actor.id
      },
      executor
    );

    return journal;
  }

  private async buildDateRangeFromTrialOrProfitQuery(
    companyId: string,
    query: TrialBalanceQuery | ProfitLossQuery,
    executor?: TransactionClient
  ): Promise<DateRange> {
    if (query.financialYearId) {
      const year = await accountingRepository.findFinancialYearById(companyId, query.financialYearId, executor);
      if (!year) {
        throw new AppError("Financial year not found", 404);
      }

      return {
        dateFrom: year.startDate,
        dateTo: year.endDate,
        financialYearId: year.id
      };
    }

    if (!query.dateFrom || !query.dateTo) {
      throw new AppError("dateFrom and dateTo are required", 400);
    }

    return {
      dateFrom: this.toDate(query.dateFrom, "dateFrom"),
      dateTo: this.toDate(query.dateTo, "dateTo"),
      financialYearId: null
    };
  }

  private async mapEventToJournal(
    actor: AccountingActor,
    event: NonNullable<Awaited<ReturnType<typeof accountingRepository.findEventById>>>,
    executor: TransactionClient
  ): Promise<MappedEventResult> {
    const markIgnored = (message: string) => ({
      kind: "ignored" as const,
      message
    });

    if (event.eventType === "sales_invoice_posted") {
      const context = await accountingRepository.getSalesInvoiceAccountingContext(actor.companyId, event.referenceId, executor);
      if (!context) {
        throw new AppError("Sales invoice not found for accounting event", 404);
      }

      const goodsTaxable = context.items
        .filter((item) => item.productType === "goods")
        .reduce((sum, item) => addMoney(sum, normalizeMoney(item.taxableAmount)), "0.00");
      const serviceTaxable = context.items
        .filter((item) => item.productType === "service")
        .reduce((sum, item) => addMoney(sum, normalizeMoney(item.taxableAmount)), "0.00");
      const taxableAssigned = addMoney(goodsTaxable, serviceTaxable);
      const residualTaxable = subtractMoney(normalizeMoney(context.invoice.taxableAmount), taxableAssigned);
      const inventoryValue = normalizeMoney(context.inventoryValue);
      const hasPaid = compareDecimals(context.invoice.paidAmount, "0.00", 2) > 0;
      const hasDue = compareDecimals(context.invoice.dueAmount, "0.00", 2) > 0;
      const paymentAccountKey: SystemAccountKey = context.invoice.paymentMode === "cash" ? "cash" : "bank";

      const receivableAccount = await this.getSystemAccount(actor.companyId, "accounts_receivable", executor);
      const paidAccount = hasPaid ? await this.getSystemAccount(actor.companyId, paymentAccountKey, executor) : null;
      const salesAccount = await this.getSystemAccount(actor.companyId, "sales", executor);
      const serviceIncomeAccount = await this.getSystemAccount(actor.companyId, "service_income", executor);
      const outputGstAccount = await this.getSystemAccount(actor.companyId, "output_gst", executor);
      const inventoryAccount = await this.getSystemAccount(actor.companyId, "inventory", executor);
      const cogsAccount = await this.getSystemAccount(actor.companyId, "cogs", executor);
      const roundOffAccount = await this.getSystemAccount(actor.companyId, "round_off_expense", executor);

      const lines: JournalLineInput[] = [];
      if (hasDue) {
        lines.push({
          accountId: receivableAccount.id,
          debit: normalizeMoney(context.invoice.dueAmount),
          credit: "0.00",
          partyType: context.invoice.customerId ? "customer" : null,
          partyId: context.invoice.customerId ?? null,
          description: `Receivable for ${context.invoice.invoiceNumber}`
        });
      }

      if (hasPaid && paidAccount) {
        lines.push({
          accountId: paidAccount.id,
          debit: normalizeMoney(context.invoice.paidAmount),
          credit: "0.00",
          referenceType: paidAccount.systemKey === "bank" && context.invoice.bankAccountId ? "company_bank_account" : null,
          referenceId: paidAccount.systemKey === "bank" ? context.invoice.bankAccountId : null,
          description: `Payment received on ${context.invoice.invoiceNumber}`
        });
      }

      if (compareDecimals(goodsTaxable, "0.00", 2) > 0 || compareDecimals(residualTaxable, "0.00", 2) > 0) {
        lines.push({
          accountId: salesAccount.id,
          debit: "0.00",
          credit: addMoney(goodsTaxable, residualTaxable),
          description: `Sales revenue for ${context.invoice.invoiceNumber}`
        });
      }

      if (compareDecimals(serviceTaxable, "0.00", 2) > 0) {
        lines.push({
          accountId: serviceIncomeAccount.id,
          debit: "0.00",
          credit: serviceTaxable,
          description: `Service revenue for ${context.invoice.invoiceNumber}`
        });
      }

      if (compareDecimals(context.invoice.gstTotal, "0.00", 2) > 0) {
        lines.push({
          accountId: outputGstAccount.id,
          debit: "0.00",
          credit: normalizeMoney(context.invoice.gstTotal),
          description: `Output GST for ${context.invoice.invoiceNumber}`
        });
      }

      if (compareDecimals(context.invoice.roundOffAmount, "0.00", 2) !== 0) {
        const amount = normalizeMoney(context.invoice.roundOffAmount);
        lines.push({
          accountId: roundOffAccount.id,
          debit: compareDecimals(amount, "0.00", 2) < 0 ? amount : "0.00",
          credit: compareDecimals(amount, "0.00", 2) > 0 ? amount : "0.00",
          description: `Round off for ${context.invoice.invoiceNumber}`
        });
      }

      if (compareDecimals(inventoryValue, "0.00", 2) > 0) {
        lines.push({
          accountId: cogsAccount.id,
          debit: inventoryValue,
          credit: "0.00",
          description: `COGS for ${context.invoice.invoiceNumber}`
        });
        lines.push({
          accountId: inventoryAccount.id,
          debit: "0.00",
          credit: inventoryValue,
          description: `Inventory reduction for ${context.invoice.invoiceNumber}`
        });
      }

      return {
        kind: "journal" as const,
        entryDate: context.invoice.invoiceDate,
        voucherType: "sales" as const,
        financialYearId: null,
        referenceType: "sales_invoice",
        referenceId: context.invoice.id,
        referenceNumber: context.invoice.invoiceNumber,
        description: `Sales invoice posted ${context.invoice.invoiceNumber}`,
        lines
      };
    }

    if (event.eventType === "purchase_posted") {
      const context = await accountingRepository.getPurchaseInvoiceAccountingContext(actor.companyId, event.referenceId, executor);
      if (!context) {
        throw new AppError("Purchase invoice not found for accounting event", 404);
      }

      const goodsInventory = normalizeMoney(context.inventoryValue);
      const serviceExpense = context.items
        .filter((item) => item.productType === "service")
        .reduce((sum, item) => addMoney(sum, normalizeMoney(item.taxableAmount)), "0.00");
      const payableAccount = await this.getSystemAccount(actor.companyId, "accounts_payable", executor);
      const inventoryAccount = await this.getSystemAccount(actor.companyId, "inventory", executor);
      const purchaseExpenseAccount = await this.getSystemAccount(actor.companyId, "purchases", executor);
      const inputGstAccount = await this.getSystemAccount(actor.companyId, "input_gst", executor);
      const paidAccount =
        compareDecimals(context.invoice.paidAmount, "0.00", 2) > 0
          ? await this.getSystemAccount(actor.companyId, context.invoice.paymentMode === "cash" ? "cash" : "bank", executor)
          : null;
      const roundOffAccount = await this.getSystemAccount(actor.companyId, "round_off_expense", executor);

      const lines: JournalLineInput[] = [];
      if (compareDecimals(goodsInventory, "0.00", 2) > 0) {
        lines.push({
          accountId: inventoryAccount.id,
          debit: goodsInventory,
          credit: "0.00",
          description: `Inventory received for ${context.invoice.purchaseNumber}`
        });
      }

      if (compareDecimals(serviceExpense, "0.00", 2) > 0) {
        lines.push({
          accountId: purchaseExpenseAccount.id,
          debit: serviceExpense,
          credit: "0.00",
          description: `Service purchase for ${context.invoice.purchaseNumber}`
        });
      }

      if (compareDecimals(context.invoice.gstTotal, "0.00", 2) > 0) {
        lines.push({
          accountId: inputGstAccount.id,
          debit: normalizeMoney(context.invoice.gstTotal),
          credit: "0.00",
          description: `Input GST for ${context.invoice.purchaseNumber}`
        });
      }

      if (compareDecimals(context.invoice.roundOffAmount, "0.00", 2) !== 0) {
        const amount = normalizeMoney(context.invoice.roundOffAmount);
        lines.push({
          accountId: roundOffAccount.id,
          debit: compareDecimals(amount, "0.00", 2) > 0 ? amount : "0.00",
          credit: compareDecimals(amount, "0.00", 2) < 0 ? amount : "0.00",
          description: `Round off for ${context.invoice.purchaseNumber}`
        });
      }

      if (compareDecimals(context.invoice.dueAmount, "0.00", 2) > 0) {
        lines.push({
          accountId: payableAccount.id,
          debit: "0.00",
          credit: normalizeMoney(context.invoice.dueAmount),
          partyType: "supplier",
          partyId: context.invoice.supplierId,
          description: `Payable for ${context.invoice.purchaseNumber}`
        });
      }

      if (compareDecimals(context.invoice.paidAmount, "0.00", 2) > 0 && paidAccount) {
        lines.push({
          accountId: paidAccount.id,
          debit: "0.00",
          credit: normalizeMoney(context.invoice.paidAmount),
          referenceType: paidAccount.systemKey === "bank" && context.invoice.bankAccountId ? "company_bank_account" : null,
          referenceId: paidAccount.systemKey === "bank" ? context.invoice.bankAccountId : null,
          description: `Initial payment for ${context.invoice.purchaseNumber}`
        });
      }

      return {
        kind: "journal" as const,
        entryDate: context.invoice.invoiceDate,
        voucherType: "purchase" as const,
        financialYearId: null,
        referenceType: "purchase_invoice",
        referenceId: context.invoice.id,
        referenceNumber: context.invoice.purchaseNumber,
        description: `Purchase invoice posted ${context.invoice.purchaseNumber}`,
        lines
      };
    }

    if (event.eventType === "expense_posted") {
      const context = await accountingRepository.getExpenseAccountingContext(actor.companyId, event.referenceId, executor);
      if (!context) {
        throw new AppError("Expense not found for accounting event", 404);
      }

      const expenseAccountId = context.expense.expenseAccountId ?? context.category.defaultAccountId;
      if (!expenseAccountId) {
        throw new AppError("Expense account is not configured for this expense", 409);
      }

      const expenseAccount = await accountingRepository.findAccountById(actor.companyId, expenseAccountId, executor);
      if (!expenseAccount || expenseAccount.status !== "active" || expenseAccount.deletedAt || expenseAccount.accountType !== "expense") {
        throw new AppError("Expense account is invalid for this expense", 409);
      }

      const creditAccount =
        context.expense.paymentMode === "cash"
          ? await this.getSystemAccount(actor.companyId, "cash", executor)
          : context.expense.paymentMode === "other"
            ? await this.getSystemAccount(actor.companyId, "accounts_payable", executor)
            : await this.getSystemAccount(actor.companyId, "bank", executor);
      const inputGstAccount =
        compareDecimals(context.expense.gstAmount, "0.00", 2) > 0
          ? await this.getSystemAccount(actor.companyId, "input_gst", executor)
          : null;

      const lines: JournalLineInput[] = [
        {
          accountId: expenseAccount.id,
          debit: normalizeMoney(context.expense.taxableAmount),
          credit: "0.00",
          description: `Expense booking ${context.expense.expenseNumber}`
        }
      ];

      if (inputGstAccount) {
        lines.push({
          accountId: inputGstAccount.id,
          debit: normalizeMoney(context.expense.gstAmount),
          credit: "0.00",
          description: `Input GST ${context.expense.expenseNumber}`
        });
      }

      lines.push({
        accountId: creditAccount.id,
        debit: "0.00",
        credit: normalizeMoney(context.expense.totalAmount),
        referenceType: creditAccount.systemKey === "bank" && context.expense.bankAccountId ? "company_bank_account" : null,
        referenceId: creditAccount.systemKey === "bank" ? context.expense.bankAccountId : null,
        description:
          creditAccount.systemKey === "accounts_payable"
            ? `Expense payable ${context.expense.expenseNumber}`
            : `Expense payment ${context.expense.expenseNumber}`
      });

      return {
        kind: "journal" as const,
        entryDate: context.expense.expenseDate,
        voucherType: "expense" as const,
        financialYearId: null,
        referenceType: "expense",
        referenceId: context.expense.id,
        referenceNumber: context.expense.expenseNumber,
        description: `Expense posted ${context.expense.expenseNumber}`,
        lines
      };
    }

    if (event.eventType === "sales_return_created") {
      const context = await accountingRepository.getSalesReturnAccountingContext(actor.companyId, event.referenceId, executor);
      if (!context) {
        throw new AppError("Sales return not found for accounting event", 404);
      }

      const receivableAccount = await this.getSystemAccount(actor.companyId, "accounts_receivable", executor);
      const salesAccount = await this.getSystemAccount(actor.companyId, "sales", executor);
      const outputGstAccount = await this.getSystemAccount(actor.companyId, "output_gst", executor);
      const inventoryAccount = await this.getSystemAccount(actor.companyId, "inventory", executor);
      const cogsAccount = await this.getSystemAccount(actor.companyId, "cogs", executor);

      const lines: JournalLineInput[] = [
        {
          accountId: salesAccount.id,
          debit: normalizeMoney(context.salesReturn.subtotal),
          credit: "0.00",
          description: `Sales return ${context.salesReturn.returnNumber}`
        },
        {
          accountId: outputGstAccount.id,
          debit: normalizeMoney(context.salesReturn.gstTotal),
          credit: "0.00",
          description: `Output GST reversal ${context.salesReturn.returnNumber}`
        },
        {
          accountId: receivableAccount.id,
          debit: "0.00",
          credit: normalizeMoney(context.salesReturn.grandTotal),
          partyType: context.salesReturn.customerId ? "customer" : null,
          partyId: context.salesReturn.customerId ?? null,
          description: `Customer adjustment ${context.salesReturn.returnNumber}`
        },
        {
          accountId: inventoryAccount.id,
          debit: normalizeMoney(context.inventoryValue),
          credit: "0.00",
          description: `Inventory return ${context.salesReturn.returnNumber}`
        },
        {
          accountId: cogsAccount.id,
          debit: "0.00",
          credit: normalizeMoney(context.inventoryValue),
          description: `COGS reversal ${context.salesReturn.returnNumber}`
        }
      ];

      return {
        kind: "journal" as const,
        entryDate: context.salesReturn.returnDate,
        voucherType: "credit_note" as const,
        financialYearId: null,
        referenceType: "sales_return",
        referenceId: context.salesReturn.id,
        referenceNumber: context.salesReturn.returnNumber,
        description: `Sales return ${context.salesReturn.returnNumber}`,
        lines
      };
    }

    if (event.eventType === "purchase_return_created") {
      const context = await accountingRepository.getPurchaseReturnAccountingContext(actor.companyId, event.referenceId, executor);
      if (!context) {
        throw new AppError("Purchase return not found for accounting event", 404);
      }

      const payableAccount = await this.getSystemAccount(actor.companyId, "accounts_payable", executor);
      const inventoryAccount = await this.getSystemAccount(actor.companyId, "inventory", executor);
      const purchaseAccount = await this.getSystemAccount(actor.companyId, "purchases", executor);
      const inputGstAccount = await this.getSystemAccount(actor.companyId, "input_gst", executor);

      const lines: JournalLineInput[] = [
        {
          accountId: payableAccount.id,
          debit: normalizeMoney(context.purchaseReturn.grandTotal),
          credit: "0.00",
          partyType: "supplier",
          partyId: context.purchaseReturn.supplierId,
          description: `Supplier return adjustment ${context.purchaseReturn.returnNumber}`
        },
        {
          accountId: inventoryAccount.id,
          debit: "0.00",
          credit: normalizeMoney(context.inventoryValue),
          description: `Inventory return ${context.purchaseReturn.returnNumber}`
        },
        {
          accountId: purchaseAccount.id,
          debit: "0.00",
          credit: normalizeMoney(context.purchaseReturn.subtotal),
          description: `Purchase reversal ${context.purchaseReturn.returnNumber}`
        },
        {
          accountId: inputGstAccount.id,
          debit: "0.00",
          credit: normalizeMoney(context.purchaseReturn.gstTotal),
          description: `Input GST reversal ${context.purchaseReturn.returnNumber}`
        }
      ];

      return {
        kind: "journal" as const,
        entryDate: context.purchaseReturn.returnDate,
        voucherType: "debit_note" as const,
        financialYearId: null,
        referenceType: "purchase_return",
        referenceId: context.purchaseReturn.id,
        referenceNumber: context.purchaseReturn.returnNumber,
        description: `Purchase return ${context.purchaseReturn.returnNumber}`,
        lines
      };
    }

    if (event.eventType === "sales_payment_received") {
      const context = await accountingRepository.getSalesPaymentAccountingContext(actor.companyId, event.referenceId, executor);
      if (!context) {
        throw new AppError("Sales payment not found for accounting event", 404);
      }

      const bankOrCash = await this.getSystemAccount(actor.companyId, context.payment.paymentMode === "cash" ? "cash" : "bank", executor);
      const receivable = await this.getSystemAccount(actor.companyId, "accounts_receivable", executor);

      const lines: JournalLineInput[] = [
        {
          accountId: bankOrCash.id,
          debit: normalizeMoney(context.payment.amount),
          credit: "0.00",
          referenceType: bankOrCash.systemKey === "bank" && context.payment.bankAccountId ? "company_bank_account" : null,
          referenceId: bankOrCash.systemKey === "bank" ? context.payment.bankAccountId : null,
          description: `Sales payment ${context.invoice.invoiceNumber}`
        },
        {
          accountId: receivable.id,
          debit: "0.00",
          credit: normalizeMoney(context.payment.amount),
          partyType: context.invoice.customerId ? "customer" : null,
          partyId: context.invoice.customerId ?? null,
          description: `Receivable settlement ${context.invoice.invoiceNumber}`
        }
      ];

      return {
        kind: "journal" as const,
        entryDate: context.payment.paymentDate,
        voucherType: "receipt" as const,
        financialYearId: null,
        referenceType: "sales_payment",
        referenceId: context.payment.id,
        referenceNumber: context.invoice.invoiceNumber,
        description: `Sales payment received for ${context.invoice.invoiceNumber}`,
        lines
      };
    }

    if (event.eventType === "purchase_payment_recorded") {
      const context = await accountingRepository.getPurchasePaymentAccountingContext(actor.companyId, event.referenceId, executor);
      if (!context) {
        throw new AppError("Purchase payment not found for accounting event", 404);
      }

      const bankOrCash = await this.getSystemAccount(actor.companyId, context.payment.paymentMode === "cash" ? "cash" : "bank", executor);
      const payable = await this.getSystemAccount(actor.companyId, "accounts_payable", executor);

      const lines: JournalLineInput[] = [
        {
          accountId: payable.id,
          debit: normalizeMoney(context.payment.amount),
          credit: "0.00",
          partyType: "supplier",
          partyId: context.invoice.supplierId,
          description: `Payable settlement ${context.invoice.purchaseNumber}`
        },
        {
          accountId: bankOrCash.id,
          debit: "0.00",
          credit: normalizeMoney(context.payment.amount),
          referenceType: bankOrCash.systemKey === "bank" && context.payment.bankAccountId ? "company_bank_account" : null,
          referenceId: bankOrCash.systemKey === "bank" ? context.payment.bankAccountId : null,
          description: `Purchase payment ${context.invoice.purchaseNumber}`
        }
      ];

      return {
        kind: "journal" as const,
        entryDate: context.payment.paymentDate,
        voucherType: "payment" as const,
        financialYearId: null,
        referenceType: "purchase_payment",
        referenceId: context.payment.id,
        referenceNumber: context.invoice.purchaseNumber,
        description: `Purchase payment recorded for ${context.invoice.purchaseNumber}`,
        lines
      };
    }

    if (event.eventType === "customer_payment_completed" || event.eventType === "supplier_payment_completed") {
      const context = await accountingRepository.getPaymentAccountingContext(actor.companyId, event.referenceId, executor);
      if (!context) {
        throw new AppError("Payment not found for accounting event", 404);
      }

      const partyAccount = await this.getSystemAccount(
        actor.companyId,
        context.payment.partyType === "customer" ? "accounts_receivable" : "accounts_payable",
        executor
      );
      const bankOrCash = await this.getSystemAccount(actor.companyId, context.payment.paymentMode === "cash" ? "cash" : "bank", executor);
      const isCustomerReceipt = context.payment.paymentType === "customer_receive";

      const lines: JournalLineInput[] = isCustomerReceipt
        ? [
            {
              accountId: bankOrCash.id,
              debit: normalizeMoney(context.payment.amount),
              credit: "0.00",
              referenceType: bankOrCash.systemKey === "bank" && context.payment.bankAccountId ? "company_bank_account" : null,
              referenceId: bankOrCash.systemKey === "bank" ? context.payment.bankAccountId : null,
              description: `Payment ${context.payment.paymentNumber}`
            },
            {
              accountId: partyAccount.id,
              debit: "0.00",
              credit: normalizeMoney(context.payment.amount),
              partyType: "customer",
              partyId: context.payment.partyId,
              description: `Customer settlement ${context.payment.paymentNumber}`
            }
          ]
        : [
            {
              accountId: partyAccount.id,
              debit: normalizeMoney(context.payment.amount),
              credit: "0.00",
              partyType: "supplier",
              partyId: context.payment.partyId,
              description: `Supplier settlement ${context.payment.paymentNumber}`
            },
            {
              accountId: bankOrCash.id,
              debit: "0.00",
              credit: normalizeMoney(context.payment.amount),
              referenceType: bankOrCash.systemKey === "bank" && context.payment.bankAccountId ? "company_bank_account" : null,
              referenceId: bankOrCash.systemKey === "bank" ? context.payment.bankAccountId : null,
              description: `Payment ${context.payment.paymentNumber}`
            }
          ];

      return {
        kind: "journal" as const,
        entryDate: context.payment.paymentDate,
        voucherType: isCustomerReceipt ? ("receipt" as const) : ("payment" as const),
        financialYearId: null,
        referenceType: "payment",
        referenceId: context.payment.id,
        referenceNumber: context.payment.paymentNumber,
        description: isCustomerReceipt ? `Customer payment received ${context.payment.paymentNumber}` : `Supplier payment made ${context.payment.paymentNumber}`,
        lines
      };
    }

    if (event.eventType === "payroll_generated") {
      const context = await accountingRepository.getPayrollRunAccountingContext(actor.companyId, event.referenceId, executor);
      if (!context) {
        throw new AppError("Payroll run not found for accounting event", 404);
      }

      if (compareDecimals(context.run.netPayableTotal, "0.00", 2) <= 0) {
        return markIgnored("Payroll run total is zero");
      }

      const salaryExpense = await this.getSystemAccount(actor.companyId, "salary_expense", executor);
      const salaryPayable = await this.getSystemAccount(actor.companyId, "salary_payable", executor);

      return {
        kind: "journal" as const,
        entryDate: context.run.periodEnd,
        voucherType: "payroll",
        financialYearId: null,
        referenceType: "payroll_run",
        referenceId: context.run.id,
        referenceNumber: context.run.runNumber,
        description: `Payroll generated ${context.run.runNumber}`,
        lines: [
          {
            accountId: salaryExpense.id,
            debit: normalizeMoney(context.run.netPayableTotal),
            credit: "0.00",
            description: `Payroll expense ${context.run.payrollMonth}`
          },
          {
            accountId: salaryPayable.id,
            debit: "0.00",
            credit: normalizeMoney(context.run.netPayableTotal),
            description: `Salary payable ${context.run.payrollMonth}`
          }
        ]
      };
    }

    if (event.eventType === "payroll_paid") {
      const context = await accountingRepository.getPayrollRunAccountingContext(actor.companyId, event.referenceId, executor);
      if (!context) {
        throw new AppError("Payroll run not found for accounting event", 404);
      }

      const payload = event.payload as {
        paymentBatchAmount?: string | number;
        paymentMode?: "cash" | "bank" | "upi" | "cheque" | "other";
        paymentDate?: string | Date | null;
        bankAccountId?: string | null;
        referenceNumber?: string | null;
      };
      const paymentAmount = normalizeMoney(payload.paymentBatchAmount ?? "0.00");
      if (compareDecimals(paymentAmount, "0.00", 2) <= 0) {
        return markIgnored("Payroll payment batch total is zero");
      }

      const paymentEntryDate = payload.paymentDate ? new Date(payload.paymentDate) : event.createdAt;

      const salaryPayable = await this.getSystemAccount(actor.companyId, "salary_payable", executor);
      const bankOrCash = await this.getSystemAccount(
        actor.companyId,
        payload.paymentMode === "cash" ? "cash" : "bank",
        executor
      );

      return {
        kind: "journal" as const,
        entryDate: paymentEntryDate,
        voucherType: "payment",
        financialYearId: null,
        referenceType: "payroll_run",
        referenceId: context.run.id,
        referenceNumber: context.run.runNumber,
        description: `Payroll payment ${context.run.runNumber}`,
        lines: [
          {
            accountId: salaryPayable.id,
            debit: paymentAmount,
            credit: "0.00",
            description: `Salary payable settlement ${context.run.payrollMonth}`
          },
          {
            accountId: bankOrCash.id,
            debit: "0.00",
            credit: paymentAmount,
            referenceType: bankOrCash.systemKey === "bank" && payload.bankAccountId ? "company_bank_account" : null,
            referenceId: bankOrCash.systemKey === "bank" ? payload.bankAccountId ?? null : null,
            description: `Payroll disbursement ${payload.referenceNumber ?? context.run.runNumber}`
          }
        ]
      };
    }

    if (
      event.eventType === "sales_invoice_cancelled" ||
      event.eventType === "purchase_cancelled" ||
      event.eventType === "expense_cancelled" ||
      event.eventType === "payroll_adjusted" ||
      event.eventType === "payroll_cancelled" ||
      event.eventType === "customer_payment_reversed" ||
      event.eventType === "supplier_payment_reversed"
    ) {
      const journals = await accountingRepository.listJournalsByReference(actor.companyId, event.referenceType, event.referenceId, executor);
      const sourceJournal = journals.find((journal) => journal.voucherType !== "reversal" && journal.status === "posted") ?? null;
      if (!sourceJournal) {
        return markIgnored("Original journal was not found for reversal");
      }

      return {
        kind: "reversal" as const,
        sourceJournalId: sourceJournal.id,
        reason: `Automated reversal from event ${event.eventType}`,
        entryDate: event.createdAt
      };
    }

    return markIgnored(`Event type ${event.eventType} is not supported`);
  }

  private async getSystemAccount(companyId: string, systemKey: SystemAccountKey, executor?: TransactionClient) {
    let account = await accountingRepository.findAccountBySystemKey(companyId, systemKey, executor);
    if (!account) {
      await this.seedMissingSystemAccounts(companyId, executor);
      account = await accountingRepository.findAccountBySystemKey(companyId, systemKey, executor);
    }

    if (!account) {
      throw new AppError(`Required system account ${systemKey} is missing`, 409);
    }

    if (account.status !== "active") {
      throw new AppError(`Required system account ${systemKey} is inactive`, 409);
    }

    return account;
  }

  private async seedMissingSystemAccounts(companyId: string, executor?: TransactionClient) {
    const seedInTransaction = async (transaction: TransactionClient) => {
      await accountingRepository.acquireScopedLock("seed-default-accounts", companyId, transaction);

      for (const seed of DEFAULT_SYSTEM_ACCOUNTS) {
        const existing = await accountingRepository.findAccountBySystemKey(companyId, seed.systemKey, transaction);
        if (existing) {
          continue;
        }

        const created = await accountingRepository.createAccount(
          {
            companyId,
            accountCode: seed.accountCode,
            accountName: seed.accountName,
            accountType: seed.accountType,
            accountSubtype: seed.accountSubtype,
            parentId: null,
            isSystem: true,
            systemKey: seed.systemKey,
            normalBalance: seed.normalBalance,
            openingBalance: "0.00",
            openingBalanceType: "none",
            currentBalance: "0.00",
            status: "active",
            description: seed.description,
            createdBy: null,
            updatedBy: null
          },
          transaction
        );

        if (!created) {
          throw new AppError("Failed to seed default accounts", 500);
        }
      }
    };

    if (executor) {
      await seedInTransaction(executor);
      return;
    }

    await db.transaction(seedInTransaction);
  }

  public async listAccounts(actor: Pick<AccountingActor, "companyId">, query: ListAccountsQuery) {
    const pagination = getPagination(query.page, query.limit);
    let result = await accountingRepository.listAccounts({
      companyId: actor.companyId,
      search: query.search ?? null,
      type: query.type,
      status: query.status,
      parentId: query.parentId,
      excludeSystem: query.excludeSystem,
      ...(query.hierarchy ? {} : { page: pagination.page, limit: pagination.limit })
    });

    if (!query.excludeSystem && result.total === 0) {
      await this.seedMissingSystemAccounts(actor.companyId);
      result = await accountingRepository.listAccounts({
        companyId: actor.companyId,
        search: query.search ?? null,
        type: query.type,
        status: query.status,
        parentId: query.parentId,
        excludeSystem: query.excludeSystem,
        ...(query.hierarchy ? {} : { page: pagination.page, limit: pagination.limit })
      });
    }

    const mapped = result.rows.map((row) => this.mapAccount(row));
    return {
      items: query.hierarchy ? this.buildHierarchy(mapped) : mapped,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createAccount(actor: AccountingActor, input: CreateAccountInput, context: AccountingRequestContext) {
    const created = await db.transaction(async (transaction) => {
      await this.validateAccountParent(actor.companyId, input.accountType, input.parentId, transaction);
      const normalBalance = DEFAULT_NORMAL_BALANCE_BY_ACCOUNT_TYPE[input.accountType];
      const accountCode = input.accountCode ?? (await this.getNextAccountCode(actor.companyId, input.accountType, transaction));

      const existingCode = await accountingRepository.findAccountByCode(actor.companyId, accountCode, transaction);
      if (existingCode) {
        throw new AppError("Account code already exists", 409);
      }

      const createdAccount = await accountingRepository.createAccount(
        {
          companyId: actor.companyId,
          accountCode,
          accountName: input.accountName.trim(),
          accountType: input.accountType,
          accountSubtype: input.accountSubtype ?? null,
          parentId: input.parentId ?? null,
          isSystem: false,
          systemKey: null,
          normalBalance,
          openingBalance: normalizeMoney(input.openingBalance ?? 0),
          openingBalanceType:
            compareDecimals(normalizeMoney(input.openingBalance ?? 0), "0.00", 2) === 0 ? "none" : input.openingBalanceType,
          currentBalance: "0.00",
          status: "active",
          description: input.description ?? null,
          createdBy: actor.id,
          updatedBy: actor.id
        },
        transaction
      );

      if (!createdAccount) {
        throw new AppError("Failed to create account", 500);
      }

      return createdAccount;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "account_created",
      entityType: "chart_of_accounts",
      entityId: created.id,
      metadata: {
        accountCode: created.accountCode,
        accountName: created.accountName
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      account: this.mapAccount(created)
    };
  }

  public async updateAccount(actor: AccountingActor, accountId: string, input: UpdateAccountInput, context: AccountingRequestContext) {
    const updated = await db.transaction(async (transaction) => {
      const existing = await accountingRepository.findAccountById(actor.companyId, accountId, transaction);
      if (!existing) {
        throw new AppError("Account not found", 404);
      }

      if (input.parentId !== undefined) {
        await this.validateAccountParent(actor.companyId, existing.accountType, input.parentId, transaction);
        await this.assertNoCircularParent(actor.companyId, existing.id, input.parentId, transaction);
      }

      const account = await accountingRepository.updateAccount(
        actor.companyId,
        accountId,
        {
          accountName: input.accountName?.trim() ?? existing.accountName,
          accountSubtype: input.accountSubtype ?? existing.accountSubtype,
          parentId: input.parentId === undefined ? existing.parentId : input.parentId,
          status: input.status ?? existing.status,
          description: input.description ?? existing.description,
          updatedBy: actor.id
        },
        transaction
      );

      if (!account) {
        throw new AppError("Failed to update account", 500);
      }

      return account;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "account_updated",
      entityType: "chart_of_accounts",
      entityId: updated.id,
      metadata: {
        accountCode: updated.accountCode
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      account: this.mapAccount(updated)
    };
  }

  public async deleteAccount(actor: AccountingActor, accountId: string, context: AccountingRequestContext) {
    const account = await db.transaction(async (transaction) => {
      const existing = await accountingRepository.findAccountById(actor.companyId, accountId, transaction);
      if (!existing) {
        throw new AppError("Account not found", 404);
      }

      if (existing.isSystem) {
        throw new AppError("System accounts cannot be deleted", 400);
      }

      const children = await accountingRepository.findAccountChildren(actor.companyId, accountId, transaction);
      if (children.length > 0) {
        throw new AppError("Account with child accounts cannot be deleted", 400);
      }

      const postedLineCount = await accountingRepository.countPostedJournalLinesForAccount(actor.companyId, accountId, transaction);
      const updated = await accountingRepository.updateAccount(
        actor.companyId,
        accountId,
        postedLineCount > 0
          ? {
              status: "inactive",
              updatedBy: actor.id
            }
          : {
              status: "deleted",
              deletedAt: new Date(),
              updatedBy: actor.id
            },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to delete account", 500);
      }

      return {
        account: updated,
        deactivated: postedLineCount > 0
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "account_deactivated",
      entityType: "chart_of_accounts",
      entityId: account.account.id,
      metadata: {
        deactivated: account.deactivated
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      account: this.mapAccount(account.account),
      deactivated: account.deactivated
    };
  }

  public async seedDefaultAccounts(actor: AccountingActor, context: AccountingRequestContext) {
    const seeded = await db.transaction(async (transaction) => {
      const createdIds: string[] = [];
      const existingIds: string[] = [];

      for (const seed of DEFAULT_SYSTEM_ACCOUNTS) {
        const existing = await accountingRepository.findAccountBySystemKey(actor.companyId, seed.systemKey, transaction);
        if (existing) {
          existingIds.push(existing.id);
          continue;
        }

        const created = await accountingRepository.createAccount(
          {
            companyId: actor.companyId,
            accountCode: seed.accountCode,
            accountName: seed.accountName,
            accountType: seed.accountType,
            accountSubtype: seed.accountSubtype,
            parentId: null,
            isSystem: true,
            systemKey: seed.systemKey,
            normalBalance: seed.normalBalance,
            openingBalance: "0.00",
            openingBalanceType: "none",
            currentBalance: "0.00",
            status: "active",
            description: seed.description,
            createdBy: actor.id,
            updatedBy: actor.id
          },
          transaction
        );

        if (!created) {
          throw new AppError("Failed to seed default accounts", 500);
        }

        createdIds.push(created.id);
      }

      return {
        createdIds,
        existingIds
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "account_defaults_seeded",
      entityType: "chart_of_accounts",
      metadata: {
        createdCount: seeded.createdIds.length,
        existingCount: seeded.existingIds.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return seeded;
  }

  public async listOpeningBalances(actor: Pick<AccountingActor, "companyId">, query: ListOpeningBalancesQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await accountingRepository.listOpeningBalances({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      accountId: query.accountId,
      financialYearId: query.financialYearId,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      isLocked: query.isLocked
    });

    return {
      items: result.rows.map((row) => ({
        id: row.openingBalance.id,
        accountId: row.openingBalance.accountId,
        accountCode: row.account.accountCode,
        accountName: row.account.accountName,
        financialYearId: row.openingBalance.financialYearId,
        openingDate: row.openingBalance.openingDate,
        debit: normalizeMoney(row.openingBalance.debit),
        credit: normalizeMoney(row.openingBalance.credit),
        isLocked: row.openingBalance.isLocked,
        createdAt: row.openingBalance.createdAt,
        updatedAt: row.openingBalance.updatedAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createOpeningBalances(actor: AccountingActor, input: CreateOpeningBalancesInput, context: AccountingRequestContext) {
    const created = await db.transaction(async (transaction) => {
      await this.assertPeriodUnlocked(actor.companyId, input.openingDate, input.financialYearId ?? null, transaction);
      const output: Array<{ openingBalanceId: string; journalId: string }> = [];

      for (const entry of input.entries) {
        const account = await accountingRepository.findAccountById(actor.companyId, entry.accountId, transaction);
        if (!account) {
          throw new AppError("Account not found for opening balance", 404);
        }

        if (account.status !== "active") {
          throw new AppError("Only active accounts can receive opening balances", 400);
        }

        const openingBalance = await accountingRepository.createOpeningBalance(
          {
            companyId: actor.companyId,
            accountId: entry.accountId,
            financialYearId: input.financialYearId ?? null,
            openingDate: input.openingDate,
            debit: normalizeMoney(entry.debit ?? 0),
            credit: normalizeMoney(entry.credit ?? 0),
            isLocked: false,
            createdBy: actor.id,
            updatedBy: actor.id
          },
          transaction
        );

        if (!openingBalance) {
          throw new AppError("Failed to create opening balance", 500);
        }

        const journal = await this.createOpeningBalanceJournal(actor, openingBalance, entry.description ?? input.description, transaction);
        await this.syncAccountOpeningMetadata(actor.companyId, entry.accountId, actor.id, transaction);
        output.push({
          openingBalanceId: openingBalance.id,
          journalId: journal.id
        });
      }

      return output;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "opening_balance_created",
      entityType: "account_opening_balance",
      metadata: {
        count: created.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      items: created
    };
  }

  public async updateOpeningBalance(
    actor: AccountingActor,
    openingBalanceId: string,
    input: UpdateOpeningBalanceInput,
    context: AccountingRequestContext
  ) {
    const updated = await db.transaction(async (transaction) => {
      const existing = await accountingRepository.findOpeningBalanceById(actor.companyId, openingBalanceId, transaction);
      if (!existing) {
        throw new AppError("Opening balance not found", 404);
      }

      if (existing.isLocked) {
        throw new AppError("Locked opening balances cannot be changed", 409);
      }

      const nextOpeningDate = input.openingDate ?? existing.openingDate;
      await this.assertPeriodUnlocked(actor.companyId, nextOpeningDate, existing.financialYearId, transaction);

      const journals = await accountingRepository.listJournalsByReference(actor.companyId, "account_opening_balance", existing.id, transaction);
      const currentOpeningJournal = journals.find((journal) => journal.voucherType === "opening" && journal.status === "posted");
      if (currentOpeningJournal) {
        await this.buildReversalJournal(actor, currentOpeningJournal.id, "Opening balance updated", nextOpeningDate, transaction);
      }

      const openingBalance = await accountingRepository.updateOpeningBalance(
        actor.companyId,
        openingBalanceId,
        {
          openingDate: nextOpeningDate,
          debit: input.debit !== undefined ? normalizeMoney(input.debit) : existing.debit,
          credit: input.credit !== undefined ? normalizeMoney(input.credit) : existing.credit,
          updatedBy: actor.id
        },
        transaction
      );

      if (!openingBalance) {
        throw new AppError("Failed to update opening balance", 500);
      }

      const journal = await this.createOpeningBalanceJournal(actor, openingBalance, input.description, transaction);
      await this.syncAccountOpeningMetadata(actor.companyId, openingBalance.accountId, actor.id, transaction);

      return {
        openingBalance,
        journal
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "opening_balance_updated",
      entityType: "account_opening_balance",
      entityId: updated.openingBalance.id,
      metadata: {
        journalId: updated.journal.id
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      openingBalance: {
        id: updated.openingBalance.id,
        accountId: updated.openingBalance.accountId,
        openingDate: updated.openingBalance.openingDate,
        debit: normalizeMoney(updated.openingBalance.debit),
        credit: normalizeMoney(updated.openingBalance.credit),
        isLocked: updated.openingBalance.isLocked
      },
      journalId: updated.journal.id
    };
  }

  public async lockOpeningBalances(actor: AccountingActor, input: LockOpeningBalancesInput, context: AccountingRequestContext) {
    const rows = await accountingRepository.lockOpeningBalances(actor.companyId, input.ids);
    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "opening_balance_locked",
      entityType: "account_opening_balance",
      metadata: {
        count: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      count: rows.length
    };
  }

  public async listJournals(actor: Pick<AccountingActor, "companyId">, query: ListJournalsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const dateFrom = query.dateFrom ? this.toDate(query.dateFrom, "dateFrom") : null;
    const dateTo = query.dateTo ? this.toDate(query.dateTo, "dateTo") : null;
    const result = await accountingRepository.listJournals({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      voucherType: query.voucherType,
      status: query.status,
      referenceType: query.referenceType ?? null,
      dateFrom,
      dateTo,
      financialYearId: query.financialYearId
    });

    return {
      items: result.rows.map((journal) => ({
        id: journal.id,
        journalNumber: journal.journalNumber,
        entryDate: journal.entryDate,
        voucherType: journal.voucherType,
        referenceType: journal.referenceType,
        referenceId: journal.referenceId,
        referenceNumber: journal.referenceNumber,
        description: journal.description,
        status: journal.status,
        totalDebit: normalizeMoney(journal.totalDebit),
        totalCredit: normalizeMoney(journal.totalCredit),
        postedAt: journal.postedAt,
        cancelledAt: journal.cancelledAt,
        reversedFromId: journal.reversedFromId,
        createdAt: journal.createdAt,
        updatedAt: journal.updatedAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createJournal(actor: AccountingActor, input: CreateJournalInput, context: AccountingRequestContext) {
    const journal = await db.transaction(async (transaction) => {
      const lines = this.normalizeJournalLines(input.lines);
      const draft = await this.createDraftJournal(
        actor,
        {
          financialYearId: input.financialYearId ?? null,
          journalNumber: input.journalNumber ?? null,
          entryDate: input.entryDate,
          voucherType: input.voucherType,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          referenceNumber: input.referenceNumber ?? null,
          description: input.description,
          lines
        },
        transaction
      );

      if (input.status === "posted") {
        return this.finalizeJournalPosting(actor, draft.id, input.entryDate, transaction);
      }

      return draft;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: input.status === "posted" ? "journal_posted" : "journal_created",
      entityType: "journal_entry",
      entityId: journal.id,
      metadata: {
        journalNumber: journal.journalNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getJournal({ companyId: actor.companyId }, journal.id);
  }

  public async getJournal(actor: Pick<AccountingActor, "companyId">, journalId: string) {
    const journal = await accountingRepository.findJournalById(actor.companyId, journalId);
    if (!journal) {
      throw new AppError("Journal entry not found", 404);
    }

    const lines = await accountingRepository.listJournalLines(actor.companyId, journalId);
    return {
      journal: this.mapJournalEntry(journal, lines)
    };
  }

  public async updateJournal(actor: AccountingActor, journalId: string, input: UpdateJournalInput, context: AccountingRequestContext) {
    const updated = await db.transaction(async (transaction) => {
      const existing = await accountingRepository.findJournalById(actor.companyId, journalId, transaction);
      if (!existing) {
        throw new AppError("Journal entry not found", 404);
      }

      if (existing.status !== "draft") {
        throw new AppError("Only draft journals can be edited", 400);
      }

      const nextEntryDate = input.entryDate ?? existing.entryDate;
      await this.assertPeriodUnlocked(actor.companyId, nextEntryDate, input.financialYearId ?? existing.financialYearId, transaction);

      if (input.lines) {
        const lines = this.normalizeJournalLines(input.lines);
        assertBalanced(lines);
        await this.validateJournalLines(actor.companyId, lines, transaction);
        await accountingRepository.deleteJournalLines(actor.companyId, journalId, transaction);
        await accountingRepository.createJournalLines(
          lines.map((line, index) => ({
            companyId: actor.companyId,
            journalEntryId: journalId,
            accountId: line.accountId,
            lineNumber: index + 1,
            description: line.description ?? null,
            debit: line.debit,
            credit: line.credit,
            balanceAfter: null,
            partyType: line.partyType ?? null,
            partyId: line.partyId ?? null,
            referenceType: line.referenceType ?? null,
            referenceId: line.referenceId ?? null
          })),
          transaction
        );
      }

      const lines = input.lines ? this.normalizeJournalLines(input.lines) : (await accountingRepository.listJournalLines(actor.companyId, journalId, transaction)).map((row) => ({
        accountId: row.line.accountId,
        description: row.line.description,
        debit: normalizeMoney(row.line.debit),
        credit: normalizeMoney(row.line.credit),
        partyType: row.line.partyType ?? null,
        partyId: row.line.partyId ?? null,
        referenceType: row.line.referenceType ?? null,
        referenceId: row.line.referenceId ?? null
      }));
      const totals = assertBalanced(lines);

      const journal = await accountingRepository.updateJournal(
        actor.companyId,
        journalId,
        {
          financialYearId: input.financialYearId === undefined ? existing.financialYearId : input.financialYearId,
          entryDate: nextEntryDate,
          voucherType: input.voucherType ?? existing.voucherType,
          referenceType: input.referenceType === undefined ? existing.referenceType : input.referenceType,
          referenceId: input.referenceId === undefined ? existing.referenceId : input.referenceId,
          referenceNumber: input.referenceNumber === undefined ? existing.referenceNumber : input.referenceNumber,
          description: input.description?.trim() ?? existing.description,
          totalDebit: totals.totalDebit,
          totalCredit: totals.totalCredit,
          updatedBy: actor.id
        },
        transaction
      );

      if (!journal) {
        throw new AppError("Failed to update journal entry", 500);
      }

      return journal;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "journal_updated",
      entityType: "journal_entry",
      entityId: updated.id,
      metadata: {
        journalNumber: updated.journalNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getJournal({ companyId: actor.companyId }, updated.id);
  }

  public async postJournal(actor: AccountingActor, journalId: string, input: PostJournalInput, context: AccountingRequestContext) {
    const journal = await db.transaction((transaction) =>
      this.finalizeJournalPosting(actor, journalId, input.entryDate ?? null, transaction)
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "journal_posted",
      entityType: "journal_entry",
      entityId: journal.id,
      metadata: {
        journalNumber: journal.journalNumber
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getJournal({ companyId: actor.companyId }, journal.id);
  }

  public async cancelJournal(actor: AccountingActor, journalId: string, input: CancelOrReverseJournalInput, context: AccountingRequestContext) {
    const result = await db.transaction(async (transaction) => {
      const journal = await accountingRepository.findJournalById(actor.companyId, journalId, transaction);
      if (!journal) {
        throw new AppError("Journal entry not found", 404);
      }

      if (journal.status === "cancelled") {
        throw new AppError("Journal entry is already cancelled", 400);
      }

      if (journal.status === "draft") {
        const updated = await accountingRepository.updateJournal(
          actor.companyId,
          journal.id,
          {
            status: "cancelled",
            cancelledAt: new Date(),
            updatedBy: actor.id
          },
          transaction
        );

        if (!updated) {
          throw new AppError("Failed to cancel journal entry", 500);
        }

        return {
          kind: "cancelled" as const,
          journalId: updated.id
        };
      }

      if (journal.status !== "posted") {
        throw new AppError("Only draft or posted journals can be cancelled", 400);
      }

      const reversal = await this.buildReversalJournal(actor, journal.id, input.reason, input.reversalDate ?? null, transaction);
      return {
        kind: "reversed" as const,
        journalId: reversal.id
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: result.kind === "cancelled" ? "journal_cancelled" : "journal_reversed",
      entityType: "journal_entry",
      entityId: result.journalId,
      metadata: {
        sourceJournalId: journalId
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getJournal({ companyId: actor.companyId }, result.journalId);
  }

  public async reverseJournal(actor: AccountingActor, journalId: string, input: CancelOrReverseJournalInput, context: AccountingRequestContext) {
    const journal = await db.transaction((transaction) =>
      this.buildReversalJournal(actor, journalId, input.reason, input.reversalDate ?? null, transaction)
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "journal_reversed",
      entityType: "journal_entry",
      entityId: journal.id,
      metadata: {
        sourceJournalId: journalId
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return this.getJournal({ companyId: actor.companyId }, journal.id);
  }

  private async buildLedgerPayload(
    actor: AccountingActor,
    label: string,
    normalBalance: "debit" | "credit",
    openingTotals: { debit: string; credit: string },
    rows: Array<{
      journal: Awaited<ReturnType<typeof accountingRepository.listLedgerRows>>[number]["journal"];
      line: Awaited<ReturnType<typeof accountingRepository.listLedgerRows>>[number]["line"];
      account: Awaited<ReturnType<typeof accountingRepository.listLedgerRows>>[number]["account"];
    }>,
    query: LedgerQuery,
    auditAction: string,
    context: AccountingRequestContext
  ) {
    const pagination = getPagination(query.page, query.limit);
    const openingBalance = calculateAccountBalanceByNormalSide(normalBalance, openingTotals.debit, openingTotals.credit);
    const openingSplit = splitBalanceBySide(openingBalance, normalBalance);
    const runningBalances = calculateRunningBalance(
      openingBalance,
      normalBalance,
      rows.map((row) => ({ debit: normalizeMoney(row.line.debit), credit: normalizeMoney(row.line.credit) }))
    );
    const pagedRows = rows.slice(pagination.offset, pagination.offset + pagination.limit);
    const pagedRunning = runningBalances.slice(pagination.offset, pagination.offset + pagination.limit);
    const closingBalance = runningBalances.at(-1) ?? openingBalance;
    const closingSplit = splitBalanceBySide(closingBalance, normalBalance);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: auditAction,
      entityType: "ledger",
      metadata: {
        label,
        rowCount: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      label,
      openingBalance: {
        amount: openingSplit.amount,
        side: openingSplit.side
      },
      rows: pagedRows.map((row, index) => ({
        journalId: row.journal.id,
        journalNumber: row.journal.journalNumber,
        entryDate: row.journal.entryDate,
        createdAt: row.journal.createdAt,
        lineNumber: row.line.lineNumber,
        voucherType: row.journal.voucherType,
        referenceType: row.journal.referenceType,
        referenceId: row.journal.referenceId,
        referenceNumber: row.journal.referenceNumber,
        description: row.line.description ?? row.journal.description,
        debit: normalizeMoney(row.line.debit),
        credit: normalizeMoney(row.line.credit),
        runningBalance: splitBalanceBySide(pagedRunning[index], normalBalance)
      })),
      closingBalance: {
        amount: closingSplit.amount,
        side: closingSplit.side
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: rows.length,
        totalPages: Math.ceil(rows.length / pagination.limit) || 1
      }
    };
  }

  public async getLedger(actor: AccountingActor, accountId: string, query: LedgerQuery, context: AccountingRequestContext) {
    const dateFrom = this.toDate(query.dateFrom, "dateFrom");
    const dateTo = this.toDate(query.dateTo, "dateTo");
    const account = await accountingRepository.findAccountById(actor.companyId, accountId);
    if (!account) {
      throw new AppError("Account not found", 404);
    }

    const [openingTotals, rows] = await Promise.all([
      accountingRepository.getLedgerTotalsBeforeDate(actor.companyId, accountId, dateFrom),
      accountingRepository.listLedgerRows(actor.companyId, accountId, dateFrom, dateTo)
    ]);

    return this.buildLedgerPayload(
      actor,
      `${account.accountCode} - ${account.accountName}`,
      account.normalBalance,
      openingTotals,
      rows,
      { ...query, dateFrom, dateTo },
      "ledger_viewed",
      context
    );
  }

  public async getPartyLedger(
    actor: AccountingActor,
    partyType: JournalPartyType,
    partyId: string,
    query: LedgerQuery,
    context: AccountingRequestContext
  ) {
    const dateFrom = this.toDate(query.dateFrom, "dateFrom");
    const dateTo = this.toDate(query.dateTo, "dateTo");
    const party =
      partyType === "customer"
        ? await customersRepository.findById(actor.companyId, partyId)
        : await suppliersRepository.findById(actor.companyId, partyId);

    if (!party) {
      throw new AppError(`${partyType === "customer" ? "Customer" : "Supplier"} not found`, 404);
    }

    const normalBalance = partyType === "customer" ? "debit" : "credit";
    const [openingTotals, rows] = await Promise.all([
      accountingRepository.getPartyLedgerTotalsBeforeDate(actor.companyId, partyType, partyId, dateFrom),
      accountingRepository.listPartyLedgerRows(actor.companyId, partyType, partyId, dateFrom, dateTo)
    ]);

    return this.buildLedgerPayload(
      actor,
      `${partyType === "customer" ? "Customer" : "Supplier"} ${party.name}`,
      normalBalance,
      openingTotals,
      rows,
      { ...query, dateFrom, dateTo },
      "ledger_viewed",
      context
    );
  }

  public async getCashBook(actor: AccountingActor, query: BookQuery, context: AccountingRequestContext) {
    const dateFrom = this.toDate(query.dateFrom, "dateFrom");
    const dateTo = this.toDate(query.dateTo, "dateTo");
    const cashAccount = await this.getSystemAccount(actor.companyId, "cash");
    const rows = await accountingRepository.listBookRows(actor.companyId, "cash", dateFrom, dateTo);
    const openingTotals = await accountingRepository.getLedgerTotalsBeforeDate(actor.companyId, cashAccount.id, dateFrom);

    return this.buildLedgerPayload(
      actor,
      "Cash Book",
      cashAccount.normalBalance,
      openingTotals,
      rows,
      { ...query, dateFrom, dateTo },
      "ledger_viewed",
      context
    );
  }

  public async getBankBook(actor: AccountingActor, query: BookQuery, context: AccountingRequestContext) {
    const dateFrom = this.toDate(query.dateFrom, "dateFrom");
    const dateTo = this.toDate(query.dateTo, "dateTo");
    const bankAccount = await this.getSystemAccount(actor.companyId, "bank");
    const rows = await accountingRepository.listBookRows(actor.companyId, "bank", dateFrom, dateTo, query.bankAccountId);
    const openingTotals = await accountingRepository.getLedgerTotalsBeforeDate(actor.companyId, bankAccount.id, dateFrom);

    return this.buildLedgerPayload(
      actor,
      "Bank Book",
      bankAccount.normalBalance,
      openingTotals,
      rows,
      { ...query, dateFrom, dateTo },
      "ledger_viewed",
      context
    );
  }

  public async getTrialBalance(actor: AccountingActor, query: TrialBalanceQuery, context: AccountingRequestContext) {
    const range = await this.buildDateRangeFromTrialOrProfitQuery(actor.companyId, query);
    const openingRows =
      range.dateFrom.getTime() <= range.dateTo.getTime()
        ? await accountingRepository.getGroupedAccountLineTotals(actor.companyId, {
            dateTo: this.previousDate(range.dateFrom)
          })
        : [];
    const periodRows = await accountingRepository.getGroupedAccountLineTotals(actor.companyId, {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo
    });
    const accountRows = await accountingRepository.listAccounts({ companyId: actor.companyId });

    const openingMap = new Map(openingRows.map((row) => [row.accountId, row]));
    const periodMap = new Map(periodRows.map((row) => [row.accountId, row]));
    const merged = accountRows.rows.map((account) => {
      const opening = openingMap.get(account.id);
      const period = periodMap.get(account.id);
      const openingBalance = calculateAccountBalanceByNormalSide(account.normalBalance, opening?.debit ?? "0.00", opening?.credit ?? "0.00");
      const periodBalance = calculateAccountBalanceByNormalSide(account.normalBalance, period?.debit ?? "0.00", period?.credit ?? "0.00");
      const closingBalance = addMoney(openingBalance, periodBalance);
      return {
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
        openingBalance,
        periodDebit: normalizeMoney(period?.debit ?? "0.00"),
        periodCredit: normalizeMoney(period?.credit ?? "0.00"),
        closingBalance
      };
    });

    const trialBalance = calculateTrialBalance(merged.map((row) => ({ closingBalance: row.closingBalance, normalBalance: row.normalBalance })));

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "trial_balance_viewed",
      entityType: "report",
      metadata: {
        dateFrom: range.dateFrom.toISOString(),
        dateTo: range.dateTo.toISOString()
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      items: merged.map((row, index) => ({
        ...row,
        openingBalance: splitBalanceBySide(row.openingBalance, row.normalBalance),
        closingBalance: splitBalanceBySide(row.closingBalance, row.normalBalance),
        debit: trialBalance.items[index]?.debit ?? "0.00",
        credit: trialBalance.items[index]?.credit ?? "0.00"
      })),
      totals: trialBalance.totals
    };
  }

  public async getProfitLoss(actor: AccountingActor, query: ProfitLossQuery, context: AccountingRequestContext) {
    const range = await this.buildDateRangeFromTrialOrProfitQuery(actor.companyId, query);
    const rows = await accountingRepository.getGroupedAccountLineTotals(actor.companyId, {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      accountTypes: ["income", "expense"]
    });

    const items = rows.map((row) => ({
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      accountType: row.accountType,
      amount: calculateAccountBalanceByNormalSide(row.normalBalance, row.debit, row.credit)
    }));
    const summary = calculateProfitLoss(items.map((item) => ({ accountType: item.accountType, balance: item.amount })));

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "profit_loss_viewed",
      entityType: "report",
      metadata: {
        dateFrom: range.dateFrom.toISOString(),
        dateTo: range.dateTo.toISOString()
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      items,
      totals: summary
    };
  }

  public async getBalanceSheet(actor: AccountingActor, query: BalanceSheetQuery, context: AccountingRequestContext) {
    const asOfDate = query.asOfDate ? this.toDate(query.asOfDate, "asOfDate") : new Date();
    const year = query.financialYearId
      ? await accountingRepository.findFinancialYearById(actor.companyId, query.financialYearId)
      : await this.getFinancialYearForDate(actor.companyId, asOfDate);
    const rows = await accountingRepository.getGroupedAccountLineTotals(actor.companyId, {
      dateTo: asOfDate,
      accountTypes: ["asset", "liability", "equity"]
    });

    const grouped = {
      assets: [] as Array<Record<string, unknown>>,
      liabilities: [] as Array<Record<string, unknown>>,
      equity: [] as Array<Record<string, unknown>>
    };
    let assetTotal = "0.00";
    let liabilityTotal = "0.00";
    let equityTotal = "0.00";

    for (const row of rows) {
      const amount = calculateAccountBalanceByNormalSide(row.normalBalance, row.debit, row.credit);
      const split = splitBalanceBySide(amount, row.normalBalance);
      const item = {
        accountId: row.accountId,
        accountCode: row.accountCode,
        accountName: row.accountName,
        amount: split.amount,
        side: split.side
      };

      if (row.accountType === "asset") {
        grouped.assets.push(item);
        assetTotal = addMoney(assetTotal, split.amount);
      } else if (row.accountType === "liability") {
        grouped.liabilities.push(item);
        liabilityTotal = addMoney(liabilityTotal, split.amount);
      } else {
        grouped.equity.push(item);
        equityTotal = addMoney(equityTotal, split.amount);
      }
    }

    const currentProfitLoss = year
      ? (await this.getProfitLoss(actor, { financialYearId: year.id }, context)).totals.netProfitLoss
      : "0.00";
    const sheet = calculateBalanceSheet({
      assetTotal,
      liabilityTotal,
      equityTotal,
      currentProfitLoss
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "balance_sheet_viewed",
      entityType: "report",
      metadata: {
        asOfDate: asOfDate.toISOString()
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      asOfDate,
      financialYearId: year?.id ?? null,
      assets: grouped.assets,
      liabilities: grouped.liabilities,
      equity: grouped.equity,
      totals: sheet
    };
  }

  public async listEvents(actor: AccountingActor, query: ListAccountingEventsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await accountingRepository.listEvents({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      status: query.status,
      eventType: query.eventType ?? null,
      referenceType: query.referenceType ?? null
    });

    return {
      items: result.rows,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async postEvent(actor: AccountingActor, eventId: string, context: AccountingRequestContext) {
    const processed = await db.transaction((transaction) => this.processEvent(actor, eventId, transaction));

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: processed.status === "posted" ? "accounting_event_posted" : "accounting_event_failed",
      entityType: "accounting_event",
      entityId: eventId,
      metadata: {
        journalEntryId: processed.journalEntryId,
        status: processed.status
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return processed;
  }

  public async postEventInTransaction(actor: AccountingActor, eventId: string, executor: TransactionClient) {
    return this.processEvent(actor, eventId, executor);
  }

  private async processEvent(actor: AccountingActor, eventId: string, transaction: TransactionClient) {
    const event = await accountingRepository.findEventById(actor.companyId, eventId, transaction);
    if (!event) {
      throw new AppError("Accounting event not found", 404);
    }

    if (event.status === "posted") {
      return {
        event,
        journalEntryId: event.journalEntryId,
        status: "posted" as const
      };
    }

    try {
      const mapped = await this.mapEventToJournal(actor, event, transaction);
      if (mapped.kind === "ignored") {
        const updated = await accountingRepository.updateEvent(
          actor.companyId,
          event.id,
          {
            status: "ignored",
            errorMessage: mapped.message,
            postedAt: new Date()
          },
          transaction
        );

        return {
          event: updated ?? event,
          journalEntryId: null,
          status: "ignored" as const
        };
      }

      if (mapped.kind === "reversal") {
        const journal = await this.buildReversalJournal(actor, mapped.sourceJournalId, mapped.reason, mapped.entryDate, transaction);
        const updated = await accountingRepository.updateEvent(
          actor.companyId,
          event.id,
          {
            status: "posted",
            journalEntryId: journal.id,
            errorMessage: null,
            postedAt: new Date()
          },
          transaction
        );

        return {
          event: updated ?? event,
          journalEntryId: journal.id,
          status: "posted" as const
        };
      }

      const journal = await this.createAndPostJournal(
        actor,
        {
          financialYearId: mapped.financialYearId ?? null,
          entryDate: mapped.entryDate,
          voucherType: mapped.voucherType,
          referenceType: mapped.referenceType,
          referenceId: mapped.referenceId,
          referenceNumber: mapped.referenceNumber,
          description: mapped.description,
          lines: mapped.lines
        },
        transaction
      );

      const updated = await accountingRepository.updateEvent(
        actor.companyId,
        event.id,
        {
          status: "posted",
          journalEntryId: journal.id,
          errorMessage: null,
          postedAt: new Date()
        },
        transaction
      );

      return {
        event: updated ?? event,
        journalEntryId: journal.id,
        status: "posted" as const
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Accounting event processing failed";
      await accountingRepository.updateEvent(
        actor.companyId,
        event.id,
        {
          status: "failed",
          errorMessage: message
        },
        transaction
      );
      throw error;
    }
  }

  public async postPendingEvents(actor: AccountingActor, input: PostPendingAccountingEventsInput, context: AccountingRequestContext) {
    const events = await accountingRepository.listPendingEvents(actor.companyId, input.limit);
    let posted = 0;
    let failed = 0;
    let ignored = 0;

    for (const event of events) {
      try {
        const result = await this.postEvent(actor, event.id, context);
        if (result.status === "posted") {
          posted += 1;
        } else {
          ignored += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      total: events.length,
      posted,
      failed,
      ignored
    };
  }

  public async listPeriodLocks(actor: AccountingActor, query: ListFinancialPeriodLocksQuery) {
    const rows = await accountingRepository.listPeriodLocks({
      companyId: actor.companyId,
      financialYearId: query.financialYearId,
      isLocked: query.isLocked
    });

    return {
      items: rows
    };
  }

  public async createPeriodLock(actor: AccountingActor, input: CreateFinancialPeriodLockInput, context: AccountingRequestContext) {
    const created = await accountingRepository.createPeriodLock({
      companyId: actor.companyId,
      financialYearId: input.financialYearId ?? null,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      lockType: input.lockType,
      isLocked: true,
      lockedBy: actor.id,
      lockedAt: new Date(),
      reason: input.reason ?? null
    });

    if (!created) {
      throw new AppError("Failed to create financial period lock", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "period_locked",
      entityType: "financial_period_lock",
      entityId: created.id,
      metadata: {
        lockType: created.lockType
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      periodLock: created
    };
  }

  public async deletePeriodLock(actor: AccountingActor, lockId: string, context: AccountingRequestContext) {
    const removed = await accountingRepository.deletePeriodLock(actor.companyId, lockId);
    if (!removed) {
      throw new AppError("Financial period lock not found", 404);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "period_unlocked",
      entityType: "financial_period_lock",
      entityId: removed.id,
      metadata: {
        lockType: removed.lockType
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      periodLock: removed
    };
  }

  public async exportLedger(actor: AccountingActor, accountId: string, query: ExportLedgerQuery, context: AccountingRequestContext): Promise<ExportPayload> {
    this.ensureCsvFormat(query.format);
    const ledger = await this.getLedger(actor, accountId, query, context);
    const content = buildCsvBuffer(
      ["Date", "Journal No", "Voucher", "Description", "Debit", "Credit", "Running Balance", "Balance Side"],
      ledger.rows.map((row) => [
        row.entryDate.toISOString().slice(0, 10),
        row.journalNumber,
        row.voucherType,
        row.description ?? "",
        row.debit,
        row.credit,
        row.runningBalance.amount,
        row.runningBalance.side
      ])
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "ledger_exported",
      entityType: "ledger",
      metadata: {
        accountId
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      fileName: `ledger-${accountId}-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async exportTrialBalance(actor: AccountingActor, query: ExportTrialBalanceQuery, context: AccountingRequestContext): Promise<ExportPayload> {
    this.ensureCsvFormat(query.format);
    const report = await this.getTrialBalance(actor, query, context);
    const content = buildCsvBuffer(
      ["Code", "Account", "Type", "Opening", "Opening Side", "Debit", "Credit", "Closing", "Closing Side"],
      report.items.map((row) => [
        row.accountCode,
        row.accountName,
        row.accountType,
        row.openingBalance.amount,
        row.openingBalance.side,
        row.debit,
        row.credit,
        row.closingBalance.amount,
        row.closingBalance.side
      ])
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "trial_balance_exported",
      entityType: "report",
      metadata: {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      fileName: `trial-balance-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async exportProfitLoss(actor: AccountingActor, query: ExportProfitLossQuery, context: AccountingRequestContext): Promise<ExportPayload> {
    this.ensureCsvFormat(query.format);
    const report = await this.getProfitLoss(actor, query, context);
    const content = buildCsvBuffer(
      ["Code", "Account", "Type", "Amount"],
      report.items.map((row) => [row.accountCode, row.accountName, row.accountType, row.amount])
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "profit_loss_exported",
      entityType: "report",
      metadata: {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      fileName: `profit-loss-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }

  public async exportBalanceSheet(actor: AccountingActor, query: ExportBalanceSheetQuery, context: AccountingRequestContext): Promise<ExportPayload> {
    this.ensureCsvFormat(query.format);
    const report = await this.getBalanceSheet(actor, query, context);
    const content = buildCsvBuffer(
      ["Section", "Code", "Account", "Amount", "Side"],
      [
        ...report.assets.map((row) => ["asset", String(row.accountCode ?? ""), String(row.accountName ?? ""), String(row.amount ?? ""), String(row.side ?? "")]),
        ...report.liabilities.map((row) => ["liability", String(row.accountCode ?? ""), String(row.accountName ?? ""), String(row.amount ?? ""), String(row.side ?? "")]),
        ...report.equity.map((row) => ["equity", String(row.accountCode ?? ""), String(row.accountName ?? ""), String(row.amount ?? ""), String(row.side ?? "")])
      ]
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "balance_sheet_exported",
      entityType: "report",
      metadata: {},
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      fileName: `balance-sheet-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content
    };
  }
}

export const accountingService = new AccountingService();
