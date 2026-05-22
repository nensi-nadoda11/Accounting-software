import type { Request, Response } from "express";

import { successResponse } from "../../utils/api-response";
import { getRequestIp, getUserAgent } from "../../utils/request";
import { accountingService } from "./accounting.service";

export class AccountingController {
  public listAccounts = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.listAccounts({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Accounts fetched successfully", data));
  };

  public createAccount = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.createAccount(
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

    response.status(201).json(successResponse("Account created successfully", data));
  };

  public updateAccount = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.updateAccount(
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

    response.json(successResponse("Account updated successfully", data));
  };

  public deleteAccount = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.deleteAccount(
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

    response.json(successResponse("Account deleted successfully", data));
  };

  public seedDefaultAccounts = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.seedDefaultAccounts(
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

    response.json(successResponse("Default accounts processed successfully", data));
  };

  public listOpeningBalances = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.listOpeningBalances(
      { companyId: request.currentUser!.companyId! },
      request.query as never
    );

    response.json(successResponse("Opening balances fetched successfully", data));
  };

  public createOpeningBalances = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.createOpeningBalances(
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

    response.status(201).json(successResponse("Opening balances created successfully", data));
  };

  public updateOpeningBalance = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.updateOpeningBalance(
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

    response.json(successResponse("Opening balance updated successfully", data));
  };

  public lockOpeningBalances = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.lockOpeningBalances(
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

    response.json(successResponse("Opening balances locked successfully", data));
  };

  public listJournals = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.listJournals({ companyId: request.currentUser!.companyId! }, request.query as never);
    response.json(successResponse("Journal entries fetched successfully", data));
  };

  public createJournal = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.createJournal(
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

    response.status(201).json(successResponse("Journal entry created successfully", data));
  };

  public getJournal = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.getJournal({ companyId: request.currentUser!.companyId! }, String(request.params.id));
    response.json(successResponse("Journal entry fetched successfully", data));
  };

  public updateJournal = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.updateJournal(
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

    response.json(successResponse("Journal entry updated successfully", data));
  };

  public postJournal = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.postJournal(
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

    response.json(successResponse("Journal entry posted successfully", data));
  };

  public cancelJournal = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.cancelJournal(
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

    response.json(successResponse("Journal entry cancelled successfully", data));
  };

  public reverseJournal = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.reverseJournal(
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

    response.json(successResponse("Journal entry reversed successfully", data));
  };

  public getLedger = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.getLedger(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.accountId),
      request.query as never,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Ledger fetched successfully", data));
  };

  public getCustomerLedger = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.getPartyLedger(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      "customer",
      String(request.params.customerId),
      request.query as never,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Customer ledger fetched successfully", data));
  };

  public exportCustomerLedger = async (request: Request, response: Response): Promise<void> => {
    const file = await accountingService.exportPartyLedger(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      "customer",
      String(request.params.customerId),
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

  public getSupplierLedger = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.getPartyLedger(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      "supplier",
      String(request.params.supplierId),
      request.query as never,
      {
        ipAddress: getRequestIp(request),
        userAgent: getUserAgent(request)
      }
    );

    response.json(successResponse("Supplier ledger fetched successfully", data));
  };

  public exportSupplierLedger = async (request: Request, response: Response): Promise<void> => {
    const file = await accountingService.exportPartyLedger(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      "supplier",
      String(request.params.supplierId),
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

  public getCashBook = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.getCashBook(
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

    response.json(successResponse("Cash book fetched successfully", data));
  };

  public exportCashBook = async (request: Request, response: Response): Promise<void> => {
    const file = await accountingService.exportCashBook(
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

  public getBankBook = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.getBankBook(
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

    response.json(successResponse("Bank book fetched successfully", data));
  };

  public exportBankBook = async (request: Request, response: Response): Promise<void> => {
    const file = await accountingService.exportBankBook(
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

  public getTrialBalance = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.getTrialBalance(
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

    response.json(successResponse("Trial balance fetched successfully", data));
  };

  public getProfitLoss = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.getProfitLoss(
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

    response.json(successResponse("Profit and loss fetched successfully", data));
  };

  public getBalanceSheet = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.getBalanceSheet(
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

    response.json(successResponse("Balance sheet fetched successfully", data));
  };

  public listEvents = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.listEvents(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.query as never
    );

    response.json(successResponse("Accounting events fetched successfully", data));
  };

  public postEvent = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.postEvent(
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

    response.json(successResponse("Accounting event processed successfully", data));
  };

  public postPendingEvents = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.postPendingEvents(
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

    response.json(successResponse("Pending accounting events processed successfully", data));
  };

  public listPeriodLocks = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.listPeriodLocks(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      request.query as never
    );

    response.json(successResponse("Period locks fetched successfully", data));
  };

  public createPeriodLock = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.createPeriodLock(
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

    response.status(201).json(successResponse("Period lock created successfully", data));
  };

  public deletePeriodLock = async (request: Request, response: Response): Promise<void> => {
    const data = await accountingService.deletePeriodLock(
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

    response.json(successResponse("Period lock removed successfully", data));
  };

  public exportLedger = async (request: Request, response: Response): Promise<void> => {
    const file = await accountingService.exportLedger(
      {
        id: request.currentUser!.id,
        companyId: request.currentUser!.companyId!,
        role: request.currentUser!.role
      },
      String(request.params.accountId),
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

  public exportTrialBalance = async (request: Request, response: Response): Promise<void> => {
    const file = await accountingService.exportTrialBalance(
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

  public exportProfitLoss = async (request: Request, response: Response): Promise<void> => {
    const file = await accountingService.exportProfitLoss(
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

  public exportBalanceSheet = async (request: Request, response: Response): Promise<void> => {
    const file = await accountingService.exportBalanceSheet(
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

export const accountingController = new AccountingController();
