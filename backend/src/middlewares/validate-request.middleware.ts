import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

import { errorResponse } from "../utils/api-response";

type ValidationSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

const setRequestValue = (request: Request, key: "body" | "query" | "params", value: unknown) => {
  Object.defineProperty(request, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value
  });
};

export const validateRequest = (schemas: ValidationSchemas) => {
  return (request: Request, response: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        setRequestValue(request, "body", schemas.body.parse(request.body));
      }

      if (schemas.query) {
        setRequestValue(request, "query", schemas.query.parse(request.query));
      }

      if (schemas.params) {
        setRequestValue(request, "params", schemas.params.parse(request.params));
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        response.status(400).json(
          errorResponse(
            "Validation failed",
            error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          )
        );
        return;
      }

      next(error);
    }
  };
};
