import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

import { errorResponse } from "../utils/api-response";

type ValidationSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export const validateRequest = (schemas: ValidationSchemas) => {
  return (request: Request, response: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        request.body = schemas.body.parse(request.body);
      }

      if (schemas.query) {
        const parsedQuery = schemas.query.parse(request.query) as Record<string, unknown>;
        const currentQuery = request.query as Record<string, unknown>;

        for (const key of Object.keys(currentQuery)) {
          delete currentQuery[key];
        }

        Object.assign(currentQuery, parsedQuery);
      }

      if (schemas.params) {
        const parsedParams = schemas.params.parse(request.params) as Record<string, string>;
        const currentParams = request.params as Record<string, string>;

        for (const key of Object.keys(currentParams)) {
          delete currentParams[key];
        }

        Object.assign(currentParams, parsedParams);
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
