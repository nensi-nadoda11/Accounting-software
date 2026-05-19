import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { reportsService } from "./reports.service";

const getActor = (request: Request) => ({
  id: request.currentUser!.id,
  companyId: request.currentUser!.companyId!,
  role: request.currentUser!.role
});

const getContext = (request: Request) => ({
  ipAddress: getRequestIp(request),
  userAgent: getUserAgent(request)
});

export class ReportsController {
  public getOverview = async (request: Request, response: Response) => {
    const data = await reportsService.getOverview(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Reports overview fetched successfully", data));
  };

  public listExports = async (request: Request, response: Response) => {
    const data = await reportsService.listExports(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Report exports fetched successfully", data));
  };

  public getSalesSummary = async (request: Request, response: Response) => {
    const data = await reportsService.getSalesSummary(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Sales summary fetched successfully", data));
  };

  public getSalesDetailed = async (request: Request, response: Response) => {
    const data = await reportsService.getSalesDetailed(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Sales detailed report fetched successfully", data));
  };

  public getSalesTopCustomers = async (request: Request, response: Response) => {
    const data = await reportsService.getSalesTopCustomers(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Top customers fetched successfully", data));
  };

  public getSalesTopProducts = async (request: Request, response: Response) => {
    const data = await reportsService.getSalesTopProducts(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Top products fetched successfully", data));
  };

  public getPurchasesSummary = async (request: Request, response: Response) => {
    const data = await reportsService.getPurchasesSummary(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Purchase summary fetched successfully", data));
  };

  public getPurchasesDetailed = async (request: Request, response: Response) => {
    const data = await reportsService.getPurchasesDetailed(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Purchase detailed report fetched successfully", data));
  };

  public getCustomersLedger = async (request: Request, response: Response) => {
    const data = await reportsService.getCustomersLedger(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Customer ledger fetched successfully", data));
  };

  public getCustomersOutstanding = async (request: Request, response: Response) => {
    const data = await reportsService.getCustomersOutstanding(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Customer outstanding report fetched successfully", data));
  };

  public getCustomersAging = async (request: Request, response: Response) => {
    const data = await reportsService.getCustomersAging(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Customer aging report fetched successfully", data));
  };

  public getSuppliersLedger = async (request: Request, response: Response) => {
    const data = await reportsService.getSuppliersLedger(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Supplier ledger fetched successfully", data));
  };

  public getSuppliersOutstanding = async (request: Request, response: Response) => {
    const data = await reportsService.getSuppliersOutstanding(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Supplier outstanding report fetched successfully", data));
  };

  public getSuppliersAging = async (request: Request, response: Response) => {
    const data = await reportsService.getSuppliersAging(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Supplier aging report fetched successfully", data));
  };

  public getInventoryCurrentStock = async (request: Request, response: Response) => {
    const data = await reportsService.getInventoryCurrentStock(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Current stock report fetched successfully", data));
  };

  public getInventoryValuation = async (request: Request, response: Response) => {
    const data = await reportsService.getInventoryValuation(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Inventory valuation fetched successfully", data));
  };

  public getInventoryExpiry = async (request: Request, response: Response) => {
    const data = await reportsService.getInventoryExpiry(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Inventory expiry report fetched successfully", data));
  };

  public getInventoryMovement = async (request: Request, response: Response) => {
    const data = await reportsService.getInventoryMovement(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Inventory movement report fetched successfully", data));
  };

  public getInventoryLowStock = async (request: Request, response: Response) => {
    const data = await reportsService.getInventoryLowStock(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Low stock report fetched successfully", data));
  };

  public getExpenseCategoryWise = async (request: Request, response: Response) => {
    const data = await reportsService.getExpenseCategoryWise(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Expense category-wise report fetched successfully", data));
  };

  public getExpenseMonthly = async (request: Request, response: Response) => {
    const data = await reportsService.getExpenseMonthly(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Monthly expense report fetched successfully", data));
  };

  public getExpensePaymentMode = async (request: Request, response: Response) => {
    const data = await reportsService.getExpensePaymentMode(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Expense payment-mode report fetched successfully", data));
  };

  public getIncomeSummary = async (request: Request, response: Response) => {
    const data = await reportsService.getIncomeSummary(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Income summary fetched successfully", data));
  };

  public getIncomeMonthly = async (request: Request, response: Response) => {
    const data = await reportsService.getIncomeMonthly(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Monthly income fetched successfully", data));
  };

  public getPayrollMonthly = async (request: Request, response: Response) => {
    const data = await reportsService.getPayrollMonthly(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Monthly payroll fetched successfully", data));
  };

  public getPayrollEmployee = async (request: Request, response: Response) => {
    const data = await reportsService.getPayrollEmployee(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Employee payroll report fetched successfully", data));
  };

  public getPayrollDepartment = async (request: Request, response: Response) => {
    const data = await reportsService.getPayrollDepartment(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Department payroll report fetched successfully", data));
  };

  public getGstSummary = async (request: Request, response: Response) => {
    const data = await reportsService.getGstSummary(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("GST summary fetched successfully", data));
  };

  public getGstHsn = async (request: Request, response: Response) => {
    const data = await reportsService.getGstHsn(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("GST HSN report fetched successfully", data));
  };

  public getTrialBalance = async (request: Request, response: Response) => {
    const data = await reportsService.getTrialBalance(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Trial balance fetched successfully", data));
  };

  public getProfitLoss = async (request: Request, response: Response) => {
    const data = await reportsService.getProfitLoss(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Profit and loss fetched successfully", data));
  };

  public getBalanceSheet = async (request: Request, response: Response) => {
    const data = await reportsService.getBalanceSheet(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Balance sheet fetched successfully", data));
  };

  public getCashBook = async (request: Request, response: Response) => {
    const data = await reportsService.getCashBook(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Cash book fetched successfully", data));
  };

  public getBankBook = async (request: Request, response: Response) => {
    const data = await reportsService.getBankBook(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Bank book fetched successfully", data));
  };

  public exportReport = async (request: Request, response: Response) => {
    const file = await reportsService.exportReport(getActor(request), request.query as never, getContext(request));
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  };
}

export const reportsController = new ReportsController();
