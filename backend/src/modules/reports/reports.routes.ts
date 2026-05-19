import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { reportsController } from "./reports.controller";
import {
  exportReportQuerySchema,
  reportExportsQuerySchema,
  reportLedgerQuerySchema,
  reportOverviewQuerySchema,
  reportPaginatedQuerySchema,
  reportSummaryQuerySchema,
  reportTopQuerySchema
} from "./reports.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/overview",
  requirePermission(["reports.view", "report.view"]),
  validateRequest({ query: reportOverviewQuerySchema }),
  asyncHandler(reportsController.getOverview)
);

router.get(
  "/exports",
  requirePermission(["reports.export", "report.export"]),
  validateRequest({ query: reportExportsQuerySchema }),
  asyncHandler(reportsController.listExports)
);

router.get(
  "/sales/summary",
  requirePermission(["reports.sales.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getSalesSummary)
);
router.get(
  "/sales/detailed",
  requirePermission(["reports.sales.view"]),
  validateRequest({ query: reportPaginatedQuerySchema }),
  asyncHandler(reportsController.getSalesDetailed)
);
router.get(
  "/sales/top-customers",
  requirePermission(["reports.sales.view"]),
  validateRequest({ query: reportTopQuerySchema }),
  asyncHandler(reportsController.getSalesTopCustomers)
);
router.get(
  "/sales/top-products",
  requirePermission(["reports.sales.view"]),
  validateRequest({ query: reportTopQuerySchema }),
  asyncHandler(reportsController.getSalesTopProducts)
);

router.get(
  "/purchases/summary",
  requirePermission(["reports.purchase.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getPurchasesSummary)
);
router.get(
  "/purchases/detailed",
  requirePermission(["reports.purchase.view"]),
  validateRequest({ query: reportPaginatedQuerySchema }),
  asyncHandler(reportsController.getPurchasesDetailed)
);

router.get(
  "/customers/ledger",
  requirePermission(["reports.customer.view"]),
  validateRequest({ query: reportLedgerQuerySchema }),
  asyncHandler(reportsController.getCustomersLedger)
);
router.get(
  "/customers/outstanding",
  requirePermission(["reports.customer.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getCustomersOutstanding)
);
router.get(
  "/customers/aging",
  requirePermission(["reports.customer.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getCustomersAging)
);

router.get(
  "/suppliers/ledger",
  requirePermission(["reports.supplier.view"]),
  validateRequest({ query: reportLedgerQuerySchema }),
  asyncHandler(reportsController.getSuppliersLedger)
);
router.get(
  "/suppliers/outstanding",
  requirePermission(["reports.supplier.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getSuppliersOutstanding)
);
router.get(
  "/suppliers/aging",
  requirePermission(["reports.supplier.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getSuppliersAging)
);

router.get(
  "/inventory/current-stock",
  requirePermission(["reports.inventory.view"]),
  validateRequest({ query: reportPaginatedQuerySchema }),
  asyncHandler(reportsController.getInventoryCurrentStock)
);
router.get(
  "/inventory/valuation",
  requirePermission(["reports.inventory.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getInventoryValuation)
);
router.get(
  "/inventory/expiry",
  requirePermission(["reports.inventory.view"]),
  validateRequest({ query: reportPaginatedQuerySchema }),
  asyncHandler(reportsController.getInventoryExpiry)
);
router.get(
  "/inventory/movement",
  requirePermission(["reports.inventory.view"]),
  validateRequest({ query: reportPaginatedQuerySchema }),
  asyncHandler(reportsController.getInventoryMovement)
);
router.get(
  "/inventory/low-stock",
  requirePermission(["reports.inventory.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getInventoryLowStock)
);

router.get(
  "/expenses/category-wise",
  requirePermission(["reports.expense.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getExpenseCategoryWise)
);
router.get(
  "/expenses/monthly",
  requirePermission(["reports.expense.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getExpenseMonthly)
);
router.get(
  "/expenses/payment-mode",
  requirePermission(["reports.expense.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getExpensePaymentMode)
);

router.get(
  "/income/summary",
  requirePermission(["reports.income.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getIncomeSummary)
);
router.get(
  "/income/monthly",
  requirePermission(["reports.income.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getIncomeMonthly)
);

router.get(
  "/payroll/monthly",
  requirePermission(["reports.payroll.view"]),
  validateRequest({ query: reportPaginatedQuerySchema }),
  asyncHandler(reportsController.getPayrollMonthly)
);
router.get(
  "/payroll/employee",
  requirePermission(["reports.payroll.view"]),
  validateRequest({ query: reportPaginatedQuerySchema }),
  asyncHandler(reportsController.getPayrollEmployee)
);
router.get(
  "/payroll/department",
  requirePermission(["reports.payroll.view"]),
  validateRequest({ query: reportPaginatedQuerySchema }),
  asyncHandler(reportsController.getPayrollDepartment)
);

router.get(
  "/gst/summary",
  requirePermission(["reports.gst.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getGstSummary)
);
router.get(
  "/gst/hsn",
  requirePermission(["reports.gst.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getGstHsn)
);

router.get(
  "/accounting/trial-balance",
  requirePermission(["reports.accounting.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getTrialBalance)
);
router.get(
  "/accounting/profit-loss",
  requirePermission(["reports.accounting.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getProfitLoss)
);
router.get(
  "/accounting/balance-sheet",
  requirePermission(["reports.accounting.view"]),
  validateRequest({ query: reportSummaryQuerySchema }),
  asyncHandler(reportsController.getBalanceSheet)
);
router.get(
  "/accounting/cash-book",
  requirePermission(["reports.accounting.view"]),
  validateRequest({ query: reportPaginatedQuerySchema }),
  asyncHandler(reportsController.getCashBook)
);
router.get(
  "/accounting/bank-book",
  requirePermission(["reports.accounting.view"]),
  validateRequest({ query: reportPaginatedQuerySchema }),
  asyncHandler(reportsController.getBankBook)
);

router.get(
  "/export",
  requirePermission(["reports.export", "report.export"]),
  validateRequest({ query: exportReportQuerySchema }),
  asyncHandler(reportsController.exportReport)
);

export default router;
