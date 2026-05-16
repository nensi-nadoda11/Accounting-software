import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

import { env } from "../config/env";
import { AppError } from "./app-error";

const allowedMimeToExtensions: Record<string, string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"]
};

const allowedExtensions = new Set(Object.values(allowedMimeToExtensions).flat());
const allowedMimeTypes = new Set(Object.keys(allowedMimeToExtensions));

const normalizeRelativePath = (value: string) => value.replace(/\\/g, "/").replace(/^\/+/, "");

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const isPathInsideRoot = (candidatePath: string, rootPath: string) => {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedCandidate = path.resolve(candidatePath);
  const normalizedRoot = `${resolvedRoot.toLowerCase()}${path.sep}`;
  const normalizedCandidate = resolvedCandidate.toLowerCase();

  return normalizedCandidate === resolvedRoot.toLowerCase() || normalizedCandidate.startsWith(normalizedRoot);
};

export const getUploadRootPath = () => path.resolve(process.cwd(), env.UPLOAD_DIR);

export const getPublicUploadMountPath = () => {
  const rawBase = env.PUBLIC_UPLOAD_BASE_URL.trim();

  if (isAbsoluteHttpUrl(rawBase)) {
    const pathname = new URL(rawBase).pathname.replace(/\/+$/, "");
    return pathname || "/uploads";
  }

  const normalized = rawBase.replace(/^\/+/, "").replace(/\/+$/, "");
  return normalized ? `/${normalized}` : "/uploads";
};

export const ensureUploadDirectory = (directoryPath: string) => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

export const getMaxUploadSizeBytes = () => Math.floor(env.MAX_UPLOAD_MB * 1024 * 1024);

export const isAllowedUploadMimeType = (mimeType: string) => allowedMimeTypes.has(mimeType);

export const isAllowedUploadExtension = (extension: string) => allowedExtensions.has(extension.toLowerCase());

export const createSafeUploadFilename = (originalName: string, mimeType: string) => {
  const extension = path.extname(originalName).toLowerCase();
  const allowedForMime = allowedMimeToExtensions[mimeType];

  if (!allowedForMime || !allowedForMime.includes(extension)) {
    throw new AppError("Only png, jpg, jpeg, and webp files are allowed", 400);
  }

  return `${randomUUID()}${extension}`;
};

export const getBrandingUploadRelativeDirectory = (companyId: string) =>
  path.posix.join("company", companyId, "branding");

export const buildPublicUploadUrl = (relativePath: string) => {
  const normalizedPath = normalizeRelativePath(relativePath);
  const rawBase = env.PUBLIC_UPLOAD_BASE_URL.trim().replace(/\/+$/, "");

  if (isAbsoluteHttpUrl(rawBase)) {
    return `${rawBase}/${normalizedPath}`;
  }

  return `${getPublicUploadMountPath().replace(/\/+$/, "")}/${normalizedPath}`;
};

export const getRelativeUploadPathFromUrl = (fileUrl: string) => {
  const mountPath = getPublicUploadMountPath().replace(/\/+$/, "");

  if (isAbsoluteHttpUrl(fileUrl)) {
    const pathname = new URL(fileUrl).pathname;
    if (!pathname.startsWith(`${mountPath}/`)) {
      return null;
    }

    return normalizeRelativePath(pathname.slice(mountPath.length));
  }

  const normalizedFileUrl = fileUrl.startsWith("/") ? fileUrl : `/${fileUrl}`;
  if (!normalizedFileUrl.startsWith(`${mountPath}/`)) {
    return null;
  }

  return normalizeRelativePath(normalizedFileUrl.slice(mountPath.length));
};

export const deleteUploadFileByUrl = async (fileUrl: string | null | undefined) => {
  if (!fileUrl) {
    return;
  }

  const relativePath = getRelativeUploadPathFromUrl(fileUrl);
  if (!relativePath) {
    return;
  }

  const rootPath = getUploadRootPath();
  const absolutePath = path.resolve(rootPath, relativePath);

  if (!isPathInsideRoot(absolutePath, rootPath)) {
    return;
  }

  await fs.promises.rm(absolutePath, { force: true });
};
