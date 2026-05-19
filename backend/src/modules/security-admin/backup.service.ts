import fs from "fs/promises";
import path from "path";

import { z } from "zod";

import { buildPublicUploadUrl, ensureUploadDirectory, getRelativeUploadPathFromUrl, getUploadRootPath } from "../../utils/upload";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { logAuditAction } from "./audit.service";
import { securityAdminBackupRepository } from "./backup.repository";
import type { CreateBackupInput, ListBackupsQuery, RestoreBackupInput } from "./backup.validator";
import { BACKUP_INCLUDE_KEYS } from "./audit.types";
import type { BackupIncludeKey, SecurityAdminActor, SecurityAdminRequestContext } from "./audit.types";

const BACKUP_SCHEMA_VERSION = "1.0";
const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;
const BACKUP_FILE_EXTENSION = ".json";

const backupDocumentSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  generatedAt: z.string().datetime(),
  companyId: z.uuid(),
  includes: z.array(z.enum(BACKUP_INCLUDE_KEYS)),
  meta: z
    .object({
      counts: z.record(z.string(), z.number().int().nonnegative()),
      sanitizedFields: z.array(z.string()).default([])
    })
    .passthrough(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown())))
});

type BackupDocument = z.infer<typeof backupDocumentSchema>;

const sanitizeFileNameSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "backup";

const getBackupRelativeDirectory = (companyId: string) => path.posix.join("company", companyId, "backups");

const resolveBackupDirectory = (companyId: string) => path.resolve(getUploadRootPath(), getBackupRelativeDirectory(companyId));

const resolveStoredBackupPath = (fileUrl: string) => {
  const relativePath = getRelativeUploadPathFromUrl(fileUrl);
  if (!relativePath) {
    return null;
  }

  return path.resolve(getUploadRootPath(), relativePath);
};

const toBuffer = (content: string) => Buffer.from(content, "utf-8");

const parseBackupDocument = (input: Buffer | string) => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.isBuffer(input) ? input.toString("utf-8") : input);
  } catch {
    throw new AppError("Backup file is not valid JSON", 400);
  }

  const result = backupDocumentSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(
      "Backup file structure is invalid",
      400,
      result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    );
  }

  return result.data;
};

const assertDocumentOwnership = (document: BackupDocument, companyId: string) => {
  if (document.companyId !== companyId) {
    throw new AppError("Backup does not belong to the current company", 403);
  }

  const companyRows = document.tables.companies ?? [];
  if (companyRows.some((row) => row.id !== companyId)) {
    throw new AppError("Backup company metadata does not match the current company", 403);
  }

  for (const [tableName, rows] of Object.entries(document.tables)) {
    for (const row of rows) {
      if ("company_id" in row && row.company_id !== companyId) {
        throw new AppError(`Backup contains foreign company data in table ${tableName}`, 403);
      }
    }
  }
};

