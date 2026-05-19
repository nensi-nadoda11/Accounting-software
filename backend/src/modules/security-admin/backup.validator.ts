import { z } from "zod";

import { BACKUP_INCLUDE_KEYS, BACKUP_STATUSES, BACKUP_TYPES, RESTORE_MODES } from "./audit.types";

const trimToUndefined = (value: unknown) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  return value;
};

export const backupIdParamSchema = z.object({
  id: z.uuid()
});

export const listBackupsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.preprocess(trimToUndefined, z.string().max(150).optional()),
  status: z.enum(BACKUP_STATUSES).optional(),
  backupType: z.enum(BACKUP_TYPES).optional()
});

export const createBackupSchema = z
  .object({
    backupName: z.string().trim().min(1).max(120),
    backupType: z.enum(BACKUP_TYPES).optional().default("manual"),
    includes: z.array(z.enum(BACKUP_INCLUDE_KEYS)).min(1).max(BACKUP_INCLUDE_KEYS.length).optional()
  })
  .strict();

export const restoreBackupSchema = z
  .object({
    restoreMode: z.enum(RESTORE_MODES),
    uploadedFileName: z.preprocess(trimToUndefined, z.string().max(255).optional())
  })
  .strict();

export type ListBackupsQuery = z.infer<typeof listBackupsQuerySchema>;
export type CreateBackupInput = z.infer<typeof createBackupSchema>;
export type RestoreBackupInput = z.infer<typeof restoreBackupSchema>;
