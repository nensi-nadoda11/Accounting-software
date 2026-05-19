import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { settingsService } from "./settings.service";
import type { SettingsActor } from "./settings.types";

const getActor = (request: Request): SettingsActor => ({
  id: request.currentUser!.id,
  companyId: request.currentUser!.companyId!,
  role: request.currentUser!.role,
  permissions: Array.from(request.permissions ?? []),
  email: request.currentUser!.email
});

const getContext = (request: Request) => ({
  ipAddress: getRequestIp(request),
  userAgent: getUserAgent(request)
});

export class SettingsController {
  public getOverview = async (request: Request, response: Response) => {
    const data = await settingsService.getOverview(getActor(request));
    response.json(successResponse("Settings overview fetched successfully", data));
  };

  public getPermissions = async (request: Request, response: Response) => {
    const data = await settingsService.getPermissionsMatrix(getActor(request));
    response.json(successResponse("Permission matrix fetched successfully", data));
  };

  public updateUserPermissions = async (request: Request, response: Response) => {
    const data = await settingsService.updateUserPermissions(
      getActor(request),
      String(request.params.userId),
      request.body.permissions,
      getContext(request)
    );

    response.json(successResponse("User permissions updated successfully", data));
  };

  public updateRolePermissions = async (request: Request, response: Response) => {
    const data = await settingsService.updateRolePermissions(
      getActor(request),
      request.params.role as SettingsActor["role"],
      request.body.permissions,
      getContext(request)
    );

    response.json(successResponse("Role permissions updated successfully", data));
  };

  public listInvoiceTemplates = async (request: Request, response: Response) => {
    const data = await settingsService.listInvoiceTemplates(request.currentUser!.companyId!);
    response.json(successResponse("Invoice templates fetched successfully", data));
  };

  public createInvoiceTemplate = async (request: Request, response: Response) => {
    const data = await settingsService.createInvoiceTemplate(getActor(request), request.body, getContext(request));
    response.status(201).json(successResponse("Invoice template created successfully", data));
  };

  public updateInvoiceTemplate = async (request: Request, response: Response) => {
    const data = await settingsService.updateInvoiceTemplate(
      getActor(request),
      String(request.params.id),
      request.body,
      getContext(request)
    );

    response.json(successResponse("Invoice template updated successfully", data));
  };

  public setDefaultInvoiceTemplate = async (request: Request, response: Response) => {
    const data = await settingsService.setDefaultInvoiceTemplate(
      getActor(request),
      String(request.params.id),
      getContext(request)
    );

    response.json(successResponse("Default invoice template updated successfully", data));
  };

  public deleteInvoiceTemplate = async (request: Request, response: Response) => {
    await settingsService.deleteInvoiceTemplate(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Invoice template deleted successfully", {}));
  };

  public getTaxSettings = async (request: Request, response: Response) => {
    const data = await settingsService.getTaxSettings(request.currentUser!.companyId!);
    response.json(successResponse("Tax settings fetched successfully", data));
  };

  public updateTaxSettings = async (request: Request, response: Response) => {
    const data = await settingsService.updateTaxSettings(getActor(request), request.body, getContext(request));
    response.json(successResponse("Tax settings updated successfully", data));
  };

  public listPaymentModes = async (request: Request, response: Response) => {
    const data = await settingsService.listPaymentModes(request.currentUser!.companyId!);
    response.json(successResponse("Payment modes fetched successfully", data));
  };

  public createPaymentMode = async (request: Request, response: Response) => {
    const data = await settingsService.createPaymentMode(getActor(request), request.body, getContext(request));
    response.status(201).json(successResponse("Payment mode created successfully", data));
  };

  public updatePaymentMode = async (request: Request, response: Response) => {
    const data = await settingsService.updatePaymentMode(
      getActor(request),
      String(request.params.id),
      request.body,
      getContext(request)
    );

    response.json(successResponse("Payment mode updated successfully", data));
  };

  public setDefaultPaymentMode = async (request: Request, response: Response) => {
    const data = await settingsService.setDefaultPaymentMode(
      getActor(request),
      String(request.params.id),
      getContext(request)
    );

    response.json(successResponse("Default payment mode updated successfully", data));
  };

  public deletePaymentMode = async (request: Request, response: Response) => {
    await settingsService.deletePaymentMode(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Payment mode deleted successfully", {}));
  };

  public getUiPreferences = async (request: Request, response: Response) => {
    const data = await settingsService.getUiPreferences(getActor(request));
    response.json(successResponse("UI preferences fetched successfully", data));
  };

  public updateUiPreferences = async (request: Request, response: Response) => {
    const data = await settingsService.updateUiPreferences(getActor(request), request.body, getContext(request));
    response.json(successResponse("UI preferences updated successfully", data));
  };

  public getProfileSettings = async (request: Request, response: Response) => {
    const data = await settingsService.getProfileSettings(getActor(request));
    response.json(successResponse("Profile settings fetched successfully", data));
  };

  public updateProfileSettings = async (request: Request, response: Response) => {
    const data = await settingsService.updateProfileSettings(getActor(request), request.body, getContext(request));
    response.json(successResponse("Profile settings updated successfully", data));
  };

  public changePassword = async (request: Request, response: Response) => {
    await settingsService.changePassword(
      getActor(request),
      request.auth!.sessionId,
      request.body,
      getContext(request)
    );

    response.json(successResponse("Password changed successfully", {}));
  };

  public logoutAll = async (request: Request, response: Response) => {
    await settingsService.logoutAll(getActor(request), getContext(request));
    response.json(successResponse("All devices logged out successfully", {}));
  };
}

export const settingsController = new SettingsController();
