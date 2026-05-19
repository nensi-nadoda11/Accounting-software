import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { gstController } from "./gst.controller";
import {
  cancelGstAdjustmentSchema,
  createGstAdjustmentSchema,
  gstAdjustmentIdParamSchema,
  gstAdjustmentsQuerySchema,
  gstGstr1ExportQuerySchema,
  gstGstr3bExportQuerySchema,
  gstHsnSummaryExportQuerySchema,
  gstHsnSummaryQuerySchema,
  gstItcExportQuerySchema,
  gstItcIdParamSchema,
  gstItcQuerySchema,
  gstOutputTaxQuerySchema,
  gstPurchasesExportQuerySchema,
  gstPurchasesQuerySchema,
  gstSalesExportQuerySchema,
  gstSalesQuerySchema,
  gstSummaryQuerySchema,
  gstTaxSummaryExportQuerySchema,
  gstTaxSummaryQuerySchema,
  updateGstItcStatusSchema
} from "./gst.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/summary",
  requirePermission(["gst.view"]),
  validateRequest({ query: gstSummaryQuerySchema }),
  asyncHandler(gstController.getSummary)
);

router.get(
  "/sales/export",
  requirePermission(["gst.export"]),
  validateRequest({ query: gstSalesExportQuerySchema }),
  asyncHandler(gstController.exportSales)
);

router.get(
  "/sales",
  requirePermission(["gst.view"]),
  validateRequest({ query: gstSalesQuerySchema }),
  asyncHandler(gstController.listSales)
);

router.get(
  "/purchases/export",
  requirePermission(["gst.export"]),
  validateRequest({ query: gstPurchasesExportQuerySchema }),
  asyncHandler(gstController.exportPurchases)
);

router.get(
  "/purchases",
  requirePermission(["gst.view"]),
  validateRequest({ query: gstPurchasesQuerySchema }),
  asyncHandler(gstController.listPurchases)
);

router.get(
  "/itc/export",
  requirePermission(["gst.export"]),
  validateRequest({ query: gstItcExportQuerySchema }),
  asyncHandler(gstController.exportItc)
);

router.get(
  "/itc",
  requirePermission(["gst.view"]),
  validateRequest({ query: gstItcQuerySchema }),
  asyncHandler(gstController.listItc)
);

router.patch(
  "/itc/:id/status",
  requirePermission(["gst.itc.manage"]),
  validateRequest({ params: gstItcIdParamSchema, body: updateGstItcStatusSchema }),
  asyncHandler(gstController.updateItcStatus)
);

router.get(
  "/output-tax",
  requirePermission(["gst.view"]),
  validateRequest({ query: gstOutputTaxQuerySchema }),
  asyncHandler(gstController.getOutputTax)
);

router.get(
  "/hsn-summary/export",
  requirePermission(["gst.export"]),
  validateRequest({ query: gstHsnSummaryExportQuerySchema }),
  asyncHandler(gstController.exportHsnSummary)
);

router.get(
  "/hsn-summary",
  requirePermission(["gst.view"]),
  validateRequest({ query: gstHsnSummaryQuerySchema }),
  asyncHandler(gstController.getHsnSummary)
);

router.get(
  "/tax-summary/export",
  requirePermission(["gst.export"]),
  validateRequest({ query: gstTaxSummaryExportQuerySchema }),
  asyncHandler(gstController.exportTaxSummary)
);

router.get(
  "/tax-summary",
  requirePermission(["gst.view"]),
  validateRequest({ query: gstTaxSummaryQuerySchema }),
  asyncHandler(gstController.getTaxSummary)
);

router.get(
  "/adjustments",
  requirePermission(["gst.view"]),
  validateRequest({ query: gstAdjustmentsQuerySchema }),
  asyncHandler(gstController.listAdjustments)
);

router.post(
  "/adjustments",
  requirePermission(["gst.adjustment.manage"]),
  validateRequest({ body: createGstAdjustmentSchema }),
  asyncHandler(gstController.createAdjustment)
);

router.post(
  "/adjustments/:id/cancel",
  requirePermission(["gst.adjustment.manage"]),
  validateRequest({ params: gstAdjustmentIdParamSchema, body: cancelGstAdjustmentSchema }),
  asyncHandler(gstController.cancelAdjustment)
);

router.get(
  "/gstr-1/export",
  requirePermission(["gst.export"]),
  validateRequest({ query: gstGstr1ExportQuerySchema }),
  asyncHandler(gstController.exportGstr1)
);

router.get(
  "/gstr-3b/export",
  requirePermission(["gst.export"]),
  validateRequest({ query: gstGstr3bExportQuerySchema }),
  asyncHandler(gstController.exportGstr3b)
);

export default router;
