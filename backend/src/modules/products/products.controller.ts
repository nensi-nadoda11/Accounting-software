import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { productsService } from "./products.service";

export class ProductsController {
  public listProducts = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.listProducts(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Products fetched successfully", data));
  };

  public createProduct = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.createProduct(
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

    response.status(201).json(successResponse("Product created successfully", data));
  };

  public getProduct = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.getProduct(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Product fetched successfully", data));
  };

  public updateProduct = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.updateProduct(
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

    response.json(successResponse("Product updated successfully", data));
  };

  public deleteProduct = async (request: Request, response: Response): Promise<void> => {
    await productsService.deleteProduct(
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

    response.json(successResponse("Product deleted successfully", {}));
  };

  public lookupProducts = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.lookupProducts(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Product lookup fetched successfully", data));
  };

  public exportProducts = async (request: Request, response: Response): Promise<void> => {
    const file = await productsService.exportProducts(
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

  public getPriceHistory = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.getPriceHistory(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id),
      request.query as never
    );

    response.json(successResponse("Product price history fetched successfully", data));
  };

  public getStockSummary = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.getStockSummary(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Product stock summary fetched successfully", data));
  };

  public generateBarcode = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.generateBarcode(
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

    response.json(successResponse("Product barcode processed successfully", data));
  };

  public listCategories = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.listCategories(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Categories fetched successfully", data));
  };

  public createCategory = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.createCategory(
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

    response.status(201).json(successResponse("Category created successfully", data));
  };

  public updateCategory = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.updateCategory(
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

    response.json(successResponse("Category updated successfully", data));
  };

  public deleteCategory = async (request: Request, response: Response): Promise<void> => {
    await productsService.deleteCategory(
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

    response.json(successResponse("Category deleted successfully", {}));
  };

  public listUnits = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.listUnits(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Units fetched successfully", data));
  };

  public createUnit = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.createUnit(
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

    response.status(201).json(successResponse("Unit created successfully", data));
  };

  public updateUnit = async (request: Request, response: Response): Promise<void> => {
    const data = await productsService.updateUnit(
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

    response.json(successResponse("Unit updated successfully", data));
  };

  public deleteUnit = async (request: Request, response: Response): Promise<void> => {
    await productsService.deleteUnit(
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

    response.json(successResponse("Unit deleted successfully", {}));
  };
}

export const productsController = new ProductsController();
