import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  PurchaseDetailResponse,
  PurchaseExportFormat,
  PurchaseFormInput,
  PurchaseListQuery,
  PurchaseListResponse,
  PurchasePaymentInput,
  PurchasePaymentMutationResponse,
  PurchasePaymentsQuery,
  PurchasePaymentsResponse,
  PurchaseReturnDetailResponse,
  PurchaseReturnInput,
  PurchaseReturnRefundInput,
  PurchaseReturnsListQuery,
  PurchaseReturnsResponse,
} from "../types/purchase";
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

export const purchasesApi = {
  list: async (query: PurchaseListQuery) =>
    (
      await client.get<ApiResponse<PurchaseListResponse>>("/purchases", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          purchaseStatus: query.purchaseStatus || undefined,
          paymentStatus: query.paymentStatus || undefined,
          supplierId: query.supplierId || undefined,
          warehouseId: query.warehouseId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  create: async (payload: PurchaseFormInput) =>
    (await client.post<ApiResponse<PurchaseDetailResponse>>("/purchases", payload)).data,

  get: async (purchaseId: string) =>
    (await client.get<ApiResponse<PurchaseDetailResponse>>(`/purchases/${purchaseId}`)).data,

  update: async (purchaseId: string, payload: Omit<PurchaseFormInput, "purchaseStatus" | "paidAmount" | "paymentMode" | "paymentReference" | "bankAccountId">) =>
    (await client.patch<ApiResponse<PurchaseDetailResponse>>(`/purchases/${purchaseId}`, payload)).data,

  remove: async (purchaseId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/purchases/${purchaseId}`)).data,

  post: async (purchaseId: string) =>
    (await client.post<ApiResponse<PurchaseDetailResponse>>(`/purchases/${purchaseId}/post`)).data,

  cancel: async (purchaseId: string) =>
    (await client.post<ApiResponse<PurchaseDetailResponse>>(`/purchases/${purchaseId}/cancel`)).data,

  exportList: async (query: PurchaseListQuery & { format?: PurchaseExportFormat }) =>
    extractDownload(
      client.get("/purchases/export", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          purchaseStatus: query.purchaseStatus || undefined,
          paymentStatus: query.paymentStatus || undefined,
          supplierId: query.supplierId || undefined,
          warehouseId: query.warehouseId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "purchases.csv",
    ),

  downloadPdf: async (purchaseId: string) =>
    extractDownload(client.get(`/purchases/${purchaseId}/pdf`, { responseType: "blob" }), `purchase-${purchaseId}.csv`),

  listPayments: async (purchaseId: string, query: PurchasePaymentsQuery) =>
    (
      await client.get<ApiResponse<PurchasePaymentsResponse>>(`/purchases/${purchaseId}/payments`, {
        params: {
          page: query.page,
          limit: query.limit,
        },
      })
    ).data,

  createPayment: async (purchaseId: string, payload: PurchasePaymentInput) =>
    (await client.post<ApiResponse<PurchasePaymentMutationResponse>>(`/purchases/${purchaseId}/payments`, payload)).data,

  listReturns: async (query: PurchaseReturnsListQuery) =>
    (
      await client.get<ApiResponse<PurchaseReturnsResponse>>("/purchases/returns", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          supplierId: query.supplierId || undefined,
          purchaseInvoiceId: query.purchaseInvoiceId || undefined,
          warehouseId: query.warehouseId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  createReturn: async (payload: PurchaseReturnInput) =>
    (await client.post<ApiResponse<PurchaseReturnDetailResponse>>("/purchases/returns", payload)).data,

  getReturn: async (purchaseReturnId: string) =>
    (await client.get<ApiResponse<PurchaseReturnDetailResponse>>(`/purchases/returns/${purchaseReturnId}`)).data,

  recordReturnRefund: async (purchaseReturnId: string, payload: PurchaseReturnRefundInput) =>
    (await client.post<ApiResponse<PurchaseReturnDetailResponse>>(`/purchases/returns/${purchaseReturnId}/refunds`, payload)).data,

  exportReturns: async (query: PurchaseReturnsListQuery & { format?: PurchaseExportFormat }) =>
    extractDownload(
      client.get("/purchases/returns/export", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          supplierId: query.supplierId || undefined,
          purchaseInvoiceId: query.purchaseInvoiceId || undefined,
          warehouseId: query.warehouseId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "purchase-returns.csv",
    ),

  downloadReturnPdf: async (purchaseReturnId: string) =>
    extractDownload(
      client.get(`/purchases/returns/${purchaseReturnId}/pdf`, { responseType: "blob" }),
      `purchase-return-${purchaseReturnId}.csv`,
    ),
};
