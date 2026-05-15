import { db } from "../../db";
import { auditLogs } from "../../db/schema";

export class AuditLogRepository {
  public async create(data: typeof auditLogs.$inferInsert): Promise<void> {
    await db.insert(auditLogs).values(data);
  }
}

export const auditLogRepository = new AuditLogRepository();
