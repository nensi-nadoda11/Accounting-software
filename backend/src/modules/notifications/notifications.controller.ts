import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { notificationsService } from "./notifications.service";

const getActor = (request: Request) => ({
  id: request.currentUser!.id,
  companyId: request.currentUser!.companyId!,
  role: request.currentUser!.role,
  permissions: request.permissions as Set<string> | undefined
});

const getContext = (request: Request) => ({
  ipAddress: getRequestIp(request) ?? null,
  userAgent: getUserAgent(request) ?? null
});

export class NotificationsController {
  public listNotifications = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.listNotifications(getActor(request), request.query as never);
    response.json(successResponse("Notifications fetched successfully", data));
  };

  public getUnreadCount = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.getUnreadCount(getActor(request));
    response.json(successResponse("Unread notification count fetched successfully", data));
  };

  public listRecipients = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.listRecipients(getActor(request));
    response.json(successResponse("Notification recipients fetched successfully", data));
  };

  public markRead = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.markRead(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Notification marked as read", data));
  };

  public markAllRead = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.markAllRead(getActor(request), getContext(request));
    response.json(successResponse("Notifications marked as read", data));
  };

  public deleteNotification = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.deleteNotification(getActor(request), String(request.params.id), getContext(request));
    response.json(successResponse("Notification deleted successfully", data));
  };

  public getPreferences = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.getPreferences(getActor(request));
    response.json(successResponse("Notification preferences fetched successfully", data));
  };

  public updatePreferences = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.updatePreferences(getActor(request), request.body, getContext(request));
    response.json(successResponse("Notification preferences updated successfully", data));
  };

  public listTemplates = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.listTemplates(getActor(request), request.query as never);
    response.json(successResponse("Notification templates fetched successfully", data));
  };

  public createTemplate = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.createTemplate(getActor(request), request.body, getContext(request));
    response.status(201).json(successResponse("Notification template created successfully", data));
  };

  public updateTemplate = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.updateTemplate(
      getActor(request),
      String(request.params.id),
      request.body,
      getContext(request)
    );
    response.json(successResponse("Notification template updated successfully", data));
  };

  public listLogs = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.listLogs(getActor(request), request.query as never);
    response.json(successResponse("Notification logs fetched successfully", data));
  };

  public sendNotification = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.sendManualNotification(getActor(request), request.body, getContext(request));
    response.status(201).json(successResponse("Notification processed successfully", data));
  };

  public runDueReminders = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.runDueReminders(getActor(request), getContext(request));
    response.json(successResponse("Due reminders job completed", data));
  };

  public runLowStockCheck = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.runLowStockCheck(getActor(request), getContext(request));
    response.json(successResponse("Low stock job completed", data));
  };

  public runExpiryCheck = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.runExpiryCheck(getActor(request), getContext(request));
    response.json(successResponse("Expiry job completed", data));
  };

  public runInvoiceReminders = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.runInvoiceReminders(getActor(request), getContext(request));
    response.json(successResponse("Invoice reminder job completed", data));
  };

  public runGstReminders = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.runGstReminders(getActor(request), getContext(request));
    response.json(successResponse("GST reminder job completed", data));
  };

  public runPayrollReminders = async (request: Request, response: Response): Promise<void> => {
    const data = await notificationsService.runPayrollReminders(getActor(request), getContext(request));
    response.json(successResponse("Payroll reminder job completed", data));
  };
}

export const notificationsController = new NotificationsController();
