import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { paymentsService } from "./payments.service";

export class PaymentsController {
  public listPayments = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.listPayments(
      { companyId: request.currentUser!.companyId! },
      request.query as never
    );

    response.json(successResponse("Payments fetched successfully", data));
  };

  public createPayment = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.createPayment(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.status(201).json(successResponse("Payment created successfully", data));
  };

  public getPayment = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.getPayment(
      { companyId: request.currentUser!.companyId! },
      String(request.params.id)
    );

    response.json(successResponse("Payment fetched successfully", data));
  };

  public updatePayment = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.updatePayment(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Payment updated successfully", data));
  };

  public completePayment = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.completePayment(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Payment completed successfully", data));
  };

  public cancelPayment = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.cancelPayment(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Payment cancelled successfully", data));
  };

  public exportPayments = async (request: Request, response: Response): Promise<void> => {
    const file = await paymentsService.exportPayments(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.query as never,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  };

  public listAllocations = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.listAllocations(
      { companyId: request.currentUser!.companyId! },
      String(request.params.id)
    );

    response.json(successResponse("Payment allocations fetched successfully", data));
  };

  public upsertAllocations = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.upsertAllocations(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      false,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Payment allocations saved successfully", data));
  };

  public replaceAllocations = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.upsertAllocations(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      true,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Payment allocations replaced successfully", data));
  };

  public listCustomerDues = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.listCustomerDues(
      { companyId: request.currentUser!.companyId! },
      request.query as never
    );

    response.json(successResponse("Customer dues fetched successfully", data));
  };

  public listSupplierDues = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.listSupplierDues(
      { companyId: request.currentUser!.companyId! },
      request.query as never
    );

    response.json(successResponse("Supplier dues fetched successfully", data));
  };

  public getPartyDueItems = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.getPartyDueItems(
      { companyId: request.currentUser!.companyId! },
      String(request.params.type),
      String(request.params.id)
    );

    response.json(successResponse("Party due items fetched successfully", data));
  };

  public getReceipt = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.getReceipt(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Payment receipt fetched successfully", data));
  };

  public getReceiptPdf = async (request: Request, response: Response): Promise<void> => {
    const file = await paymentsService.getReceiptPdf(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    response.send(file.content);
  };

  public sendReceipt = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.sendReceipt(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Payment receipt processed successfully", data));
  };

  public listReminders = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.listReminders(
      { companyId: request.currentUser!.companyId! },
      request.query as never
    );

    response.json(successResponse("Payment reminders fetched successfully", data));
  };

  public sendReminder = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.sendReminder(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.status(201).json(successResponse("Payment reminder processed successfully", data));
  };

  public updateReminderStatus = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.updateReminderStatus(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Payment reminder updated successfully", data));
  };

  public updateChequeStatus = async (request: Request, response: Response): Promise<void> => {
    const data = await paymentsService.updateChequeStatus(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Cheque status updated successfully", data));
  };
}

export const paymentsController = new PaymentsController();
