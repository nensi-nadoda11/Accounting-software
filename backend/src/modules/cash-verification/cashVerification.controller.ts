import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { cashVerificationService } from "./cashVerification.service";

const getActor = (request: Request) => ({
  id: request.currentUser!.id,
  companyId: request.currentUser!.companyId!,
  role: request.currentUser!.role
});

const getContext = (request: Request) => ({
  ipAddress: getRequestIp(request),
  userAgent: getUserAgent(request)
});

export class CashVerificationController {
  public list = async (request: Request, response: Response): Promise<void> => {
    const data = await cashVerificationService.list({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Cash verifications fetched successfully", data));
  };

  public getCurrentBalance = async (request: Request, response: Response): Promise<void> => {
    const data = await cashVerificationService.getCurrentBalance({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Current cash balance fetched successfully", data));
  };

  public getById = async (request: Request, response: Response): Promise<void> => {
    const data = await cashVerificationService.getById({ companyId: request.currentUser!.companyId! }, String(request.params.id));
    response.json(successResponse("Cash verification fetched successfully", data));
  };

  public create = async (request: Request, response: Response): Promise<void> => {
    const data = await cashVerificationService.create(getActor(request), request.body, getContext(request));
    response.status(201).json(successResponse("Cash verification created successfully", data));
  };

  public update = async (request: Request, response: Response): Promise<void> => {
    const data = await cashVerificationService.update(getActor(request), String(request.params.id), request.body, getContext(request));
    response.json(successResponse("Cash verification updated successfully", data));
  };

  public complete = async (request: Request, response: Response): Promise<void> => {
    const data = await cashVerificationService.complete(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Cash verification completed successfully", data));
  };

  public approve = async (request: Request, response: Response): Promise<void> => {
    const data = await cashVerificationService.approve(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Cash verification approved successfully", data));
  };

  public exportById = async (request: Request, response: Response): Promise<void> => {
    const file = await cashVerificationService.exportById(
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

export const cashVerificationController = new CashVerificationController();
