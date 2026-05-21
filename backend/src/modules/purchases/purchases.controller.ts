import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { purchasesService } from "./purchases.service";

export class PurchasesController {
  public listPurchases = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.listPurchases(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Purchases fetched successfully", data));
  };

  public createPurchase = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.createPurchase(
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
        canApprove: request.permissions?.has("purchase.approve") ?? false
      }
    );

    response.status(201).json(successResponse("Purchase created successfully", data));
  };

  public getPurchase = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.getPurchase(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Purchase fetched successfully", data));
  };

  public updatePurchase = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.updatePurchase(
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

    response.json(successResponse("Purchase updated successfully", data));
  };

  public deletePurchase = async (request: Request, response: Response): Promise<void> => {
    await purchasesService.deletePurchase(
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

    response.json(successResponse("Purchase deleted successfully", {}));
  };

  public postPurchase = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.postPurchase(
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

    response.json(successResponse("Purchase posted successfully", data));
  };

  public cancelPurchase = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.cancelPurchase(
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

    response.json(successResponse("Purchase cancelled successfully", data));
  };

  public listPayments = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.listPayments(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id),
      request.query as never
    );

    response.json(successResponse("Purchase payments fetched successfully", data));
  };

  public recordPayment = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.recordPayment(
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

    response.status(201).json(successResponse("Purchase payment recorded successfully", data));
  };

  public listReturns = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.listReturns(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Purchase returns fetched successfully", data));
  };

  public createReturn = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.createReturn(
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

    response.status(201).json(successResponse("Purchase return created successfully", data));
  };

  public getReturn = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.getReturn(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Purchase return fetched successfully", data));
  };

  public recordReturnRefund = async (request: Request, response: Response): Promise<void> => {
    const data = await purchasesService.recordReturnRefund(
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

    response.status(201).json(successResponse("Purchase return refund recorded successfully", data));
  };

  public exportPurchases = async (request: Request, response: Response): Promise<void> => {
    const file = await purchasesService.exportPurchases(
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

  public generatePurchasePdf = async (request: Request, response: Response): Promise<void> => {
    const file = await purchasesService.generatePurchasePdf(
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

  public exportReturns = async (request: Request, response: Response): Promise<void> => {
    const file = await purchasesService.exportReturns(
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

  public generateReturnPdf = async (request: Request, response: Response): Promise<void> => {
    const file = await purchasesService.generateReturnPdf(
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
}

export const purchasesController = new PurchasesController();
