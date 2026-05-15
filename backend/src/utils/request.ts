import type { Request } from "express";

export const getRequestIp = (request: Request): string =>
  request.ip ?? (request.headers["x-forwarded-for"] as string | undefined) ?? "unknown";

export const getUserAgent = (request: Request): string => request.get("user-agent") ?? "unknown";
