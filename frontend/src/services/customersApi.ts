import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  CustomerBlacklistUpdateInput,
  CustomerCreatePayload,
  CustomerDetailResponse,
  CustomerExportFormat,
  CustomerLedgerQuery,
  CustomerLedgerResponse,
  CustomerListQuery,
  CustomerListResponse,
  CustomerMutableStatus,
  CustomerOutstandingSummary,
  CustomerPaymentsQuery,
  CustomerPaymentsResponse,
  CustomerUpdatePayload,
  DownloadFileResult,
} from "../types/customer";

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

export const customersApi = {
  list: async (query: CustomerListQuery) =>
    (
      await client.get<ApiResponse<CustomerListResponse>>("/customers", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          customerType: query.customerType || undefined,
          taxType: query.taxType || undefined,
          hasOutstanding: query.hasOutstanding,
          isBlacklisted: query.isBlacklisted,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        },
      })
    ).data,

  create: async (payload: CustomerCreatePayload) =>
    (await client.post<ApiResponse<CustomerDetailResponse>>("/customers", payload)).data,

  get: async (customerId: string) =>
    (await client.get<ApiResponse<CustomerDetailResponse>>(`/customers/${customerId}`)).data,

  update: async (customerId: string, payload: CustomerUpdatePayload) =>
    (await client.patch<ApiResponse<CustomerDetailResponse>>(`/customers/${customerId}`, payload)).data,

  remove: async (customerId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/customers/${customerId}`)).data,

  updateStatus: async (customerId: string, status: CustomerMutableStatus) =>
    (await client.patch<ApiResponse<{ customer: CustomerDetailResponse["customer"] }>>(`/customers/${customerId}/status`, { status }))
      .data,

  updateBlacklist: async (customerId: string, payload: CustomerBlacklistUpdateInput) =>
    (await client.patch<ApiResponse<{ customer: CustomerDetailResponse["customer"] }>>(`/customers/${customerId}/blacklist`, payload))
      .data,

  getLedger: async (customerId: string, query: CustomerLedgerQuery) =>
    (
      await client.get<ApiResponse<CustomerLedgerResponse>>(`/customers/${customerId}/ledger`, {
        params: {
          page: query.page,
          limit: query.limit,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          transactionType: query.transactionType || undefined,
        },
      })
    ).data,

  getPayments: async (customerId: string, query: CustomerPaymentsQuery) =>
    (
      await client.get<ApiResponse<CustomerPaymentsResponse>>(`/customers/${customerId}/payments`, {
        params: {
          page: query.page,
          limit: query.limit,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  getOutstanding: async (customerId: string) =>
    (await client.get<ApiResponse<CustomerOutstandingSummary>>(`/customers/${customerId}/outstanding`)).data,

  exportList: async (query: CustomerListQuery & { format?: CustomerExportFormat }) =>
    extractDownload(
      client.get("/customers/export", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          customerType: query.customerType || undefined,
          taxType: query.taxType || undefined,
          hasOutstanding: query.hasOutstanding,
          isBlacklisted: query.isBlacklisted,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          format: query.format ?? "pdf",
        },
        responseType: "blob",
      }),
      `customers.${query.format ?? "pdf"}`,
    ),

  exportLedger: async (
    customerId: string,
    query: Omit<CustomerLedgerQuery, "page" | "limit"> & { format?: CustomerExportFormat },
  ) =>
    extractDownload(
      client.get(`/customers/${customerId}/ledger/export`, {
        params: {
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          transactionType: query.transactionType || undefined,
          format: query.format ?? "pdf",
        },
        responseType: "blob",
      }),
      `customer-ledger-${customerId}.${query.format ?? "pdf"}`,
    ),
};
