import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { dashboardController } from "./dashboard.controller";
import {
  dashboardDateRangeQuerySchema,
  dashboardRecentActivitiesQuerySchema,
  dashboardTopProductsQuerySchema
} from "./dashboard.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess, requirePermission(["dashboard.view"]));

router.get("/summary", asyncHandler(dashboardController.getSummary));
router.get("/charts/sales", validateRequest({ query: dashboardDateRangeQuerySchema }), asyncHandler(dashboardController.getSalesChart));
router.get("/charts/purchases", validateRequest({ query: dashboardDateRangeQuerySchema }), asyncHandler(dashboardController.getPurchasesChart));
router.get("/charts/expenses", validateRequest({ query: dashboardDateRangeQuerySchema }), asyncHandler(dashboardController.getExpensesChart));
router.get("/charts/payments", validateRequest({ query: dashboardDateRangeQuerySchema }), asyncHandler(dashboardController.getPaymentsChart));
router.get("/top-products", validateRequest({ query: dashboardTopProductsQuerySchema }), asyncHandler(dashboardController.getTopProducts));
router.get("/recent-activities", validateRequest({ query: dashboardRecentActivitiesQuerySchema }), asyncHandler(dashboardController.getRecentActivities));
router.get("/alerts", asyncHandler(dashboardController.getAlerts));
router.get("/pending-tasks", asyncHandler(dashboardController.getPendingTasks));
router.get("/role-dashboard", asyncHandler(dashboardController.getRoleDashboard));

export default router;
