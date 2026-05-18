import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  Account,
  AccountingEventsResponse,
  AccountingExportFormat,
  BalanceSheetQuery,
  BalanceSheetReport,
  BookQuery,
  CancelOrReverseJournalInput,
  CreateAccountInput,
  CreateFinancialPeriodLockInput,
  CreateJournalInput,
  CreateOpeningBalancesInput,
  DownloadFileResult,
  JournalDetailResponse,
  JournalsResponse,
  LedgerQuery,
  LedgerResponse,
  ListAccountsQuery,
  ListAccountingEventsQuery,
  ListFinancialPeriodLocksQuery,
  ListJournalsQuery,
  ListOpeningBalancesQuery,
  OpeningBalanceListResponse,
  PeriodLock,
  PeriodLocksResponse,
  PostJournalInput,
  PostPendingEventsResult,
  ProfitLossQuery,
  ProfitLossReport,
  TrialBalanceQuery,
  TrialBalanceResponse,
  UpdateAccountInput,
  UpdateJournalInput,
  UpdateOpeningBalanceInput,
} from "../types/accounting";

const getFileNameFromDisposition = (contentDisposition: string | undefined, fallback: string) => {
  if (!contentDisposition) {
    return fallback;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
};

const extractDownload = async (
  request: Promise<AxiosResponse<Blob>>,
  fallbackFileName: string,
): Promise<DownloadFileResult> => {
  const response = await request;

  return {
    blob: response.data,
    fileName: getFileNameFromDisposition(response.headers["content-disposition"], fallbackFileName),
    contentType:
      typeof response.headers["content-type"] === "string"
        ? response.headers["content-type"]
        : "application/octet-stream",
  };
};

const buildDateRangeParams = (query: { dateFrom?: string; dateTo?: string }) => ({
  dateFrom: query.dateFrom || undefined,
  dateTo: query.dateTo || undefined,
});

export const accountingApi = {
  listAccounts: async (query: ListAccountsQuery) =>
    (
      await client.get<ApiResponse<{ items: Account[]; pagination: JournalsResponse["pagination"] }>>("/accounting/accounts", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          type: query.type || undefined,
          status: query.status || undefined,
          parentId: query.parentId || undefined,
          hierarchy: query.hierarchy || undefined,
        },
      })
    ).data,

  createAccount: async (payload: CreateAccountInput) =>
    (await client.post<ApiResponse<{ account: Account }>>("/accounting/accounts", payload)).data,

  updateAccount: async (accountId: string, payload: UpdateAccountInput) =>
    (await client.patch<ApiResponse<{ account: Account }>>(`/accounting/accounts/${accountId}`, payload)).data,

  removeAccount: async (accountId: string) =>
    (await client.delete<ApiResponse<{ account: Account; deactivated: boolean }>>(`/accounting/accounts/${accountId}`)).data,

  seedDefaultAccounts: async () =>
    (await client.post<ApiResponse<{ createdIds: string[]; existingIds: string[] }>>("/accounting/accounts/defaults", {})).data,

  listOpeningBalances: async (query: ListOpeningBalancesQuery) =>
    (
      await client.get<ApiResponse<OpeningBalanceListResponse>>("/accounting/opening-balances", {
        params: {
          page: query.page,
          limit: query.limit,
          accountId: query.accountId || undefined,
          financialYearId: query.financialYearId || undefined,
          isLocked: query.isLocked,
          ...buildDateRangeParams(query),
        },
      })
    ).data,

  createOpeningBalances: async (payload: CreateOpeningBalancesInput) =>
    (await client.post<ApiResponse<{ items: Array<{ openingBalanceId: string; journalId: string }> }>>("/accounting/opening-balances", payload))
      .data,

  updateOpeningBalance: async (openingBalanceId: string, payload: UpdateOpeningBalanceInput) =>
    (await client.patch<ApiResponse<{ openingBalance: unknown; journalId: string }>>(`/accounting/opening-balances/${openingBalanceId}`, payload))
      .data,

  lockOpeningBalances: async (ids: string[]) =>
    (await client.post<ApiResponse<{ count: number }>>("/accounting/opening-balances/lock", { ids })).data,

  listJournals: async (query: ListJournalsQuery) =>
    (
      await client.get<ApiResponse<JournalsResponse>>("/accounting/journals", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          voucherType: query.voucherType || undefined,
          status: query.status || undefined,
          referenceType: query.referenceType || undefined,
          financialYearId: query.financialYearId || undefined,
          ...buildDateRangeParams(query),
        },
      })
    ).data,

  createJournal: async (payload: CreateJournalInput) =>
    (await client.post<ApiResponse<JournalDetailResponse>>("/accounting/journals", payload)).data,

  getJournal: async (journalId: string) =>
    (await client.get<ApiResponse<JournalDetailResponse>>(`/accounting/journals/${journalId}`)).data,

  updateJournal: async (journalId: string, payload: UpdateJournalInput) =>
    (await client.patch<ApiResponse<JournalDetailResponse>>(`/accounting/journals/${journalId}`, payload)).data,

  postJournal: async (journalId: string, payload?: PostJournalInput) =>
    (await client.post<ApiResponse<JournalDetailResponse>>(`/accounting/journals/${journalId}/post`, payload ?? {})).data,

  cancelJournal: async (journalId: string, payload: CancelOrReverseJournalInput) =>
    (await client.post<ApiResponse<JournalDetailResponse>>(`/accounting/journals/${journalId}/cancel`, payload)).data,

  reverseJournal: async (journalId: string, payload: CancelOrReverseJournalInput) =>
    (await client.post<ApiResponse<JournalDetailResponse>>(`/accounting/journals/${journalId}/reverse`, payload)).data,

  getLedger: async (accountId: string, query: LedgerQuery) =>
    (
      await client.get<ApiResponse<LedgerResponse>>(`/accounting/ledger/${accountId}`, {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateRangeParams(query),
        },
      })
    ).data,

  getCustomerLedger: async (customerId: string, query: LedgerQuery) =>
    (
      await client.get<ApiResponse<LedgerResponse>>(`/accounting/ledger/customer/${customerId}`, {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateRangeParams(query),
        },
      })
    ).data,

  getSupplierLedger: async (supplierId: string, query: LedgerQuery) =>
    (
      await client.get<ApiResponse<LedgerResponse>>(`/accounting/ledger/supplier/${supplierId}`, {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateRangeParams(query),
        },
      })
    ).data,

  exportLedger: async (accountId: string, query: LedgerQuery & { format?: AccountingExportFormat }) =>
    extractDownload(
      client.get(`/accounting/ledger/${accountId}/export`, {
        params: {
          page: query.page,
          limit: query.limit,
          format: query.format ?? "csv",
          ...buildDateRangeParams(query),
        },
        responseType: "blob",
      }),
      `ledger-${accountId}.csv`,
    ),

  getCashBook: async (query: BookQuery) =>
    (
      await client.get<ApiResponse<LedgerResponse>>("/accounting/cash-book", {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateRangeParams(query),
        },
      })
    ).data,

  getBankBook: async (query: BookQuery) =>
    (
      await client.get<ApiResponse<LedgerResponse>>("/accounting/bank-book", {
        params: {
          page: query.page,
          limit: query.limit,
          bankAccountId: query.bankAccountId || undefined,
          ...buildDateRangeParams(query),
        },
      })
    ).data,

  getTrialBalance: async (query: TrialBalanceQuery) =>
    (
      await client.get<ApiResponse<TrialBalanceResponse>>("/accounting/trial-balance", {
        params: {
          financialYearId: query.financialYearId || undefined,
          ...buildDateRangeParams(query),
        },
      })
    ).data,

  exportTrialBalance: async (query: TrialBalanceQuery & { format?: AccountingExportFormat }) =>
    extractDownload(
      client.get("/accounting/trial-balance/export", {
        params: {
          financialYearId: query.financialYearId || undefined,
          format: query.format ?? "csv",
          ...buildDateRangeParams(query),
        },
        responseType: "blob",
      }),
      "trial-balance.csv",
    ),

  getProfitLoss: async (query: ProfitLossQuery) =>
    (
      await client.get<ApiResponse<ProfitLossReport>>("/accounting/profit-loss", {
        params: {
          financialYearId: query.financialYearId || undefined,
          ...buildDateRangeParams(query),
        },
      })
    ).data,

  exportProfitLoss: async (query: ProfitLossQuery & { format?: AccountingExportFormat }) =>
    extractDownload(
      client.get("/accounting/profit-loss/export", {
        params: {
          financialYearId: query.financialYearId || undefined,
          format: query.format ?? "csv",
          ...buildDateRangeParams(query),
        },
        responseType: "blob",
      }),
      "profit-loss.csv",
    ),

  getBalanceSheet: async (query: BalanceSheetQuery) =>
    (
      await client.get<ApiResponse<BalanceSheetReport>>("/accounting/balance-sheet", {
        params: {
          asOfDate: query.asOfDate || undefined,
          financialYearId: query.financialYearId || undefined,
        },
      })
    ).data,

  exportBalanceSheet: async (query: BalanceSheetQuery & { format?: AccountingExportFormat }) =>
    extractDownload(
      client.get("/accounting/balance-sheet/export", {
        params: {
          asOfDate: query.asOfDate || undefined,
          financialYearId: query.financialYearId || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "balance-sheet.csv",
    ),

  listEvents: async (query: ListAccountingEventsQuery) =>
    (
      await client.get<ApiResponse<AccountingEventsResponse>>("/accounting/events", {
        params: {
          page: query.page,
          limit: query.limit,
          status: query.status || undefined,
          eventType: query.eventType || undefined,
          referenceType: query.referenceType || undefined,
        },
      })
    ).data,

  postEvent: async (eventId: string) =>
    (await client.post<ApiResponse<{ event: unknown; journalEntryId: string | null; status: string }>>(`/accounting/events/${eventId}/post`, {})).data,

  postPendingEvents: async (limit = 50) =>
    (await client.post<ApiResponse<PostPendingEventsResult>>("/accounting/events/post-pending", { limit })).data,

  listPeriodLocks: async (query: ListFinancialPeriodLocksQuery) =>
    (
      await client.get<ApiResponse<PeriodLocksResponse>>("/accounting/period-locks", {
        params: {
          financialYearId: query.financialYearId || undefined,
          isLocked: query.isLocked,
        },
      })
    ).data,

  createPeriodLock: async (payload: CreateFinancialPeriodLockInput) =>
    (await client.post<ApiResponse<{ periodLock: PeriodLock }>>("/accounting/period-locks", payload)).data,

  removePeriodLock: async (periodLockId: string) =>
    (await client.delete<ApiResponse<{ periodLock: PeriodLock }>>(`/accounting/period-locks/${periodLockId}`)).data,
};
