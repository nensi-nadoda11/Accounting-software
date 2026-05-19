import multer from "multer";
import { Router, type NextFunction, type Request, type Response } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/app-error";
import { securityAdminBackupController } from "./backup.controller";
import {
  backupIdParamSchema,
  createBackupSchema,
  listBackupsQuerySchema,
  restoreBackupSchema
} from "./backup.validator";

const router = Router();
const restoreUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1
  }
});

const createBackupLimiter = createRateLimiter({
  limit: 5,
  windowMs: 60_000,
  keyPrefix: "backup:create"
});

const restoreBackupLimiter = createRateLimiter({
  limit: 3,
  windowMs: 5 * 60_000,
  keyPrefix: "backup:restore"
});

const uploadRestoreFile = (request: Request, response: Response, next: NextFunction) => {
  restoreUpload.single("file")(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new AppError("Restore file size must not exceed 25MB", 400));
      return;
    }

    next(error);
  });
};

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/backups",
  requirePermission(["backup.create", "backup.download", "backup.restore", "backup.delete"]),
  validateRequest({ query: listBackupsQuerySchema }),
  asyncHandler(securityAdminBackupController.listBackups)
);

router.post(
  "/backups",
  createBackupLimiter,
  requirePermission(["backup.create"]),
  validateRequest({ body: createBackupSchema }),
  asyncHandler(securityAdminBackupController.createBackup)
);

router.get(
  "/backups/:id/download",
  requirePermission(["backup.download"]),
  validateRequest({ params: backupIdParamSchema }),
  asyncHandler(securityAdminBackupController.downloadBackup)
);

router.post(
  "/backups/:id/restore",
  restoreBackupLimiter,
  requirePermission(["backup.restore"]),
  uploadRestoreFile,
  validateRequest({ params: backupIdParamSchema, body: restoreBackupSchema }),
  asyncHandler(securityAdminBackupController.restoreBackup)
);

router.delete(
  "/backups/:id",
  requirePermission(["backup.delete"]),
  validateRequest({ params: backupIdParamSchema }),
  asyncHandler(securityAdminBackupController.deleteBackup)
);

export default router;
