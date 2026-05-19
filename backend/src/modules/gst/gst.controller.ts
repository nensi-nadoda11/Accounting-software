import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { gstService } from "./gst.service";

export class GstController {
  public getSummary = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.getSummary(
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

    response.json(successResponse("GST summary fetched successfully", data));
  };

  public listSales = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.listSales(
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

    response.json(successResponse("GST sales report fetched successfully", data));
  };

  public listPurchases = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.listPurchases(
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

    response.json(successResponse("GST purchase report fetched successfully", data));
  };

  public listItc = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.listItc(
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

    response.json(successResponse("GST ITC report fetched successfully", data));
  };

  public updateItcStatus = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.updateItcStatus(
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

    response.json(successResponse("GST ITC status updated successfully", data));
  };

  public getOutputTax = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.getOutputTax(
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

    response.json(successResponse("GST output tax fetched successfully", data));
  };

  public getHsnSummary = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.getHsnSummary(
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

    response.json(successResponse("GST HSN/SAC summary fetched successfully", data));
  };

  public getTaxSummary = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.getTaxSummary(
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

    response.json(successResponse("GST tax summary fetched successfully", data));
  };

  public listAdjustments = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.listAdjustments(
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

    response.json(successResponse("GST adjustments fetched successfully", data));
  };

  public createAdjustment = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.createAdjustment(
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

    response.status(201).json(successResponse("GST adjustment created successfully", data));
  };

  public cancelAdjustment = async (request: Request, response: Response): Promise<void> => {
    const data = await gstService.cancelAdjustment(
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

    response.json(successResponse("GST adjustment cancelled successfully", data));
  };

  public exportSales = async (request: Request, response: Response): Promise<void> => {
    const file = await gstService.exportSales(
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

  public exportPurchases = async (request: Request, response: Response): Promise<void> => {
    const file = await gstService.exportPurchases(
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

  public exportItc = async (request: Request, response: Response): Promise<void> => {
    const file = await gstService.exportItc(
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

  public exportHsnSummary = async (request: Request, response: Response): Promise<void> => {
    const file = await gstService.exportHsnSummary(
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

  public exportTaxSummary = async (request: Request, response: Response): Promise<void> => {
    const file = await gstService.exportTaxSummary(
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

  public exportGstr1 = async (request: Request, response: Response): Promise<void> => {
    const file = await gstService.exportGstr1(
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

  public exportGstr3b = async (request: Request, response: Response): Promise<void> => {
    const file = await gstService.exportGstr3b(
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
}

export const gstController = new GstController();
