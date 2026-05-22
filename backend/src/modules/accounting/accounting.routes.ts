import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { accountingController } from "./accounting.controller";
import {
  accountIdParamSchema,
  accountLedgerParamSchema,
  accountingEventIdParamSchema,
  balanceSheetQuerySchema,
  bookQuerySchema,
  cancelOrReverseJournalSchema,
  createAccountSchema,
  createFinancialPeriodLockSchema,
  createJournalSchema,
  createOpeningBalancesSchema,
  customerLedgerParamSchema,
  emptyBodySchema,
  exportBalanceSheetQuerySchema,
  exportBookQuerySchema,
  exportLedgerQuerySchema,
  exportProfitLossQuerySchema,
  exportTrialBalanceQuerySchema,
  financialPeriodLockIdParamSchema,
  journalIdParamSchema,
  ledgerQuerySchema,
  listAccountsQuerySchema,
  listAccountingEventsQuerySchema,
  listFinancialPeriodLocksQuerySchema,
  listJournalsQuerySchema,
  listOpeningBalancesQuerySchema,
  lockOpeningBalancesSchema,
  openingBalanceIdParamSchema,
  postJournalSchema,
  postPendingAccountingEventsSchema,
  profitLossQuerySchema,
  seedDefaultAccountsSchema,
  supplierLedgerParamSchema,
  trialBalanceQuerySchema,
  updateAccountSchema,
  updateJournalSchema,
  updateOpeningBalanceSchema
} from "./accounting.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/accounts",
  requirePermission(["accounting.view", "chart.manage"]),
  validateRequest({ query: listAccountsQuerySchema }),
  asyncHandler(accountingController.listAccounts)
);
router.post(
  "/accounts",
  requirePermission(["chart.manage"]),
  validateRequest({ body: createAccountSchema }),
  asyncHandler(accountingController.createAccount)
);
router.patch(
  "/accounts/:id",
  requirePermission(["chart.manage"]),
  validateRequest({ params: accountIdParamSchema, body: updateAccountSchema }),
  asyncHandler(accountingController.updateAccount)
);
router.delete(
  "/accounts/:id",
  requirePermission(["chart.manage"]),
  validateRequest({ params: accountIdParamSchema }),
  asyncHandler(accountingController.deleteAccount)
);
router.post(
  "/accounts/defaults",
  requirePermission(["chart.manage"]),
  validateRequest({ body: seedDefaultAccountsSchema }),
  asyncHandler(accountingController.seedDefaultAccounts)
);

router.get(
  "/opening-balances",
  requirePermission(["accounting.view", "accounting.manage"]),
  validateRequest({ query: listOpeningBalancesQuerySchema }),
  asyncHandler(accountingController.listOpeningBalances)
);
router.post(
  "/opening-balances",
  requirePermission(["accounting.manage"]),
  validateRequest({ body: createOpeningBalancesSchema }),
  asyncHandler(accountingController.createOpeningBalances)
);
router.patch(
  "/opening-balances/:id",
  requirePermission(["accounting.manage"]),
  validateRequest({ params: openingBalanceIdParamSchema, body: updateOpeningBalanceSchema }),
  asyncHandler(accountingController.updateOpeningBalance)
);
router.post(
  "/opening-balances/lock",
  requirePermission(["accounting.manage"]),
  validateRequest({ body: lockOpeningBalancesSchema }),
  asyncHandler(accountingController.lockOpeningBalances)
);

router.get(
  "/journals",
  requirePermission(["accounting.view"]),
  validateRequest({ query: listJournalsQuerySchema }),
  asyncHandler(accountingController.listJournals)
);
router.post(
  "/journals",
  requirePermission(["accounting.journal.create"]),
  validateRequest({ body: createJournalSchema }),
  asyncHandler(accountingController.createJournal)
);
router.get(
  "/journals/:id",
  requirePermission(["accounting.view"]),
  validateRequest({ params: journalIdParamSchema }),
  asyncHandler(accountingController.getJournal)
);
router.patch(
  "/journals/:id",
  requirePermission(["accounting.journal.create", "accounting.manage"]),
  validateRequest({ params: journalIdParamSchema, body: updateJournalSchema }),
  asyncHandler(accountingController.updateJournal)
);
router.post(
  "/journals/:id/post",
  requirePermission(["accounting.journal.post"]),
  validateRequest({ params: journalIdParamSchema, body: postJournalSchema }),
  asyncHandler(accountingController.postJournal)
);
router.post(
  "/journals/:id/cancel",
  requirePermission(["accounting.journal.cancel"]),
  validateRequest({ params: journalIdParamSchema, body: cancelOrReverseJournalSchema }),
  asyncHandler(accountingController.cancelJournal)
);
router.post(
  "/journals/:id/reverse",
  requirePermission(["accounting.journal.cancel"]),
  validateRequest({ params: journalIdParamSchema, body: cancelOrReverseJournalSchema }),
  asyncHandler(accountingController.reverseJournal)
);

