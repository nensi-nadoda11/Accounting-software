import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { dashboardService } from "./dashboard.service";

const getActor = (request: Request) => ({
  id: request.currentUser!.id,
  companyId: request.currentUser!.companyId!,
  role: request.currentUser!.role,
  permissions: request.permissions
});

const getContext = (request: Request) => ({
  ipAddress: getRequestIp(request),
  userAgent: getUserAgent(request)
});

export class DashboardController {
  public getSummary = async (request: Request, response: Response) => {
    const data = await dashboardService.getSummary(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Dashboard summary fetched successfully", data));
  };

  public getSalesChart = async (request: Request, response: Response) => {
    const data = await dashboardService.getChart(getActor(request), "sales", request.query as never, getContext(request));
    response.json(successResponse("Dashboard sales chart fetched successfully", data));
  };

  public getPurchasesChart = async (request: Request, response: Response) => {
    const data = await dashboardService.getChart(getActor(request), "purchases", request.query as never, getContext(request));
    response.json(successResponse("Dashboard purchases chart fetched successfully", data));
  };

  public getExpensesChart = async (request: Request, response: Response) => {
    const data = await dashboardService.getChart(getActor(request), "expenses", request.query as never, getContext(request));
    response.json(successResponse("Dashboard expenses chart fetched successfully", data));
  };

  public getPaymentsChart = async (request: Request, response: Response) => {
    const data = await dashboardService.getChart(getActor(request), "payments", request.query as never, getContext(request));
    response.json(successResponse("Dashboard payments chart fetched successfully", data));
  };

  public getTopProducts = async (request: Request, response: Response) => {
    const data = await dashboardService.getTopProducts(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Dashboard top products fetched successfully", data));
  };

  public getRecentActivities = async (request: Request, response: Response) => {
    const data = await dashboardService.getRecentActivities(getActor(request), request.query as never, getContext(request));
    response.json(successResponse("Dashboard recent activities fetched successfully", data));
  };

  public getAlerts = async (request: Request, response: Response) => {
    const data = await dashboardService.getAlerts(getActor(request), getContext(request));
    response.json(successResponse("Dashboard alerts fetched successfully", data));
  };

  public getPendingTasks = async (request: Request, response: Response) => {
    const data = await dashboardService.getPendingTasks(getActor(request), getContext(request));
    response.json(successResponse("Dashboard pending tasks fetched successfully", data));
  };

  public getRoleDashboard = async (request: Request, response: Response) => {
    const data = await dashboardService.getRoleDashboard(getActor(request), getContext(request));
    response.json(successResponse("Role dashboard fetched successfully", data));
  };
}

export const dashboardController = new DashboardController();
