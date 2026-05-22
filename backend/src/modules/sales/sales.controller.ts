import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { salesService } from "./sales.service";

export class SalesController {
  public listInvoices = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.listInvoices(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Sales invoices fetched successfully", data));
  };

  public createInvoice = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.createInvoice(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      },
      {
        canOverrideMinimumPrice:
          request.currentUser!.role === "admin" || (request.permissions?.has("product.price.manage") ?? false)
      }
    );

    response.status(201).json(successResponse("Sales invoice created successfully", data));
  };

  public createPosInvoice = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.createPosInvoice(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.body,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      },
      {
        canOverrideMinimumPrice:
          request.currentUser!.role === "admin" || (request.permissions?.has("product.price.manage") ?? false)
      }
    );

    response.status(201).json(successResponse("POS invoice created successfully", data));
  };

  public barcodeLookup = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.barcodeLookup(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Products fetched successfully", data));
  };

  public getInvoice = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.getInvoice(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Sales invoice fetched successfully", data));
  };

  public updateInvoice = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.updateInvoice(
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
      },
      {
        canOverrideMinimumPrice:
          request.currentUser!.role === "admin" || (request.permissions?.has("product.price.manage") ?? false)
      }
    );

    response.json(successResponse("Sales invoice updated successfully", data));
  };

  public deleteInvoice = async (request: Request, response: Response): Promise<void> => {
    await salesService.deleteInvoice(
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

    response.json(successResponse("Sales invoice deleted successfully", {}));
  };

  public postInvoice = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.postInvoice(
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

    response.json(successResponse("Sales invoice posted successfully", data));
  };

  public cancelInvoice = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.cancelInvoice(
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

    response.json(successResponse("Sales invoice cancelled successfully", data));
  };

  public listPayments = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.listPayments(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id),
      request.query as never
    );

    response.json(successResponse("Sales payments fetched successfully", data));
  };

  public recordPayment = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.recordPayment(
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

    response.status(201).json(successResponse("Sales payment recorded successfully", data));
  };

  public listReturns = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.listReturns(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Sales returns fetched successfully", data));
  };

  public createReturn = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.createReturn(
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

    response.status(201).json(successResponse("Sales return created successfully", data));
  };

  public getReturn = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.getReturn(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Sales return fetched successfully", data));
  };

  public recordReturnRefund = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.recordReturnRefund(
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

    response.status(201).json(successResponse("Sales return refund recorded successfully", data));
  };

  public exportInvoices = async (request: Request, response: Response): Promise<void> => {
    const file = await salesService.exportInvoices(
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

  public exportReturns = async (request: Request, response: Response): Promise<void> => {
    const file = await salesService.exportReturns(
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

  public generateInvoicePdf = async (request: Request, response: Response): Promise<void> => {
    const file = await salesService.generateInvoicePdf(
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

  public sendInvoiceEmail = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.sendInvoiceEmail(
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

    response.json(successResponse("Sales invoice email processed successfully", data));
  };

  public sendInvoiceWhatsapp = async (request: Request, response: Response): Promise<void> => {
    const data = await salesService.sendInvoiceWhatsapp(
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

    response.json(successResponse("Sales invoice WhatsApp attempt logged successfully", data));
  };
}

export const salesController = new SalesController();