router.get(
  "/ledger/customer/:customerId",
  requirePermission(["ledger.view"]),
  validateRequest({ params: customerLedgerParamSchema, query: ledgerQuerySchema }),
  asyncHandler(accountingController.getCustomerLedger)
);
router.get(
  "/ledger/customer/:customerId/export",
  requirePermission(["accounting.export"]),
  validateRequest({ params: customerLedgerParamSchema, query: exportLedgerQuerySchema }),
  asyncHandler(accountingController.exportCustomerLedger)
);
router.get(
  "/ledger/supplier/:supplierId",
  requirePermission(["ledger.view"]),
  validateRequest({ params: supplierLedgerParamSchema, query: ledgerQuerySchema }),
  asyncHandler(accountingController.getSupplierLedger)
);
router.get(
  "/ledger/supplier/:supplierId/export",
  requirePermission(["accounting.export"]),
  validateRequest({ params: supplierLedgerParamSchema, query: exportLedgerQuerySchema }),
  asyncHandler(accountingController.exportSupplierLedger)
);
router.get(
  "/ledger/:accountId",
  requirePermission(["ledger.view"]),
  validateRequest({ params: accountLedgerParamSchema, query: ledgerQuerySchema }),
  asyncHandler(accountingController.getLedger)
);
router.get(
  "/ledger/:accountId/export",
  requirePermission(["accounting.export"]),
  validateRequest({ params: accountLedgerParamSchema, query: exportLedgerQuerySchema }),
  asyncHandler(accountingController.exportLedger)
);

router.get(
  "/cash-book",
  requirePermission(["cashbook.view"]),
  validateRequest({ query: bookQuerySchema }),
  asyncHandler(accountingController.getCashBook)
);
router.get(
  "/cash-book/export",
  requirePermission(["accounting.export"]),
  validateRequest({ query: exportBookQuerySchema }),
  asyncHandler(accountingController.exportCashBook)
);
router.get(
  "/bank-book",
  requirePermission(["bankbook.view"]),
  validateRequest({ query: bookQuerySchema }),
  asyncHandler(accountingController.getBankBook)
);
router.get(
  "/bank-book/export",
  requirePermission(["accounting.export"]),
  validateRequest({ query: exportBookQuerySchema }),
  asyncHandler(accountingController.exportBankBook)
);

router.get(
  "/trial-balance",
  requirePermission(["accounting.reports.view"]),
  validateRequest({ query: trialBalanceQuerySchema }),
  asyncHandler(accountingController.getTrialBalance)
);
router.get(
  "/trial-balance/export",
  requirePermission(["accounting.export"]),
  validateRequest({ query: exportTrialBalanceQuerySchema }),
  asyncHandler(accountingController.exportTrialBalance)
);
router.get(
  "/profit-loss",
  requirePermission(["accounting.reports.view"]),
  validateRequest({ query: profitLossQuerySchema }),
  asyncHandler(accountingController.getProfitLoss)
);
router.get(
  "/profit-loss/export",
  requirePermission(["accounting.export"]),
  validateRequest({ query: exportProfitLossQuerySchema }),
  asyncHandler(accountingController.exportProfitLoss)
);
router.get(
  "/balance-sheet",
  requirePermission(["accounting.reports.view"]),
  validateRequest({ query: balanceSheetQuerySchema }),
  asyncHandler(accountingController.getBalanceSheet)
);
router.get(
  "/balance-sheet/export",
  requirePermission(["accounting.export"]),
  validateRequest({ query: exportBalanceSheetQuerySchema }),
  asyncHandler(accountingController.exportBalanceSheet)
);

router.get(
  "/events",
  requirePermission(["accounting.manage"]),
  validateRequest({ query: listAccountingEventsQuerySchema }),
  asyncHandler(accountingController.listEvents)
);
router.post(
  "/events/:id/post",
  requirePermission(["accounting.journal.post"]),
  validateRequest({ params: accountingEventIdParamSchema, body: emptyBodySchema }),
  asyncHandler(accountingController.postEvent)
);
router.post(
  "/events/post-pending",
  requirePermission(["accounting.journal.post"]),
  validateRequest({ body: postPendingAccountingEventsSchema }),
  asyncHandler(accountingController.postPendingEvents)
);

router.get(
  "/period-locks",
  requirePermission(["accounting.manage"]),
  validateRequest({ query: listFinancialPeriodLocksQuerySchema }),
  asyncHandler(accountingController.listPeriodLocks)
);
router.post(
  "/period-locks",
  requirePermission(["accounting.manage"]),
  validateRequest({ body: createFinancialPeriodLockSchema }),
  asyncHandler(accountingController.createPeriodLock)
);
router.delete(
  "/period-locks/:id",
  requirePermission(["accounting.manage"]),
  validateRequest({ params: financialPeriodLockIdParamSchema }),
  asyncHandler(accountingController.deletePeriodLock)
);

export default router;
