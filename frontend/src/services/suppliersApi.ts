import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  DownloadFileResult,
  SupplierBlacklistUpdateInput,
  SupplierCreatePayload,
  SupplierDetailResponse,
  SupplierExportFormat,
  SupplierLedgerQuery,
  SupplierLedgerResponse,
  SupplierListQuery,
  SupplierListResponse,
  SupplierMutableStatus,
  SupplierOutstandingSummary,
  SupplierPaymentsQuery,
  SupplierPaymentsResponse,
  SupplierPreferredUpdateInput,
  SupplierPurchasesQuery,
  SupplierPurchasesResponse,
  SupplierUpdatePayload,
} from "../types/supplier";

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

export const suppliersApi = {
  list: async (query: SupplierListQuery) =>
    (
      await client.get<ApiResponse<SupplierListResponse>>("/suppliers", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          supplierType: query.supplierType || undefined,
          taxType: query.taxType || undefined,
          hasOutstanding: query.hasOutstanding,
          isBlacklisted: query.isBlacklisted,
          isPreferred: query.isPreferred,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        },
      })
    ).data,

  create: async (payload: SupplierCreatePayload) =>
    (await client.post<ApiResponse<SupplierDetailResponse>>("/suppliers", payload)).data,

  get: async (supplierId: string) =>
    (await client.get<ApiResponse<SupplierDetailResponse>>(`/suppliers/${supplierId}`)).data,

  update: async (supplierId: string, payload: SupplierUpdatePayload) =>
    (await client.patch<ApiResponse<SupplierDetailResponse>>(`/suppliers/${supplierId}`, payload)).data,

  remove: async (supplierId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/suppliers/${supplierId}`)).data,

  updateStatus: async (supplierId: string, status: SupplierMutableStatus) =>
    (await client.patch<ApiResponse<{ supplier: SupplierDetailResponse["supplier"] }>>(`/suppliers/${supplierId}/status`, { status }))
      .data,

  updateBlacklist: async (supplierId: string, payload: SupplierBlacklistUpdateInput) =>
    (await client.patch<ApiResponse<{ supplier: SupplierDetailResponse["supplier"] }>>(`/suppliers/${supplierId}/blacklist`, payload))
      .data,

  updatePreferred: async (supplierId: string, payload: SupplierPreferredUpdateInput) =>
    (await client.patch<ApiResponse<{ supplier: SupplierDetailResponse["supplier"] }>>(`/suppliers/${supplierId}/preferred`, payload))
      .data,

  getLedger: async (supplierId: string, query: SupplierLedgerQuery) =>
    (
      await client.get<ApiResponse<SupplierLedgerResponse>>(`/suppliers/${supplierId}/ledger`, {
        params: {
          page: query.page,
          limit: query.limit,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          transactionType: query.transactionType || undefined,
        },
      })
    ).data,

  getPurchases: async (supplierId: string, query: SupplierPurchasesQuery) =>
    (
      await client.get<ApiResponse<SupplierPurchasesResponse>>(`/suppliers/${supplierId}/purchases`, {
        params: {
          page: query.page,
          limit: query.limit,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          status: query.status || undefined,
        },
      })
    ).data,

  getPayments: async (supplierId: string, query: SupplierPaymentsQuery) =>
    (
      await client.get<ApiResponse<SupplierPaymentsResponse>>(`/suppliers/${supplierId}/payments`, {
        params: {
          page: query.page,
          limit: query.limit,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  getOutstanding: async (supplierId: string) =>
    (await client.get<ApiResponse<SupplierOutstandingSummary>>(`/suppliers/${supplierId}/outstanding`)).data,

  exportList: async (query: SupplierListQuery & { format?: SupplierExportFormat }) =>
    extractDownload(
      client.get("/suppliers/export", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          supplierType: query.supplierType || undefined,
          taxType: query.taxType || undefined,
          hasOutstanding: query.hasOutstanding,
          isBlacklisted: query.isBlacklisted,
          isPreferred: query.isPreferred,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          format: query.format ?? "pdf",
        },
        responseType: "blob",
      }),
      `suppliers.${query.format ?? "pdf"}`,
    ),

  exportLedger: async (
    supplierId: string,
    query: Omit<SupplierLedgerQuery, "page" | "limit"> & { format?: SupplierExportFormat },
  ) =>
    extractDownload(
      client.get(`/suppliers/${supplierId}/ledger/export`, {
        params: {
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          transactionType: query.transactionType || undefined,
          format: query.format ?? "pdf",
        },
        responseType: "blob",
      }),
      `supplier-ledger-${supplierId}.${query.format ?? "pdf"}`,
    ),
};
