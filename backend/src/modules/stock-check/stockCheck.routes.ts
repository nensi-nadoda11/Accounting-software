import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { requireRole } from "../../middlewares/require-role.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { stockCheckController } from "./stockCheck.controller";
import {
  createStockCheckSchema,
  exportStockCheckQuerySchema,
  listStockChecksQuerySchema,
  stockCheckIdParamSchema,
  updateStockCheckSchema
} from "./stockCheck.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/",
  requirePermission(["stock_check.view"]),
  validateRequest({ query: listStockChecksQuerySchema }),
  asyncHandler(stockCheckController.list)
);

router.post(
  "/",
  requirePermission(["stock_check.create"]),
  validateRequest({ body: createStockCheckSchema }),
  asyncHandler(stockCheckController.create)
);

router.get(
  "/:id/export",
  requirePermission(["stock_check.export"]),
  validateRequest({ params: stockCheckIdParamSchema, query: exportStockCheckQuerySchema }),
  asyncHandler(stockCheckController.exportById)
);

router.get(
  "/:id",
  requirePermission(["stock_check.view"]),
  validateRequest({ params: stockCheckIdParamSchema }),
  asyncHandler(stockCheckController.getById)
);

router.patch(
  "/:id",
  requirePermission(["stock_check.create"]),
  validateRequest({ params: stockCheckIdParamSchema, body: updateStockCheckSchema }),
  asyncHandler(stockCheckController.update)
);

router.post(
  "/:id/complete",
  requirePermission(["stock_check.create"]),
  validateRequest({ params: stockCheckIdParamSchema }),
  asyncHandler(stockCheckController.complete)
);

router.post(
  "/:id/approve",
  requirePermission(["stock_check.approve"]),
  requireRole(["admin"]),
  validateRequest({ params: stockCheckIdParamSchema }),
  asyncHandler(stockCheckController.approve)
);

export default router;
