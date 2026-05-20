import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  SalesBarcodeLookupResponse,
  SalesDetailResponse,
  SalesExportFormat,
  SalesFormInput,
  SalesListQuery,
  SalesListResponse,
  SalesPaymentInput,
  SalesPaymentMutationResponse,
  SalesPaymentsQuery,
  SalesPaymentsResponse,
  SalesReturnDetailResponse,
  SalesReturnInput,
  SalesReturnsListQuery,
  SalesReturnsResponse,
} from "../types/sales";
import type { DownloadFileResult } from "../types/product";

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

export const salesApi = {
  list: async (query: SalesListQuery) =>
    (
      await client.get<ApiResponse<SalesListResponse>>("/sales", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          invoiceStatus: query.invoiceStatus || undefined,
          paymentStatus: query.paymentStatus || undefined,
          customerId: query.customerId || undefined,
          warehouseId: query.warehouseId || undefined,
          invoiceType: query.invoiceType || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  create: async (payload: SalesFormInput) =>
    (await client.post<ApiResponse<SalesDetailResponse>>("/sales", payload)).data,

  createPos: async (payload: SalesFormInput) =>
    (await client.post<ApiResponse<SalesDetailResponse>>("/sales/pos", payload)).data,

  get: async (invoiceId: string) =>
    (await client.get<ApiResponse<SalesDetailResponse>>(`/sales/${invoiceId}`)).data,

  update: async (invoiceId: string, payload: Omit<SalesFormInput, "invoiceType" | "invoiceStatus" | "paidAmount" | "paymentMode" | "paymentReference" | "bankAccountId">) =>
    (await client.patch<ApiResponse<SalesDetailResponse>>(`/sales/${invoiceId}`, payload)).data,

  remove: async (invoiceId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/sales/${invoiceId}`)).data,

  post: async (invoiceId: string) =>
    (await client.post<ApiResponse<SalesDetailResponse>>(`/sales/${invoiceId}/post`)).data,

  cancel: async (invoiceId: string) =>
    (await client.post<ApiResponse<SalesDetailResponse>>(`/sales/${invoiceId}/cancel`)).data,

  exportList: async (query: SalesListQuery & { format?: SalesExportFormat }) =>
    extractDownload(
      client.get("/sales/export", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          invoiceStatus: query.invoiceStatus || undefined,
          paymentStatus: query.paymentStatus || undefined,
          customerId: query.customerId || undefined,
          warehouseId: query.warehouseId || undefined,
          invoiceType: query.invoiceType || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "sales.csv",
    ),

  getPdfFile: async (invoiceId: string) =>
    extractDownload(
      client.get(`/sales/${invoiceId}/pdf`, {
        responseType: "blob",
      }),
      `sales-invoice-${invoiceId}.pdf`,
    ),

  barcodeLookup: async (query: { q: string; warehouseId?: string }) =>
    (
      await client.get<ApiResponse<SalesBarcodeLookupResponse>>("/sales/barcode-lookup", {
        params: {
          q: query.q,
          warehouseId: query.warehouseId || undefined,
        },
      })
    ).data,

  listPayments: async (invoiceId: string, query: SalesPaymentsQuery) =>
    (
      await client.get<ApiResponse<SalesPaymentsResponse>>(`/sales/${invoiceId}/payments`, {
        params: {
          page: query.page,
          limit: query.limit,
        },
      })
    ).data,

  createPayment: async (invoiceId: string, payload: SalesPaymentInput) =>
    (await client.post<ApiResponse<SalesPaymentMutationResponse>>(`/sales/${invoiceId}/payments`, payload)).data,

  listReturns: async (query: SalesReturnsListQuery) =>
    (
      await client.get<ApiResponse<SalesReturnsResponse>>("/sales/returns", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          customerId: query.customerId || undefined,
          salesInvoiceId: query.salesInvoiceId || undefined,
          warehouseId: query.warehouseId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  createReturn: async (payload: SalesReturnInput) =>
    (await client.post<ApiResponse<SalesReturnDetailResponse>>("/sales/returns", payload)).data,

  getReturn: async (salesReturnId: string) =>
    (await client.get<ApiResponse<SalesReturnDetailResponse>>(`/sales/returns/${salesReturnId}`)).data,

  exportReturns: async (query: SalesReturnsListQuery & { format?: SalesExportFormat }) =>
    extractDownload(
      client.get("/sales/returns/export", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          customerId: query.customerId || undefined,
          salesInvoiceId: query.salesInvoiceId || undefined,
          warehouseId: query.warehouseId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "sales-returns.csv",
    ),

  sendEmail: async (invoiceId: string, payload: { email: string | null; subject?: string | null; message?: string | null }) =>
    (await client.post<ApiResponse<{ sendLog: unknown }>>(`/sales/${invoiceId}/send-email`, payload)).data,

  sendWhatsapp: async (invoiceId: string, payload: { mobile: string | null; message?: string | null }) =>
    (await client.post<ApiResponse<{ sendLog: unknown; whatsappUrl?: string }>>(`/sales/${invoiceId}/send-whatsapp`, payload)).data,
};
