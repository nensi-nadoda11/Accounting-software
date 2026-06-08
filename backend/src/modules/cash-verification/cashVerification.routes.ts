import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { requireRole } from "../../middlewares/require-role.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { cashVerificationController } from "./cashVerification.controller";
import {
  cashVerificationIdParamSchema,
  createCashVerificationSchema,
  currentCashBalanceQuerySchema,
  exportCashVerificationQuerySchema,
  listCashVerificationsQuerySchema,
  updateCashVerificationSchema
} from "./cashVerification.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/",
  requirePermission(["cash_verification.view"]),
  validateRequest({ query: listCashVerificationsQuerySchema }),
  asyncHandler(cashVerificationController.list)
);

router.post(
  "/",
  requirePermission(["cash_verification.create"]),
  validateRequest({ body: createCashVerificationSchema }),
  asyncHandler(cashVerificationController.create)
);

router.get(
  "/current-balance",
  requirePermission(["cash_verification.view", "cash_verification.create"]),
  validateRequest({ query: currentCashBalanceQuerySchema }),
  asyncHandler(cashVerificationController.getCurrentBalance)
);

router.get(
  "/:id/export",
  requirePermission(["cash_verification.export"]),
  validateRequest({ params: cashVerificationIdParamSchema, query: exportCashVerificationQuerySchema }),
  asyncHandler(cashVerificationController.exportById)
);

router.get(
  "/:id",
  requirePermission(["cash_verification.view"]),
  validateRequest({ params: cashVerificationIdParamSchema }),
  asyncHandler(cashVerificationController.getById)
);

router.patch(
  "/:id",
  requirePermission(["cash_verification.create"]),
  validateRequest({ params: cashVerificationIdParamSchema, body: updateCashVerificationSchema }),
  asyncHandler(cashVerificationController.update)
);

router.post(
  "/:id/complete",
  requirePermission(["cash_verification.create"]),
  validateRequest({ params: cashVerificationIdParamSchema }),
  asyncHandler(cashVerificationController.complete)
);

router.post(
  "/:id/approve",
  requirePermission(["cash_verification.verify"]),
  requireRole(["admin", "accountant"]),
  validateRequest({ params: cashVerificationIdParamSchema }),
  asyncHandler(cashVerificationController.approve)
);

export default router;
