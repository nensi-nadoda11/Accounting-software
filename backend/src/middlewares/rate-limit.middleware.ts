import type { NextFunction, Request, Response } from "express";

import { logger } from "../config/logger";
import { runtimeSecurityService } from "../services/runtime-security.service";
import { errorResponse } from "../utils/api-response";

const isTransientInfraError = (error: unknown) => {
  const systemError = error as NodeJS.ErrnoException & { cause?: NodeJS.ErrnoException };
  const codes = [systemError?.code, systemError?.cause?.code].filter(Boolean);
  const message = [systemError?.message, systemError?.cause?.message].filter(Boolean).join(" ").toLowerCase();

  return (
    codes.some((code) =>
      ["EAI_AGAIN", "ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "EHOSTUNREACH", "ECONNRESET"].includes(code as string)
    ) || message.includes("max clients reached in session mode")
  );
};

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
      if (isTransientInfraError(error)) {
        logger.warn("Rate limiter bypassed due to transient infrastructure error", {
          keyPrefix: options.keyPrefix,
          error
        });
        next();
        return;
      }

      next(error);
    }
  };
};
