import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { securityAdminAuditService } from "./audit.service";

const getActor = (request: Request) => ({
  id: request.currentUser!.id,
  companyId: request.currentUser!.companyId!,
  role: request.currentUser!.role,
  fullName: request.currentUser!.fullName
});

export class SecurityAdminAuditController {
  public listAuditLogs = async (request: Request, response: Response) => {
    const data = await securityAdminAuditService.listAuditLogs(getActor(request), request.query as never);
    response.json(successResponse("Audit logs fetched successfully", data));
  };

  public exportAuditLogs = async (request: Request, response: Response) => {
    const file = await securityAdminAuditService.exportAuditLogs(getActor(request), request.query as never);
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  };

  public listLoginLogs = async (request: Request, response: Response) => {
    const data = await securityAdminAuditService.listLoginLogs(getActor(request), request.query as never);
    response.json(successResponse("Login logs fetched successfully", data));
  };

  public listRestoreLogs = async (request: Request, response: Response) => {
    const data = await securityAdminAuditService.listRestoreLogs(getActor(request), request.query as never);
    response.json(successResponse("Restore logs fetched successfully", data));
  };
}

export const securityAdminAuditController = new SecurityAdminAuditController();
