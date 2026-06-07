import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  SiteAuditDetailResponse,
  SiteAuditExportFormat,
  SiteAuditExportResult,
  SiteAuditFinding,
  SiteAuditInput,
  SiteAuditListResponse,
  SiteAuditQuery,
} from "../types/siteAudit";

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
): Promise<SiteAuditExportResult> => {
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

export const siteAuditApi = {
  list: async (query: SiteAuditQuery) =>
    (
      await client.get<ApiResponse<SiteAuditListResponse>>("/site-audits", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          finalResult: query.finalResult || undefined,
          warehouseId: query.warehouseId || undefined,
          auditorId: query.auditorId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  get: async (siteAuditId: string) =>
    (await client.get<ApiResponse<SiteAuditDetailResponse>>(`/site-audits/${siteAuditId}`)).data,

  create: async (payload: SiteAuditInput) =>
    (await client.post<ApiResponse<SiteAuditDetailResponse>>("/site-audits", payload)).data,

  update: async (siteAuditId: string, payload: Partial<SiteAuditInput>) =>
    (await client.patch<ApiResponse<SiteAuditDetailResponse>>(`/site-audits/${siteAuditId}`, payload)).data,

  complete: async (siteAuditId: string, finalResult: SiteAuditInput["finalResult"]) =>
    (await client.post<ApiResponse<SiteAuditDetailResponse>>(`/site-audits/${siteAuditId}/complete`, { finalResult })).data,

  approve: async (siteAuditId: string) =>
    (await client.post<ApiResponse<SiteAuditDetailResponse>>(`/site-audits/${siteAuditId}/approve`)).data,

  cancel: async (siteAuditId: string) =>
    (await client.post<ApiResponse<SiteAuditDetailResponse>>(`/site-audits/${siteAuditId}/cancel`)).data,

  addFinding: async (siteAuditId: string, payload: SiteAuditFinding) =>
    (await client.post<ApiResponse<SiteAuditDetailResponse>>(`/site-audits/${siteAuditId}/findings`, payload)).data,

  updateFinding: async (siteAuditId: string, findingId: string, payload: Partial<SiteAuditFinding>) =>
    (await client.patch<ApiResponse<SiteAuditDetailResponse>>(`/site-audits/${siteAuditId}/findings/${findingId}`, payload)).data,

  uploadAttachments: async (siteAuditId: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    return (await client.post<ApiResponse<SiteAuditDetailResponse>>(`/site-audits/${siteAuditId}/attachments`, formData)).data;
  },

  deleteAttachment: async (siteAuditId: string, attachmentId: string) =>
    (await client.delete<ApiResponse<SiteAuditDetailResponse>>(`/site-audits/${siteAuditId}/attachments/${attachmentId}`)).data,

  exportById: async (siteAuditId: string, format: SiteAuditExportFormat = "pdf") =>
    extractDownload(
      client.get(`/site-audits/${siteAuditId}/export`, {
        params: { format },
        responseType: "blob",
      }),
      `site-audit.${format}`,
    ),
};
