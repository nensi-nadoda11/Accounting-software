import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  StockCheckApprovalResponse,
  StockCheckDetailResponse,
  StockCheckExportFormat,
  StockCheckExportResult,
  StockCheckInput,
  StockCheckListResponse,
  StockCheckQuery,
} from "../types/stockCheck";

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
): Promise<StockCheckExportResult> => {
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

export const stockCheckApi = {
  list: async (query: StockCheckQuery) =>
    (
      await client.get<ApiResponse<StockCheckListResponse>>("/stock-check", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          warehouseId: query.warehouseId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  get: async (stockCheckId: string) =>
    (await client.get<ApiResponse<StockCheckDetailResponse>>(`/stock-check/${stockCheckId}`)).data,

  create: async (payload: StockCheckInput) =>
    (await client.post<ApiResponse<StockCheckDetailResponse>>("/stock-check", payload)).data,

  update: async (stockCheckId: string, payload: Partial<StockCheckInput>) =>
    (await client.patch<ApiResponse<StockCheckDetailResponse>>(`/stock-check/${stockCheckId}`, payload)).data,

  complete: async (stockCheckId: string) =>
    (await client.post<ApiResponse<StockCheckDetailResponse>>(`/stock-check/${stockCheckId}/complete`)).data,

  approve: async (stockCheckId: string) =>
    (await client.post<ApiResponse<StockCheckApprovalResponse>>(`/stock-check/${stockCheckId}/approve`)).data,

  exportById: async (stockCheckId: string, format: StockCheckExportFormat = "pdf") =>
    extractDownload(
      client.get(`/stock-check/${stockCheckId}/export`, {
        params: { format },
        responseType: "blob",
      }),
      `stock-check.${format}`,
    ),
};
