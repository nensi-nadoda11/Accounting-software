import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { companyService } from "./company.service";

export class CompanyController {
  public getProfile = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.getProfile(request.currentUser!.companyId!);
    response.json(successResponse("Company profile fetched successfully", data));
  };

  public updateProfile = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.updateProfile(
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

    response.json(successResponse("Company profile updated successfully", data));
  };

  public getTaxSettings = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.getTaxSettings(request.currentUser!.companyId!);
    response.json(successResponse("Tax settings fetched successfully", data));
  };

  public updateTaxSettings = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.updateTaxSettings(
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

    response.json(successResponse("Tax settings updated successfully", data));
  };

  public listFinancialYears = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.listFinancialYears(request.currentUser!.companyId!);
    response.json(successResponse("Financial years fetched successfully", data));
  };

  public createFinancialYear = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.createFinancialYear(
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

    response.status(201).json(successResponse("Financial year created successfully", data));
  };

  public updateFinancialYear = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.updateFinancialYear(
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

    response.json(successResponse("Financial year updated successfully", data));
  };

  public activateFinancialYear = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.activateFinancialYear(
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

    response.json(successResponse("Financial year activated successfully", data));
  };

  public lockFinancialYear = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.lockFinancialYear(
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

    response.json(successResponse("Financial year locked successfully", data));
  };

  public listBankAccounts = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.listBankAccounts(request.currentUser!.companyId!, request.query as never);
    response.json(successResponse("Bank accounts fetched successfully", data));
  };

  public createBankAccount = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.createBankAccount(
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

    response.status(201).json(successResponse("Bank account created successfully", data));
  };

  public updateBankAccount = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.updateBankAccount(
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

    response.json(successResponse("Bank account updated successfully", data));
  };

  public deleteBankAccount = async (request: Request, response: Response): Promise<void> => {
    await companyService.deleteBankAccount(
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

    response.json(successResponse("Bank account deleted successfully", {}));
  };

  public setDefaultBankAccount = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.setDefaultBankAccount(
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

    response.json(successResponse("Default bank account updated successfully", data));
  };

  public getInvoiceSettings = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.getInvoiceSettings(request.currentUser!.companyId!);
    response.json(successResponse("Invoice settings fetched successfully", data));
  };

  public updateInvoiceSettings = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.updateInvoiceSettings(
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

    response.json(successResponse("Invoice settings updated successfully", data));
  };

  public previewInvoiceNumber = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.previewInvoiceNumber(request.currentUser!.companyId!);
    response.json(successResponse("Invoice number preview fetched successfully", data));
  };

  public getBranding = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.getBranding(request.currentUser!.companyId!);
    response.json(successResponse("Branding fetched successfully", data));
  };

  public uploadBranding = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.uploadBrandingAsset(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.body,
      request.file,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.status(201).json(successResponse("Branding updated successfully", data));
  };

  public deleteBranding = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.deleteBrandingAsset(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.params.type as never,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Branding asset deleted successfully", data));
  };

  public downloadBranding = async (request: Request, response: Response): Promise<void> => {
    const file = await companyService.downloadBrandingAsset(request.currentUser!.companyId!, request.params.type as never);
    response.setHeader("Content-Type", file.contentType);
    response.setHeader("Content-Disposition", `inline; filename="${file.fileName}"`);
    response.send(file.content);
  };

  public listBranches = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.listBranches(request.currentUser!.companyId!, request.query as never);
    response.json(successResponse("Branches fetched successfully", data));
  };

  public createBranch = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.createBranch(
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

    response.status(201).json(successResponse("Branch created successfully", data));
  };

  public updateBranch = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.updateBranch(
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

    response.json(successResponse("Branch updated successfully", data));
  };

  public deleteBranch = async (request: Request, response: Response): Promise<void> => {
    await companyService.deleteBranch(
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

    response.json(successResponse("Branch deleted successfully", {}));
  };

  public getPreferences = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.getPreferences(request.currentUser!.companyId!);
    response.json(successResponse("Preferences fetched successfully", data));
  };

  public updatePreferences = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.updatePreferences(
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

    response.json(successResponse("Preferences updated successfully", data));
  };

  public getSetupStatus = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.getSetupStatus(request.currentUser!.companyId!);
    response.json(successResponse("Setup status fetched successfully", data));
  };

  public completeSetup = async (request: Request, response: Response): Promise<void> => {
    const data = await companyService.completeSetup(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Company setup completed successfully", data));
  };
}

export const companyController = new CompanyController();
