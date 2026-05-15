import { auditLogRepository } from "./audit-log.repository";

export class AuditLogService {
  public async log(data: {
    companyId?: string | null;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    await auditLogRepository.create({
      companyId: data.companyId ?? null,
      userId: data.userId ?? null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      metadata: data.metadata ?? {},
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null
    });
  }
}

export const auditLogService = new AuditLogService();
