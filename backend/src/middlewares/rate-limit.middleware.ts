import type { NextFunction, Request, Response } from "express";

import { errorResponse } from "../utils/api-response";

type Bucket = {
  count: number;
  windowStart: number;
};

export const createRateLimiter = (options: { limit: number; windowMs: number; keyPrefix: string }) => {
  const buckets = new Map<string, Bucket>();

  return (request: Request, response: Response, next: NextFunction): void => {
    const ip = request.ip ?? "unknown";
    const key = `${options.keyPrefix}:${ip}`;
    const current = buckets.get(key);
    const now = Date.now();

    if (!current || now - current.windowStart >= options.windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    if (current.count >= options.limit) {
      response
        .status(429)
        .json(errorResponse("Too many requests. Please try again later."));
      return;
    }

    current.count += 1;
    buckets.set(key, current);
    next();
  };
};