export class SecurityAdminBackupService {
  public async listBackups(actor: SecurityAdminActor, query: ListBackupsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const params: {
      companyId: string;
      page: number;
      limit: number;
      search?: string;
      status?: "generating" | "completed" | "failed" | "restoring";
      backupType?: "manual" | "scheduled";
    } = {
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit
    };

    if (query.search) {
      params.search = query.search;
    }

    if (query.status) {
      params.status = query.status;
    }

    if (query.backupType) {
      params.backupType = query.backupType;
    }

    const result = await securityAdminBackupRepository.listBackups({
      ...params
    });

    return {
      items: result.rows.map((row) => ({
        id: row.backup.id,
        backupName: row.backup.backupName,
        backupType: row.backup.backupType,
        fileName: row.backup.fileName,
        fileUrl: row.backup.fileUrl,
        sizeBytes: row.backup.sizeBytes,
        status: row.backup.status,
        includes: row.backup.includes,
        createdBy: row.backup.createdBy,
        createdByName: row.createdByName ?? "System",
        restoreStartedAt: row.backup.restoreStartedAt,
        restoredAt: row.backup.restoredAt,
        errorMessage: row.backup.errorMessage,
        createdAt: row.backup.createdAt,
        updatedAt: row.backup.updatedAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createBackup(actor: SecurityAdminActor, input: CreateBackupInput, context: SecurityAdminRequestContext) {
    const includes = securityAdminBackupRepository.getNormalizedIncludes(input.includes);
    const safeName = sanitizeFileNameSegment(input.backupName);
    const fileName = `${safeName}-${new Date().toISOString().slice(0, 10)}${BACKUP_FILE_EXTENSION}`;

    const backup = await securityAdminBackupRepository.createBackupRecord({
      companyId: actor.companyId,
      backupName: input.backupName,
      backupType: input.backupType,
      fileName,
      status: "generating",
      includes,
      createdBy: actor.id
    });

    if (!backup) {
      throw new AppError("Failed to initialize backup", 500);
    }

    try {
      const snapshot = await securityAdminBackupRepository.collectBackupData(actor.companyId, includes);
      const document: BackupDocument = {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        companyId: actor.companyId,
        includes,
        meta: {
          counts: snapshot.counts,
          sanitizedFields: ["users.password_hash", "sessions.refresh_token_hash", "otp_verifications.otp_hash", "user_invites.token_hash"]
        },
        tables: snapshot.tables
      };

      const content = JSON.stringify(document, null, 2);
      const directory = resolveBackupDirectory(actor.companyId);
      ensureUploadDirectory(directory);

      const absolutePath = path.resolve(directory, fileName);
      await fs.writeFile(absolutePath, content, "utf-8");

      const relativePath = path.posix.join(getBackupRelativeDirectory(actor.companyId), fileName);
      const fileUrl = buildPublicUploadUrl(relativePath);
      const sizeBytes = toBuffer(content).byteLength;

      await securityAdminBackupRepository.updateBackupRecord(backup.id, actor.companyId, {
        fileUrl,
        sizeBytes,
        status: "completed",
        errorMessage: null
      });

      await logAuditAction({
        actor,
        module: "backup",
        action: "backup_created",
        entityType: "backup",
        entityId: backup.id,
        newValues: {
          backupName: input.backupName,
          includes
        },
        metadata: {
          sizeBytes,
          tableCounts: snapshot.counts
        },
        context
      });

      return {
        backupId: backup.id,
        fileName,
        fileUrl,
        sizeBytes,
        includes
      };
    } catch (error) {
      await securityAdminBackupRepository.updateBackupRecord(backup.id, actor.companyId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Backup generation failed"
      });

      await logAuditAction({
        actor,
        module: "backup",
        action: "backup_create_failed",
        entityType: "backup",
        entityId: backup.id,
        metadata: {
          error: error instanceof Error ? error.message : "Backup generation failed"
        },
        context,
        status: "failed"
      });

      throw error;
    }
  }

  public async downloadBackup(actor: SecurityAdminActor, backupId: string, context: SecurityAdminRequestContext) {
    const backup = await securityAdminBackupRepository.findBackupById(actor.companyId, backupId);
    if (!backup) {
      throw new AppError("Backup not found", 404);
    }

    if (!backup.fileUrl) {
      throw new AppError("Backup file is unavailable", 404);
    }

    const absolutePath = resolveStoredBackupPath(backup.fileUrl);
    if (!absolutePath) {
      throw new AppError("Backup file path is invalid", 400);
    }

    let content: Buffer;
    try {
      content = await fs.readFile(absolutePath);
    } catch {
      throw new AppError("Backup file could not be read", 404);
    }

    await logAuditAction({
      actor,
      module: "backup",
      action: "backup_downloaded",
      entityType: "backup",
      entityId: backup.id,
      metadata: {
        fileName: backup.fileName
      },
      context
    });

    return {
      fileName: backup.fileName,
      contentType: "application/json; charset=utf-8",
      content
    };
  }

  public async restoreBackup(
    actor: SecurityAdminActor,
    backupId: string,
    input: RestoreBackupInput,
    uploadedFile: Express.Multer.File | undefined,
    context: SecurityAdminRequestContext
  ) {
    if (actor.role !== "admin") {
      throw new AppError("Only admin users can restore backups", 403);
    }

    const backup = await securityAdminBackupRepository.findBackupById(actor.companyId, backupId);
    if (!backup) {
      throw new AppError("Backup not found", 404);
    }

    if (uploadedFile && uploadedFile.size > MAX_BACKUP_FILE_BYTES) {
      throw new AppError(`Restore file size must not exceed ${MAX_BACKUP_FILE_BYTES / (1024 * 1024)}MB`, 400);
    }

    if (uploadedFile && path.extname(uploadedFile.originalname).toLowerCase() !== BACKUP_FILE_EXTENSION) {
      throw new AppError("Only JSON backup files are supported", 400);
    }

    const sourceBuffer =
      uploadedFile?.buffer ??
      (await (async () => {
        if (!backup.fileUrl) {
          throw new AppError("Backup file is unavailable", 404);
        }

        const absolutePath = resolveStoredBackupPath(backup.fileUrl);
        if (!absolutePath) {
          throw new AppError("Backup file path is invalid", 400);
        }

        try {
          return await fs.readFile(absolutePath);
        } catch {
          throw new AppError("Backup file could not be read", 404);
        }
      })());

    const document = parseBackupDocument(sourceBuffer);
    assertDocumentOwnership(document, actor.companyId);

    await securityAdminBackupRepository.updateBackupRecord(backup.id, actor.companyId, {
      status: "restoring",
      restoreStartedAt: new Date(),
      errorMessage: null
    });

    try {
      await securityAdminBackupRepository.restoreBackupData(actor.companyId, document.tables, input.restoreMode);

      await securityAdminBackupRepository.updateBackupRecord(backup.id, actor.companyId, {
        status: "completed",
        restoredAt: new Date(),
        errorMessage: null
      });

      await securityAdminBackupRepository.createRestoreLog({
        companyId: actor.companyId,
        backupId: backup.id,
        restoredBy: actor.id,
        status: "success",
        restoreMode: input.restoreMode
      });

      await logAuditAction({
        actor,
        module: "backup",
        action: "backup_restored",
        entityType: "backup",
        entityId: backup.id,
        metadata: {
          restoreMode: input.restoreMode,
          uploadedFileName: uploadedFile?.originalname ?? null
        },
        context
      });

      return {
        backupId: backup.id,
        restoreMode: input.restoreMode,
        restoredAt: new Date().toISOString()
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restore failed";

      await securityAdminBackupRepository.updateBackupRecord(backup.id, actor.companyId, {
        status: "failed",
        errorMessage: message
      });

      await securityAdminBackupRepository.createRestoreLog({
        companyId: actor.companyId,
        backupId: backup.id,
        restoredBy: actor.id,
        status: "failed",
        restoreMode: input.restoreMode,
        errorMessage: message
      });

      await logAuditAction({
        actor,
        module: "backup",
        action: "backup_restore_failed",
        entityType: "backup",
        entityId: backup.id,
        metadata: {
          restoreMode: input.restoreMode,
          uploadedFileName: uploadedFile?.originalname ?? null,
          error: message
        },
        context,
        status: "failed"
      });

      throw error;
    }
  }

  public async deleteBackup(actor: SecurityAdminActor, backupId: string, context: SecurityAdminRequestContext) {
    const deleted = await securityAdminBackupRepository.softDeleteBackup(actor.companyId, backupId);
    if (!deleted) {
      throw new AppError("Backup not found", 404);
    }

    await logAuditAction({
      actor,
      module: "backup",
      action: "backup_deleted",
      entityType: "backup",
      entityId: deleted.id,
      oldValues: {
        backupName: deleted.backupName,
        status: deleted.status
      },
      context
    });

    return {
      backupId: deleted.id
    };
  }
}

export const securityAdminBackupService = new SecurityAdminBackupService();
