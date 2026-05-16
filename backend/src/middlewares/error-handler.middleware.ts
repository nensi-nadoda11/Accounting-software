import type { NextFunction, Request, Response } from "express";
import type { DatabaseError } from "pg";
import { ZodError } from "zod";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { errorResponse } from "../utils/api-response";
import { AppError } from "../utils/app-error";

export const errorHandler = (
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
): void => {
  if (error instanceof ZodError) {
    response.status(400).json(
      errorResponse(
        "Validation failed",
        error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      )
    );
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json(errorResponse(error.message, error.errors));
    return;
  }

  const databaseError = error as DatabaseError & { constraint?: string; code?: string; detail?: string };
  if (databaseError?.code === "23505") {
    const constraint = databaseError.constraint ?? "";

    if (constraint.includes("users_email")) {
      response.status(409).json(errorResponse("A user with this email already exists"));
      return;
    }

    if (constraint.includes("users_mobile_number")) {
      response.status(409).json(errorResponse("A user with this mobile number already exists"));
      return;
    }

    if (constraint.includes("company_branches_company_branch_code_unique_idx")) {
      response.status(409).json(errorResponse("A branch with this code already exists"));
      return;
    }

    if (constraint.includes("company_financial_years_active_company_unique_idx")) {
      response.status(409).json(errorResponse("Only one active financial year is allowed per company"));
      return;
    }

    if (constraint.includes("company_bank_accounts_default_active_unique_idx")) {
      response.status(409).json(errorResponse("Only one active default bank account is allowed per company"));
      return;
    }

    response.status(409).json(errorResponse("Duplicate record already exists"));
    return;
  }

  if (databaseError?.code === "23503") {
    response.status(400).json(errorResponse("The requested related record was not found or is invalid."));
    return;
  }

  if (databaseError?.code === "22P02") {
    response.status(400).json(errorResponse("Invalid input provided. Please review the submitted data."));
    return;
  }

  if (databaseError?.code === "23514" && databaseError.constraint?.includes("company_financial_years_date_check")) {
    response.status(400).json(errorResponse("End date must be greater than start date"));
    return;
  }

  const systemError = error as NodeJS.ErrnoException & { name?: string; message?: string };
  if (systemError?.code === "ENOTFOUND" || systemError?.code === "ECONNREFUSED" || systemError?.code === "ETIMEDOUT") {
    response.status(503).json(errorResponse("A required service is currently unavailable. Please try again later."));
    return;
  }

  if (systemError?.name === "JsonWebTokenError" || systemError?.name === "TokenExpiredError") {
    response.status(401).json(errorResponse("Your session is invalid or expired. Please login again."));
    return;
  }

  logger.error("Unhandled error", error);

  response.status(500).json(errorResponse("Something went wrong. Please try again."));
};
