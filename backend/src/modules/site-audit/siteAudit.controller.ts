import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { siteAuditService } from "./siteAudit.service";

const getActor = (request: Request) => ({
  id: request.currentUser!.id,
  companyId: request.currentUser!.companyId!,
  role: request.currentUser!.role
});

const getContext = (request: Request) => ({
  ipAddress: getRequestIp(request),
  userAgent: getUserAgent(request)
});

export class SiteAuditController {
  public list = async (request: Request, response: Response): Promise<void> => {
    const data = await siteAuditService.list({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Site audits fetched successfully", data));
  };

  public getById = async (request: Request, response: Response): Promise<void> => {
    const data = await siteAuditService.getById({ companyId: request.currentUser!.companyId! }, String(request.params.id));
    response.json(successResponse("Site audit fetched successfully", data));
  };

  public create = async (request: Request, response: Response): Promise<void> => {
    const data = await siteAuditService.create(getActor(request), request.body, getContext(request));
    response.status(201).json(successResponse("Site audit created successfully", data));
  };

  public update = async (request: Request, response: Response): Promise<void> => {
    const data = await siteAuditService.update(getActor(request), String(request.params.id), request.body, getContext(request));
    response.json(successResponse("Site audit updated successfully", data));
  };

  public complete = async (request: Request, response: Response): Promise<void> => {
    const data = await siteAuditService.complete(getActor(request), String(request.params.id), request.body, getContext(request));
    response.json(successResponse("Site audit completed successfully", data));
  };

  public approve = async (request: Request, response: Response): Promise<void> => {
    const data = await siteAuditService.approve(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Site audit approved successfully", data));
  };

  public cancel = async (request: Request, response: Response): Promise<void> => {
    const data = await siteAuditService.cancel(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Site audit cancelled successfully", data));
  };

  public addFinding = async (request: Request, response: Response): Promise<void> => {
    const data = await siteAuditService.addFinding(getActor(request), String(request.params.id), request.body, getContext(request));
    response.status(201).json(successResponse("Site audit finding added successfully", data));
  };

  public updateFinding = async (request: Request, response: Response): Promise<void> => {
    const data = await siteAuditService.updateFinding(
      getActor(request),
      String(request.params.id),
      String(request.params.findingId),
      request.body,
      getContext(request)
    );
    response.json(successResponse("Site audit finding updated successfully", data));
  };

  public uploadAttachments = async (request: Request, response: Response): Promise<void> => {
    const files = Array.isArray(request.files) ? request.files : [];
    const data = await siteAuditService.uploadAttachments(getActor(request), String(request.params.id), files, getContext(request));
    response.status(201).json(successResponse("Site audit attachments uploaded successfully", data));
  };

  public deleteAttachment = async (request: Request, response: Response): Promise<void> => {
    const data = await siteAuditService.deleteAttachment(
      getActor(request),
      String(request.params.id),
      String(request.params.attachmentId),
      getContext(request)
    );
    response.json(successResponse("Site audit attachment removed successfully", data));
  };

  public exportById = async (request: Request, response: Response): Promise<void> => {
    const file = await siteAuditService.exportById(getActor(request), String(request.params.id), request.query as never, getContext(request));

    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  };
}

export const siteAuditController = new SiteAuditController();
