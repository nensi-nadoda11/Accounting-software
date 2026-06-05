import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { stockCheckService } from "./stockCheck.service";

const getActor = (request: Request) => ({
  id: request.currentUser!.id,
  companyId: request.currentUser!.companyId!,
  role: request.currentUser!.role
});

const getContext = (request: Request) => ({
  ipAddress: getRequestIp(request),
  userAgent: getUserAgent(request)
});

export class StockCheckController {
  public list = async (request: Request, response: Response): Promise<void> => {
    const data = await stockCheckService.list({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Stock checks fetched successfully", data));
  };

  public getById = async (request: Request, response: Response): Promise<void> => {
    const data = await stockCheckService.getById({ companyId: request.currentUser!.companyId! }, String(request.params.id));
    response.json(successResponse("Stock check fetched successfully", data));
  };

  public create = async (request: Request, response: Response): Promise<void> => {
    const data = await stockCheckService.create(getActor(request), request.body, getContext(request));
    response.status(201).json(successResponse("Stock check created successfully", data));
  };

  public update = async (request: Request, response: Response): Promise<void> => {
    const data = await stockCheckService.update(getActor(request), String(request.params.id), request.body, getContext(request));
    response.json(successResponse("Stock check updated successfully", data));
  };

  public complete = async (request: Request, response: Response): Promise<void> => {
    const data = await stockCheckService.complete(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Stock check completed successfully", data));
  };

  public approve = async (request: Request, response: Response): Promise<void> => {
    const data = await stockCheckService.approve(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Stock check approved successfully", data));
  };

  public exportById = async (request: Request, response: Response): Promise<void> => {
    const file = await stockCheckService.exportById(
      getActor(request),
      String(request.params.id),
      request.query as never,
      getContext(request)
    );

    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  };
}

export const stockCheckController = new StockCheckController();
