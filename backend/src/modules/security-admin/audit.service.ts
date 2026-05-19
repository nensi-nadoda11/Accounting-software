import { auditLogService } from "../audit-logs/audit-log.service";
import { getPagination } from "../../utils/pagination";
import type { ListAuditLogsQuery, ListLoginLogsQuery, ListRestoreLogsQuery } from "./audit.validator";
import { securityAdminAuditRepository } from "./audit.repository";
import type { SecurityAdminActor, SecurityAdminRequestContext } from "./audit.types";

const csvEscape = (value: string) => `"${value.replaceAll('"', '""')}"`;

const toDisplay = (value: unknown) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

export const logAuditAction = async (input: {
  actor?: Partial<SecurityAdminActor> | null;
  module?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  context?: SecurityAdminRequestContext | null;
  status?: "success" | "failed";
}) => {
  await auditLogService.log({
    companyId: input.actor?.companyId ?? null,
    userId: input.actor?.id ?? null,
    userNameSnapshot: input.actor?.fullName ?? null,
    userRoleSnapshot: input.actor?.role ?? null,
    module: input.module ?? null,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    oldValues: input.oldValues ?? null,
    newValues: input.newValues ?? null,
    metadata: input.metadata ?? null,
    ipAddress: input.context?.ipAddress ?? null,
    userAgent: input.context?.userAgent ?? null,
    requestMethod: input.context?.requestMethod ?? null,
    requestPath: input.context?.requestPath ?? null,
    status: input.status ?? "success"
  });
};

export class SecurityAdminAuditService {
  public async logLoginEvent(input: {
    companyId?: string | null;
    userId?: string | null;
    email: string;
    loginType: "login" | "logout" | "failed_login" | "password_reset";
    success: boolean;
    failureReason?: string | null;
    context?: SecurityAdminRequestContext | null;
  }) {
    await securityAdminAuditRepository.createLoginLog({
      companyId: input.companyId ?? null,
      userId: input.userId ?? null,
      email: input.email,
      loginType: input.loginType,
      ipAddress: input.context?.ipAddress ?? null,
      userAgent: input.context?.userAgent ?? null,
      success: input.success,
      failureReason: input.failureReason ?? null
    });
  }

  public async listAuditLogs(actor: SecurityAdminActor, query: ListAuditLogsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await securityAdminAuditRepository.listAuditLogs({
      ...query,
      companyId: actor.companyId,
      offset: pagination.offset
    });

    return {
      items: result.rows.map((row) => ({
        id: row.log.id,
        companyId: row.log.companyId,
        userId: row.log.userId,
        userName: row.log.userNameSnapshot ?? row.currentUserFullName ?? row.currentUserEmail ?? "System",
        userRole: row.log.userRoleSnapshot ?? null,
        action: row.log.action,
        module: row.log.module,
        entityType: row.log.entityType,
        entityId: row.log.entityId,
        oldValues: row.log.oldValues,
        newValues: row.log.newValues,
        metadata: row.log.metadata,
        ipAddress: row.log.ipAddress,
        userAgent: row.log.userAgent,
        requestMethod: row.log.requestMethod,
        requestPath: row.log.requestPath,
        status: row.log.status,
        createdAt: row.log.createdAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async exportAuditLogs(actor: SecurityAdminActor, query: ListAuditLogsQuery) {
    const result = await securityAdminAuditRepository.listAuditLogs({
      ...query,
      companyId: actor.companyId,
      exportAll: true
    });

    const headers = ["Date", "User", "Role", "Module", "Action", "Entity Type", "Entity ID", "Status", "IP", "Path", "Method"];
    const rows = result.rows.map((row) => [
      row.log.createdAt.toISOString(),
      row.log.userNameSnapshot ?? row.currentUserFullName ?? row.currentUserEmail ?? "System",
      row.log.userRoleSnapshot ?? "",
      row.log.module,
      row.log.action,
      row.log.entityType ?? "",
      row.log.entityId ?? "",
      row.log.status,
      row.log.ipAddress ?? "",
      row.log.requestPath ?? "",
      row.log.requestMethod ?? ""
    ]);

    return {
      fileName: `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv; charset=utf-8",
      content: Buffer.from(
        `\uFEFF${[headers, ...rows].map((row) => row.map((value) => csvEscape(toDisplay(value))).join(",")).join("\n")}`,
        "utf-8"
      )
    };
  }

  public async listLoginLogs(actor: SecurityAdminActor, query: ListLoginLogsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await securityAdminAuditRepository.listLoginLogs({
      ...query,
      companyId: actor.companyId,
      offset: pagination.offset
    });

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        userId: row.userId,
        email: row.email,
        loginType: row.loginType,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        success: row.success,
        failureReason: row.failureReason,
        createdAt: row.createdAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async listRestoreLogs(actor: SecurityAdminActor, query: ListRestoreLogsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await securityAdminAuditRepository.listRestoreLogs({
      ...query,
      companyId: actor.companyId,
      offset: pagination.offset
    });

    return {
      items: result.rows.map((row) => ({
        id: row.log.id,
        backupId: row.log.backupId,
        backupName: row.backupName,
        restoredBy: row.log.restoredBy,
        restoredByName: row.restoredByName ?? "System",
        status: row.log.status,
        restoreMode: row.log.restoreMode,
        errorMessage: row.log.errorMessage,
        createdAt: row.log.createdAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }
}

export const securityAdminAuditService = new SecurityAdminAuditService();
