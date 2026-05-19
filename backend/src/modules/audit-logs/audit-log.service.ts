import { auditLogRepository } from "./audit-log.repository";

type JsonRecord = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /(password|token|secret|refresh|session|otp|hash|authorization|cookie|api[_-]?key)/i;

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as JsonRecord).reduce<JsonRecord>((accumulator, [key, entry]) => {
      accumulator[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeValue(entry);
      return accumulator;
    }, {});
  }

  return value;
};

const toNullableRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return sanitizeValue(value) as JsonRecord;
};

const inferModule = (moduleName: string | null | undefined, action: string, entityType: string | null | undefined) => {
  if (moduleName?.trim()) {
    return moduleName.trim().toLowerCase();
  }

  const normalizedAction = action.trim().toLowerCase();
  const [prefix] = normalizedAction.split("_");
  if (prefix) {
    return prefix;
  }

  if (entityType?.trim()) {
    return entityType.trim().toLowerCase();
  }

  return prefix || "system";
};

export class AuditLogService {
  public async log(data: {
    companyId?: string | null;
    userId?: string | null;
    userNameSnapshot?: string | null;
    userRoleSnapshot?: string | null;
    action: string;
    module?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    oldValues?: JsonRecord | null;
    newValues?: JsonRecord | null;
    metadata?: JsonRecord | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestMethod?: string | null;
    requestPath?: string | null;
    status?: "success" | "failed";
  }): Promise<void> {
    await auditLogRepository.create({
      companyId: data.companyId ?? null,
      userId: data.userId ?? null,
      userNameSnapshot: data.userNameSnapshot ?? null,
      userRoleSnapshot: data.userRoleSnapshot ?? null,
      action: data.action,
      module: inferModule(data.module, data.action, data.entityType ?? null),
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      oldValues: toNullableRecord(data.oldValues),
      newValues: toNullableRecord(data.newValues),
      metadata: toNullableRecord(data.metadata) ?? {},
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      requestMethod: data.requestMethod ?? null,
      requestPath: data.requestPath ?? null,
      status: data.status ?? "success"
    });
  }
}

export const auditLogService = new AuditLogService();
