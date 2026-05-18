import path from "path";
import { randomUUID } from "crypto";

import multer from "multer";
import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { ensureUploadDirectory, getUploadRootPath } from "../../utils/upload";

const expenseAllowedMimeToExtensions: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"]
};

const expenseAllowedExtensions = new Set(Object.values(expenseAllowedMimeToExtensions).flat());
const expenseAllowedMimeTypes = new Set(Object.keys(expenseAllowedMimeToExtensions));

const sanitizeExtension = (originalName: string) => path.extname(originalName).toLowerCase();
const normalizeExpenseUploadBaseDirectory = () =>
  env.EXPENSE_UPLOAD_DIR.replace(/\\/g, "/").replace(/^\/+/, "").replace(new RegExp(`^${env.UPLOAD_DIR.replace(/\\/g, "/").replace(/^\/+/, "")}/?`), "");

const createExpenseUploadFilename = (originalName: string, mimeType: string) => {
  const extension = sanitizeExtension(originalName);
  const allowed = expenseAllowedMimeToExtensions[mimeType];

  if (!allowed || !allowed.includes(extension)) {
    throw new AppError("Only jpg, jpeg, png, webp, and pdf files are allowed", 400);
  }

  return `${randomUUID()}${extension}`;
};

export const getExpenseUploadRelativeDirectory = (companyId: string, expenseId: string) =>
  path.posix.join(normalizeExpenseUploadBaseDirectory(), companyId, expenseId);

const resolveExpenseUploadDirectory = (companyId: string, expenseId: string) =>
  path.resolve(getUploadRootPath(), getExpenseUploadRelativeDirectory(companyId, expenseId));

const storage = multer.diskStorage({
  destination: (request, _file, callback) => {
    try {
      const companyId = request.currentUser?.companyId;
      const expenseId = String(request.params.id ?? "");

      if (!companyId || !expenseId) {
        callback(new AppError("Company access and expense id are required", 400), "");
        return;
      }

      const uploadDirectory = resolveExpenseUploadDirectory(companyId, expenseId);
      ensureUploadDirectory(uploadDirectory);
      callback(null, uploadDirectory);
    } catch (error) {
      callback(error as Error, "");
    }
  },
  filename: (_request, file, callback) => {
    try {
      callback(null, createExpenseUploadFilename(file.originalname, file.mimetype));
    } catch (error) {
      callback(error as Error, "");
    }
  }
});

const uploader = multer({
  storage,
  limits: {
    fileSize: Math.floor(env.EXPENSE_MAX_UPLOAD_MB * 1024 * 1024),
    files: env.EXPENSE_MAX_ATTACHMENTS
  },
  fileFilter: (_request, file, callback) => {
    const extension = sanitizeExtension(file.originalname);

    if (!expenseAllowedMimeTypes.has(file.mimetype) || !expenseAllowedExtensions.has(extension)) {
      callback(new AppError("Only jpg, jpeg, png, webp, and pdf files are allowed", 400));
      return;
    }

    callback(null, true);
  }
});

export const uploadExpenseAttachments = (request: Request, response: Response, next: NextFunction) => {
  uploader.array("files", env.EXPENSE_MAX_ATTACHMENTS)(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new AppError(`Upload file size must not exceed ${env.EXPENSE_MAX_UPLOAD_MB}MB`, 400));
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") {
      next(new AppError(`A maximum of ${env.EXPENSE_MAX_ATTACHMENTS} attachments are allowed`, 400));
      return;
    }

    next(error);
  });
};
