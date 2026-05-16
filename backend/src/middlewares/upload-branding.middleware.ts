import path from "path";

import multer from "multer";
import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import {
  createSafeUploadFilename,
  ensureUploadDirectory,
  getBrandingUploadRelativeDirectory,
  getMaxUploadSizeBytes,
  getUploadRootPath,
  isAllowedUploadExtension,
  isAllowedUploadMimeType
} from "../utils/upload";

const storage = multer.diskStorage({
  destination: (request, _file, callback) => {
    try {
      const companyId = request.currentUser?.companyId;
      if (!companyId) {
        callback(new AppError("Company access is required", 403), "");
        return;
      }

      const uploadDirectory = path.resolve(getUploadRootPath(), getBrandingUploadRelativeDirectory(companyId));
      ensureUploadDirectory(uploadDirectory);
      callback(null, uploadDirectory);
    } catch (error) {
      callback(error as Error, "");
    }
  },
  filename: (_request, file, callback) => {
    try {
      callback(null, createSafeUploadFilename(file.originalname, file.mimetype));
    } catch (error) {
      callback(error as Error, "");
    }
  }
});

const uploader = multer({
  storage,
  limits: {
    fileSize: getMaxUploadSizeBytes()
  },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!isAllowedUploadMimeType(file.mimetype) || !isAllowedUploadExtension(extension)) {
      callback(new AppError("Only png, jpg, jpeg, and webp files are allowed", 400));
      return;
    }

    callback(null, true);
  }
});

export const uploadBrandingAsset = (request: Request, response: Response, next: NextFunction) => {
  uploader.single("file")(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new AppError(`Upload file size must not exceed ${env.MAX_UPLOAD_MB}MB`, 400));
      return;
    }

    next(error);
  });
};
