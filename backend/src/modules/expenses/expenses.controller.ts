import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { expensesService } from "./expenses.service";

export class ExpensesController {
  public listExpenses = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.listExpenses(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Expenses fetched successfully", data));
  };

  public createExpense = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.createExpense(
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
        canPost: request.permissions?.has("expense.post") ?? false
      }
    );

    response.status(201).json(successResponse("Expense created successfully", data));
  };

  public getExpense = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.getExpense(
      {
        companyId: request.currentUser!.companyId!
      },
      String(request.params.id)
    );

    response.json(successResponse("Expense fetched successfully", data));
  };

  public updateExpense = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.updateExpense(
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

    response.json(successResponse("Expense updated successfully", data));
  };

  public postExpense = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.postExpense(
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

    response.json(successResponse("Expense posted successfully", data));
  };

  public cancelExpense = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.cancelExpense(
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

    response.json(successResponse("Expense cancelled successfully", data));
  };

  public deleteExpense = async (request: Request, response: Response): Promise<void> => {
    await expensesService.deleteExpense(
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

    response.json(successResponse("Expense deleted successfully", {}));
  };

  public exportExpenses = async (request: Request, response: Response): Promise<void> => {
    const file = await expensesService.exportExpenses(
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

  public listCategories = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.listCategories(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Expense categories fetched successfully", data));
  };

  public createCategory = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.createCategory(
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

    response.status(201).json(successResponse("Expense category created successfully", data));
  };

  public updateCategory = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.updateCategory(
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

    response.json(successResponse("Expense category updated successfully", data));
  };

  public deleteCategory = async (request: Request, response: Response): Promise<void> => {
    await expensesService.deleteCategory(
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

    response.json(successResponse("Expense category deleted successfully", {}));
  };

  public uploadAttachments = async (request: Request, response: Response): Promise<void> => {
    const files = (request.files as Express.Multer.File[] | undefined) ?? [];
    const data = await expensesService.uploadAttachments(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      files,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.status(201).json(successResponse("Expense receipts uploaded successfully", data));
  };

  public deleteAttachment = async (request: Request, response: Response): Promise<void> => {
    await expensesService.deleteAttachment(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.id),
      String(request.params.attachmentId),
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Expense receipt deleted successfully", {}));
  };

  public listRecurring = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.listRecurring(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Recurring expenses fetched successfully", data));
  };

  public createRecurring = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.createRecurring(
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

    response.status(201).json(successResponse("Recurring expense created successfully", data));
  };

  public updateRecurring = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.updateRecurring(
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

    response.json(successResponse("Recurring expense updated successfully", data));
  };

  public runRecurring = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.runRecurring(
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

    response.json(successResponse("Recurring expense executed successfully", data));
  };

  public runDueRecurring = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.runDueRecurring(
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

    response.json(successResponse("Due recurring expenses executed successfully", data));
  };

  public categoryWiseReport = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.getCategoryWiseReport(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Category-wise expense report fetched successfully", data));
  };

  public monthlyReport = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.getMonthlyReport(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Monthly expense report fetched successfully", data));
  };

  public paymentModeReport = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.getPaymentModeReport(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("Payment mode expense report fetched successfully", data));
  };

  public gstReport = async (request: Request, response: Response): Promise<void> => {
    const data = await expensesService.getGstReport(
      {
        companyId: request.currentUser!.companyId!
      },
      request.query as never
    );

    response.json(successResponse("GST expense report fetched successfully", data));
  };
}

export const expensesController = new ExpensesController();
