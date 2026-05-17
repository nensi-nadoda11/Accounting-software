import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { inventoryService } from "./inventory.service";

export class InventoryController {
  public listWarehouses = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.listWarehouses(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Warehouses fetched successfully", data));
  };

  public createWarehouse = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.createWarehouse(
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

    response.status(201).json(successResponse("Warehouse created successfully", data));
  };

  public updateWarehouse = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.updateWarehouse(
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

    response.json(successResponse("Warehouse updated successfully", data));
  };

  public deleteWarehouse = async (request: Request, response: Response): Promise<void> => {
    await inventoryService.deleteWarehouse(
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

    response.json(successResponse("Warehouse deleted successfully", {}));
  };

  public setDefaultWarehouse = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.setDefaultWarehouse(
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

    response.json(successResponse("Default warehouse updated successfully", data));
  };

  public listStock = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.listStock(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Current stock fetched successfully", data));
  };

  public getProductStock = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.getProductStock(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.productId)
    );

    response.json(successResponse("Product stock fetched successfully", data));
  };

  public getStockSummary = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.getStockSummary(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Stock summary fetched successfully", data));
  };

  public exportStock = async (request: Request, response: Response): Promise<void> => {
    const file = await inventoryService.exportStock(
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

  public listBatches = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.listBatches(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Batches fetched successfully", data));
  };

  public createBatch = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.createBatch(
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

    response.status(201).json(successResponse("Batch created successfully", data));
  };

  public updateBatch = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.updateBatch(
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

    response.json(successResponse("Batch updated successfully", data));
  };

  public addOpeningStock = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.addOpeningStock(
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

    response.status(201).json(successResponse("Opening stock added successfully", data));
  };

  public createAdjustment = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.createAdjustment(
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

    response.status(201).json(successResponse("Stock adjustment completed successfully", data));
  };

  public listAdjustments = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.listAdjustments(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Stock adjustments fetched successfully", data));
  };

  public listMovements = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.listMovements(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Stock movements fetched successfully", data));
  };

  public exportMovements = async (request: Request, response: Response): Promise<void> => {
    const file = await inventoryService.exportMovements(
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

  public listAlerts = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.listAlerts(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Inventory alerts fetched successfully", data));
  };

  public markAlertRead = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.markAlertRead(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id),
      request.body
    );

    response.json(successResponse("Inventory alert updated successfully", data));
  };

  public recalculateAlerts = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.recalculateAlerts(
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

    response.json(successResponse("Inventory alerts recalculated successfully", data));
  };

  public getValuation = async (request: Request, response: Response): Promise<void> => {
    const data = await inventoryService.getValuation(
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

    response.json(successResponse("Inventory valuation fetched successfully", data));
  };

  public exportValuation = async (request: Request, response: Response): Promise<void> => {
    const file = await inventoryService.exportValuation(
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

export const inventoryController = new InventoryController();
