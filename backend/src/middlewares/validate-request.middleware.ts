import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

import { errorResponse } from "../utils/api-response";

type ValidationSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

type MutableRecord = Record<string, unknown>;

const setRequestValue = (request: Request, key: "body" | "params", value: unknown) => {
  Object.defineProperty(request, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value
  });
};

const isMutableRecord = (value: unknown): value is MutableRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const syncObjectValues = (target: MutableRecord, source: MutableRecord) => {
  Object.keys(target).forEach((key) => {
    delete target[key];
  });

  Object.assign(target, source);
};

export const validateRequest = (schemas: ValidationSchemas) => {
  return (request: Request, response: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        setRequestValue(request, "body", schemas.body.parse(request.body));
      }

      if (schemas.query) {
        const parsedQuery = schemas.query.parse(request.query);
        response.locals.validatedQuery = parsedQuery;

        if (isMutableRecord(request.query) && isMutableRecord(parsedQuery)) {
          syncObjectValues(request.query as MutableRecord, parsedQuery);
        }
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
