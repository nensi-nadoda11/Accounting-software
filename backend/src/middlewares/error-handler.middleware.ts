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
  const nestedCause = (error as { cause?: NodeJS.ErrnoException & { message?: string; code?: string } } | null)?.cause;

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

    if (constraint.includes("customers_company_customer_code_unique_idx")) {
      response.status(409).json(errorResponse("A customer with this code already exists"));
      return;
    }

    if (constraint.includes("customers_company_mobile_unique_idx")) {
      response.status(409).json(errorResponse("A customer with this mobile number already exists"));
      return;
    }

    if (constraint.includes("customers_company_email_unique_idx")) {
      response.status(409).json(errorResponse("A customer with this email already exists"));
      return;
    }

    if (constraint.includes("suppliers_company_supplier_code_unique_idx")) {
      response.status(409).json(errorResponse("A supplier with this code already exists"));
      return;
    }

    if (constraint.includes("suppliers_company_mobile_unique_idx")) {
      response.status(409).json(errorResponse("A supplier with this mobile number already exists"));
      return;
    }

    if (constraint.includes("suppliers_company_email_unique_idx")) {
      response.status(409).json(errorResponse("A supplier with this email already exists"));
      return;
    }

    if (constraint.includes("products_company_product_code_unique_idx")) {
      response.status(409).json(errorResponse("A product with this code already exists"));
      return;
    }

    if (constraint.includes("products_company_sku_unique_idx")) {
      response.status(409).json(errorResponse("A product with this SKU already exists"));
      return;
    }

    if (constraint.includes("products_company_barcode_unique_idx")) {
      response.status(409).json(errorResponse("A product with this barcode already exists"));
      return;
    }

    if (constraint.includes("product_categories_company_category_code_unique_idx")) {
      response.status(409).json(errorResponse("A category with this code already exists"));
      return;
    }

    if (constraint.includes("product_categories_company_name_unique_idx")) {
      response.status(409).json(errorResponse("A category with this name already exists"));
      return;
    }

    if (constraint.includes("product_units_company_symbol_unique_idx")) {
      response.status(409).json(errorResponse("A unit with this symbol already exists"));
      return;
    }

    if (constraint.includes("warehouses_company_warehouse_code_unique_idx")) {
      response.status(409).json(errorResponse("A warehouse with this code already exists"));
      return;
    }

    if (constraint.includes("warehouses_company_default_active_unique_idx")) {
      response.status(409).json(errorResponse("Only one active default warehouse is allowed per company"));
      return;
    }

    if (constraint.includes("product_batches_company_product_warehouse_batch_unique_idx")) {
      response
        .status(409)
        .json(errorResponse("A batch with this number already exists for the selected product and warehouse"));
      return;
    }

    if (constraint.includes("purchase_invoices_company_purchase_number_unique_idx")) {
      response.status(409).json(errorResponse("A purchase with this number already exists"));
      return;
    }

    if (constraint.includes("purchase_invoices_company_supplier_supplier_invoice_unique_idx")) {
      response.status(409).json(errorResponse("This supplier invoice number is already recorded for the supplier"));
      return;
    }

    if (constraint.includes("purchase_returns_company_return_number_unique_idx")) {
      response.status(409).json(errorResponse("A purchase return with this number already exists"));
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

    if (constraint.includes("payment_modes_company_mode_key_unique_idx")) {
      response.status(409).json(errorResponse("A payment mode with this key already exists"));
      return;
    }

    if (constraint.includes("payment_modes_company_default_enabled_unique_idx")) {
      response.status(409).json(errorResponse("Only one enabled default payment mode is allowed per company"));
      return;
    }

    if (constraint.includes("invoice_templates_company_template_key_unique_idx")) {
      response.status(409).json(errorResponse("An invoice template with this key already exists"));
      return;
    }

    if (constraint.includes("invoice_templates_company_type_default_unique_idx")) {
      response.status(409).json(errorResponse("Only one active default invoice template is allowed per invoice type"));
      return;
    }

    if (constraint.includes("chart_of_accounts_company_account_code_unique_idx")) {
      response.status(409).json(errorResponse("An account with this code already exists"));
      return;
    }

    if (constraint.includes("chart_of_accounts_company_system_key_unique_idx")) {
      response.status(409).json(errorResponse("This system account already exists for the company"));
      return;
    }

    if (constraint.includes("journal_entries_company_journal_number_unique_idx")) {
      response.status(409).json(errorResponse("A journal with this number already exists"));
      return;
    }

    if (constraint.includes("expense_categories_company_category_code_unique_idx")) {
      response.status(409).json(errorResponse("An expense category with this code already exists"));
      return;
    }

    if (constraint.includes("expense_categories_company_name_unique_idx")) {
      response.status(409).json(errorResponse("An expense category with this name already exists"));
      return;
    }

    if (constraint.includes("expenses_company_expense_number_unique_idx")) {
      response.status(409).json(errorResponse("An expense with this number already exists"));
      return;
    }

    if (constraint.includes("employees_company_employee_code_unique_idx")) {
      response.status(409).json(errorResponse("An employee with this code already exists"));
      return;
    }

    if (constraint.includes("employees_company_mobile_unique_idx")) {
      response.status(409).json(errorResponse("An employee with this mobile number already exists"));
      return;
    }

    if (constraint.includes("employees_company_email_unique_idx")) {
      response.status(409).json(errorResponse("An employee with this email already exists"));
      return;
    }

    if (constraint.includes("employee_salary_structures_company_employee_active_unique_idx")) {
      response.status(409).json(errorResponse("Only one active salary structure is allowed per employee"));
      return;
    }

    if (constraint.includes("employee_attendance_company_employee_month_unique_idx")) {
      response.status(409).json(errorResponse("Attendance already exists for this employee and month"));
      return;
    }

    if (constraint.includes("payroll_runs_company_run_number_unique_idx")) {
      response.status(409).json(errorResponse("A payroll run with this number already exists"));
      return;
    }

    if (constraint.includes("payroll_runs_company_month_active_unique_idx")) {
      response.status(409).json(errorResponse("A non-cancelled payroll run already exists for this month"));
      return;
    }

    if (constraint.includes("payroll_items_company_run_employee_unique_idx")) {
      response.status(409).json(errorResponse("Payroll is already generated for this employee in the selected run"));
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

  if (databaseError?.code === "23514" && databaseError.constraint?.includes("financial_period_locks_period_check")) {
    response.status(400).json(errorResponse("Period end must be greater than or equal to period start"));
    return;
  }

  const rawMessage = [
    (error as Error | undefined)?.message,
    nestedCause?.message
  ]
    .filter(Boolean)
    .join(" ");

  if (
    databaseError?.code === "XX000" &&
    rawMessage.toLowerCase().includes("max clients reached in session mode")
  ) {
    response.status(503).json(errorResponse("Database is temporarily busy. Please try again in a moment."));
    return;
  }

  const systemError = error as NodeJS.ErrnoException & { name?: string; message?: string };
  const serviceUnavailableCodes = new Set([
    "EAI_AGAIN",
    "ENOTFOUND",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ECONNRESET"
  ]);

  if (serviceUnavailableCodes.has(systemError?.code ?? "") || serviceUnavailableCodes.has(nestedCause?.code ?? "")) {
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
