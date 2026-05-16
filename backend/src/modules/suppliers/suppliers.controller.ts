import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { suppliersService } from "./suppliers.service";

export class SuppliersController {
  public listSuppliers = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.listSuppliers(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Suppliers fetched successfully", data));
  };

  public createSupplier = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.createSupplier(
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

    response.status(201).json(successResponse("Supplier created successfully", data));
  };

  public getSupplier = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.getSupplier(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Supplier fetched successfully", data));
  };

  public updateSupplier = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.updateSupplier(
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

    response.json(successResponse("Supplier updated successfully", data));
  };

  public deleteSupplier = async (request: Request, response: Response): Promise<void> => {
    await suppliersService.deleteSupplier(
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

    response.json(successResponse("Supplier deleted successfully", {}));
  };

  public updateStatus = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.updateStatus(
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

    response.json(successResponse("Supplier status updated successfully", data));
  };

  public updateBlacklist = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.updateBlacklist(
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

    response.json(successResponse("Supplier blacklist updated successfully", data));
  };

  public updatePreferred = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.updatePreferred(
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

    response.json(successResponse("Supplier preferred status updated successfully", data));
  };

  public getLedger = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.getLedger(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.query as never,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Supplier ledger fetched successfully", data));
  };

  public getPurchases = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.getPurchases(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      request.query as never,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Supplier purchases fetched successfully", data));
  };

  public getPayments = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.getPayments(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id),
      request.query as never
    );

    response.json(successResponse("Supplier payments fetched successfully", data));
  };

  public getOutstanding = async (request: Request, response: Response): Promise<void> => {
    const data = await suppliersService.getOutstanding(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Supplier outstanding fetched successfully", data));
  };

  public exportSuppliers = async (request: Request, response: Response): Promise<void> => {
    const file = await suppliersService.exportSuppliers(
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

  public exportLedger = async (request: Request, response: Response): Promise<void> => {
    const file = await suppliersService.exportLedger(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
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

export const suppliersController = new SuppliersController();
