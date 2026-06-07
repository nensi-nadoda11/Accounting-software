import path from "path";
import { randomUUID } from "crypto";

import multer from "multer";
import type { NextFunction, Request, Response } from "express";

import { AppError } from "../../utils/app-error";
import { buildPublicUploadUrl, ensureUploadDirectory, getUploadRootPath } from "../../utils/upload";

const MAX_SITE_AUDIT_ATTACHMENT_MB = 5;
const MAX_SITE_AUDIT_ATTACHMENTS = 5;

const allowedMimeToExtensions: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"]
};

const allowedExtensions = new Set(Object.values(allowedMimeToExtensions).flat());
const allowedMimeTypes = new Set(Object.keys(allowedMimeToExtensions));

const getExtension = (originalName: string) => path.extname(originalName).toLowerCase();

const createFilename = (originalName: string, mimeType: string) => {
  const extension = getExtension(originalName);
  const allowed = allowedMimeToExtensions[mimeType];

  if (!allowed || !allowed.includes(extension)) {
    throw new AppError("Only jpg, jpeg, png, webp, and pdf files are allowed", 400);
  }

  return `${randomUUID()}${extension}`;
};

export const getSiteAuditUploadRelativeDirectory = (companyId: string, siteAuditId: string) =>
  path.posix.join("site-audits", companyId, siteAuditId);

export const buildSiteAuditFileUrl = (companyId: string, siteAuditId: string, fileName: string) =>
  buildPublicUploadUrl(path.posix.join(getSiteAuditUploadRelativeDirectory(companyId, siteAuditId), fileName));

const resolveUploadDirectory = (companyId: string, siteAuditId: string) =>
  path.resolve(getUploadRootPath(), getSiteAuditUploadRelativeDirectory(companyId, siteAuditId));

const storage = multer.diskStorage({
  destination: (request, _file, callback) => {
    try {
      const companyId = request.currentUser?.companyId;
      const siteAuditId = String(request.params.id ?? "");

      if (!companyId || !siteAuditId) {
        callback(new AppError("Company access and site audit id are required", 400), "");
        return;
      }

      const uploadDirectory = resolveUploadDirectory(companyId, siteAuditId);
      ensureUploadDirectory(uploadDirectory);
      callback(null, uploadDirectory);
    } catch (error) {
      callback(error as Error, "");
    }
  },
  filename: (_request, file, callback) => {
    try {
      callback(null, createFilename(file.originalname, file.mimetype));
    } catch (error) {
      callback(error as Error, "");
    }
  }
});

const uploader = multer({
  storage,
  limits: {
    fileSize: MAX_SITE_AUDIT_ATTACHMENT_MB * 1024 * 1024,
    files: MAX_SITE_AUDIT_ATTACHMENTS
  },
  fileFilter: (_request, file, callback) => {
    const extension = getExtension(file.originalname);

    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(extension)) {
      callback(new AppError("Only jpg, jpeg, png, webp, and pdf files are allowed", 400));
      return;
    }

    callback(null, true);
  }
});

export const uploadSiteAuditAttachments = (request: Request, response: Response, next: NextFunction) => {
  uploader.array("files", MAX_SITE_AUDIT_ATTACHMENTS)(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new AppError(`Upload file size must not exceed ${MAX_SITE_AUDIT_ATTACHMENT_MB}MB`, 400));
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT") {
      next(new AppError(`A maximum of ${MAX_SITE_AUDIT_ATTACHMENTS} attachments are allowed`, 400));
      return;
    }

    next(error);
  });
};
