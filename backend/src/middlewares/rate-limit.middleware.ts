import type { NextFunction, Request, Response } from "express";

import { runtimeSecurityService } from "../services/runtime-security.service";
import { errorResponse } from "../utils/api-response";

export const createRateLimiter = (options: { limit: number; windowMs: number; keyPrefix: string }) => {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = [request.auth?.sub, request.ip ?? "unknown"].filter(Boolean).join(":");
      const result = await runtimeSecurityService.consumeRateLimit({
        identifier,
        keyPrefix: options.keyPrefix,
        limit: options.limit,
        windowMs: options.windowMs
      });

      if (!result.allowed) {
        response.setHeader("Retry-After", Math.max(1, Math.ceil(result.retryAfterMs / 1000)).toString());
        response.status(429).json(errorResponse("Too many requests. Please try again later."));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
