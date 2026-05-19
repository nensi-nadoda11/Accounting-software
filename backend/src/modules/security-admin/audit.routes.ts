import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { securityAdminAuditController } from "./audit.controller";
import {
  listAuditLogsQuerySchema,
  listLoginLogsQuerySchema,
  listRestoreLogsQuerySchema
} from "./audit.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/audit-logs",
  requirePermission(["audit.view"]),
  validateRequest({ query: listAuditLogsQuerySchema }),
  asyncHandler(securityAdminAuditController.listAuditLogs)
);

router.get(
  "/audit-logs/export",
  requirePermission(["audit.export"]),
  validateRequest({ query: listAuditLogsQuerySchema }),
  asyncHandler(securityAdminAuditController.exportAuditLogs)
);

router.get(
  "/login-logs",
  requirePermission(["audit.view"]),
  validateRequest({ query: listLoginLogsQuerySchema }),
  asyncHandler(securityAdminAuditController.listLoginLogs)
);

router.get(
  "/restore-logs",
  requirePermission(["audit.view"]),
  validateRequest({ query: listRestoreLogsQuerySchema }),
  asyncHandler(securityAdminAuditController.listRestoreLogs)
);

export default router;
