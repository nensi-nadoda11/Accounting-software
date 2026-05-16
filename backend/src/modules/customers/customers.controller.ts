import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { customersService } from "./customers.service";

export class CustomersController {
  public listCustomers = async (request: Request, response: Response): Promise<void> => {
    const data = await customersService.listCustomers(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Customers fetched successfully", data));
  };

  public createCustomer = async (request: Request, response: Response): Promise<void> => {
    const data = await customersService.createCustomer(
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

    response.status(201).json(successResponse("Customer created successfully", data));
  };

  public getCustomer = async (request: Request, response: Response): Promise<void> => {
    const data = await customersService.getCustomer(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Customer fetched successfully", data));
  };

  public updateCustomer = async (request: Request, response: Response): Promise<void> => {
    const data = await customersService.updateCustomer(
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

    response.json(successResponse("Customer updated successfully", data));
  };

  public deleteCustomer = async (request: Request, response: Response): Promise<void> => {
    await customersService.deleteCustomer(
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

    response.json(successResponse("Customer deleted successfully", {}));
  };

  public updateStatus = async (request: Request, response: Response): Promise<void> => {
    const data = await customersService.updateStatus(
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

    response.json(successResponse("Customer status updated successfully", data));
  };

  public updateBlacklist = async (request: Request, response: Response): Promise<void> => {
    const data = await customersService.updateBlacklist(
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

    response.json(successResponse("Customer blacklist updated successfully", data));
  };

  public getLedger = async (request: Request, response: Response): Promise<void> => {
    const data = await customersService.getLedger(
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

    response.json(successResponse("Customer ledger fetched successfully", data));
  };

  public getPayments = async (request: Request, response: Response): Promise<void> => {
    const data = await customersService.getPayments(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id),
      request.query as never
    );

    response.json(successResponse("Customer payments fetched successfully", data));
  };

  public getOutstanding = async (request: Request, response: Response): Promise<void> => {
    const data = await customersService.getOutstanding(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Customer outstanding fetched successfully", data));
  };

  public exportCustomers = async (request: Request, response: Response): Promise<void> => {
    const file = await customersService.exportCustomers(
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
    const file = await customersService.exportLedger(
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

export const customersController = new CustomersController();
