import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { securityAdminBackupService } from "./backup.service";

const getActor = (request: Request) => ({
  id: request.currentUser!.id,
  companyId: request.currentUser!.companyId!,
  role: request.currentUser!.role,
  fullName: request.currentUser!.fullName
});

const getContext = (request: Request) => ({
  ipAddress: request.ip ?? null,
  userAgent: request.get("user-agent") ?? null,
  requestMethod: request.method,
  requestPath: request.originalUrl
});

export class SecurityAdminBackupController {
  public listBackups = async (request: Request, response: Response) => {
    const data = await securityAdminBackupService.listBackups(getActor(request), request.query as never);
    response.json(successResponse("Backups fetched successfully", data));
  };

  public createBackup = async (request: Request, response: Response) => {
    const data = await securityAdminBackupService.createBackup(getActor(request), request.body, getContext(request));
    response.status(201).json(successResponse("Backup created successfully", data));
  };

  public downloadBackup = async (request: Request, response: Response) => {
    const file = await securityAdminBackupService.downloadBackup(getActor(request), String(request.params.id), getContext(request));
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  };

  public restoreBackup = async (request: Request, response: Response) => {
    const data = await securityAdminBackupService.restoreBackup(
      getActor(request),
      String(request.params.id),
      request.body,
      request.file,
      getContext(request)
    );
    response.json(successResponse("Backup restored successfully", data));
  };

  public deleteBackup = async (request: Request, response: Response) => {
    const data = await securityAdminBackupService.deleteBackup(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Backup deleted successfully", data));
  };
}

export const securityAdminBackupController = new SecurityAdminBackupController();
