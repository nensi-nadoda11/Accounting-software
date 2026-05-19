import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  AuditFilters,
  AuditLog,
  Backup,
  BackupFilters,
  BackupIncludeKey,
  BackupType,
  FileDownload,
  LoginLog,
  LoginLogFilters,
  RestoreLog,
  RestoreLogFilters,
  RestoreMode,
  SecurityAdminListResponse
} from "../types/securityAdmin";

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

const extractDownload = async (request: Promise<AxiosResponse<Blob>>, fallbackFileName: string): Promise<FileDownload> => {
  const response = await request;
  return {
    blob: response.data,
    fileName: getFileNameFromDisposition(response.headers["content-disposition"], fallbackFileName),
    contentType:
      typeof response.headers["content-type"] === "string"
        ? response.headers["content-type"]
        : "application/octet-stream"
  };
};

const compactParams = <T extends object>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== "")) as Record<string, unknown>;

export const securityAdminApi = {
  listAuditLogs: async (filters: AuditFilters) =>
    (
      await client.get<ApiResponse<SecurityAdminListResponse<AuditLog>>>("/security-admin/audit-logs", {
        params: compactParams(filters)
      })
    ).data,

  exportAuditLogs: async (filters: Omit<AuditFilters, "page" | "limit">) =>
    extractDownload(
      client.get("/security-admin/audit-logs/export", {
        responseType: "blob",
        params: compactParams(filters)
      }),
      `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`
    ),

  listLoginLogs: async (filters: LoginLogFilters) =>
    (
      await client.get<ApiResponse<SecurityAdminListResponse<LoginLog>>>("/security-admin/login-logs", {
        params: compactParams(filters)
      })
    ).data,

  listBackups: async (filters: BackupFilters) =>
    (
      await client.get<ApiResponse<SecurityAdminListResponse<Backup>>>("/security-admin/backups", {
        params: compactParams(filters)
      })
    ).data,

  createBackup: async (payload: { backupName: string; backupType?: BackupType; includes?: BackupIncludeKey[] }) =>
    (await client.post<ApiResponse<{ backupId: string }>>("/security-admin/backups", payload)).data,

  downloadBackup: async (backupId: string) =>
    extractDownload(
      client.get(`/security-admin/backups/${backupId}/download`, {
        responseType: "blob"
      }),
      `backup-${backupId}.json`
    ),

  restoreBackup: async (backupId: string, payload: { restoreMode: RestoreMode; file?: File | null }) => {
    const formData = new FormData();
    formData.append("restoreMode", payload.restoreMode);

    if (payload.file) {
      formData.append("uploadedFileName", payload.file.name);
      formData.append("file", payload.file);
    }

    return (
      await client.post<ApiResponse<{ backupId: string; restoreMode: RestoreMode; restoredAt: string }>>(
        `/security-admin/backups/${backupId}/restore`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      )
    ).data;
  },

  deleteBackup: async (backupId: string) =>
    (await client.delete<ApiResponse<{ backupId: string }>>(`/security-admin/backups/${backupId}`)).data,

  listRestoreLogs: async (filters: RestoreLogFilters) =>
    (
      await client.get<ApiResponse<SecurityAdminListResponse<RestoreLog>>>("/security-admin/restore-logs", {
        params: compactParams(filters)
      })
    ).data
};
