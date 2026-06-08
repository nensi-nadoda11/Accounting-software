import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  CashVerificationCurrentBalanceResponse,
  CashVerificationDetailResponse,
  CashVerificationExportFormat,
  CashVerificationExportResult,
  CashVerificationInput,
  CashVerificationListResponse,
  CashVerificationQuery,
} from "../types/cashVerification";

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
): Promise<CashVerificationExportResult> => {
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

export const cashVerificationApi = {
  list: async (query: CashVerificationQuery) =>
    (
      await client.get<ApiResponse<CashVerificationListResponse>>("/cash-verification", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          recordStatus: query.recordStatus || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  get: async (cashVerificationId: string) =>
    (await client.get<ApiResponse<CashVerificationDetailResponse>>(`/cash-verification/${cashVerificationId}`)).data,

  getCurrentBalance: async (asOfDate?: string) =>
    (
      await client.get<ApiResponse<CashVerificationCurrentBalanceResponse>>("/cash-verification/current-balance", {
        params: { asOfDate: asOfDate || undefined },
      })
    ).data,

  create: async (payload: CashVerificationInput) =>
    (await client.post<ApiResponse<CashVerificationDetailResponse>>("/cash-verification", payload)).data,

  update: async (cashVerificationId: string, payload: Partial<CashVerificationInput>) =>
    (await client.patch<ApiResponse<CashVerificationDetailResponse>>(`/cash-verification/${cashVerificationId}`, payload)).data,

  complete: async (cashVerificationId: string) =>
    (await client.post<ApiResponse<CashVerificationDetailResponse>>(`/cash-verification/${cashVerificationId}/complete`)).data,

  approve: async (cashVerificationId: string) =>
    (await client.post<ApiResponse<CashVerificationDetailResponse>>(`/cash-verification/${cashVerificationId}/approve`)).data,

  exportById: async (cashVerificationId: string, format: CashVerificationExportFormat = "pdf") =>
    extractDownload(
      client.get(`/cash-verification/${cashVerificationId}/export`, {
        params: { format },
        responseType: "blob",
      }),
      `cash-verification.${format}`,
    ),
};
