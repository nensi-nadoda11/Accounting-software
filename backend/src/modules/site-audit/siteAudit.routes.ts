import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { siteAuditController } from "./siteAudit.controller";
import { uploadSiteAuditAttachments } from "./siteAudit.upload";
import {
  completeSiteAuditSchema,
  createSiteAuditSchema,
  exportSiteAuditQuerySchema,
  listSiteAuditsQuerySchema,
  siteAuditAttachmentIdParamSchema,
  siteAuditFindingIdParamSchema,
  siteAuditFindingSchema,
  siteAuditIdParamSchema,
  updateSiteAuditFindingSchema,
  updateSiteAuditSchema
} from "./siteAudit.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/",
  requirePermission(["site_audit.view"]),
  validateRequest({ query: listSiteAuditsQuerySchema }),
  asyncHandler(siteAuditController.list)
);

router.post(
  "/",
  requirePermission(["site_audit.create"]),
  validateRequest({ body: createSiteAuditSchema }),
  asyncHandler(siteAuditController.create)
);

router.get(
  "/:id/export",
  requirePermission(["site_audit.export"]),
  validateRequest({ params: siteAuditIdParamSchema, query: exportSiteAuditQuerySchema }),
  asyncHandler(siteAuditController.exportById)
);

router.get(
  "/:id",
  requirePermission(["site_audit.view"]),
  validateRequest({ params: siteAuditIdParamSchema }),
  asyncHandler(siteAuditController.getById)
);

router.patch(
  "/:id",
  requirePermission(["site_audit.update"]),
  validateRequest({ params: siteAuditIdParamSchema, body: updateSiteAuditSchema }),
  asyncHandler(siteAuditController.update)
);

router.post(
  "/:id/complete",
  requirePermission(["site_audit.update"]),
  validateRequest({ params: siteAuditIdParamSchema, body: completeSiteAuditSchema }),
  asyncHandler(siteAuditController.complete)
);

router.post(
  "/:id/approve",
  requirePermission(["site_audit.approve"]),
  validateRequest({ params: siteAuditIdParamSchema }),
  asyncHandler(siteAuditController.approve)
);

router.post(
  "/:id/cancel",
  requirePermission(["site_audit.update"]),
  validateRequest({ params: siteAuditIdParamSchema }),
  asyncHandler(siteAuditController.cancel)
);

router.post(
  "/:id/findings",
  requirePermission(["site_audit.update"]),
  validateRequest({ params: siteAuditIdParamSchema, body: siteAuditFindingSchema }),
  asyncHandler(siteAuditController.addFinding)
);

router.patch(
  "/:id/findings/:findingId",
  requirePermission(["site_audit.update"]),
  validateRequest({ params: siteAuditFindingIdParamSchema, body: updateSiteAuditFindingSchema }),
  asyncHandler(siteAuditController.updateFinding)
);

router.post(
  "/:id/attachments",
  requirePermission(["site_audit.update"]),
  validateRequest({ params: siteAuditIdParamSchema }),
  uploadSiteAuditAttachments,
  asyncHandler(siteAuditController.uploadAttachments)
);

router.delete(
  "/:id/attachments/:attachmentId",
  requirePermission(["site_audit.update"]),
  validateRequest({ params: siteAuditAttachmentIdParamSchema }),
  asyncHandler(siteAuditController.deleteAttachment)
);

export default router;
