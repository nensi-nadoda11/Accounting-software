import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { purchasesController } from "./purchases.controller";
import {
  createPurchaseReturnSchema,
  createPurchaseSchema,
  exportPurchaseReturnsQuerySchema,
  exportPurchasesQuerySchema,
  listPurchasePaymentsQuerySchema,
  listPurchaseReturnsQuerySchema,
  listPurchasesQuerySchema,
  purchaseIdParamSchema,
  purchasePdfParamSchema,
  purchaseReturnIdParamSchema,
  purchaseReturnPdfParamSchema,
  recordPurchaseReturnRefundSchema,
  recordPurchasePaymentSchema,
  updatePurchaseSchema
} from "./purchases.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/export",
  requirePermission(["purchase.export"]),
  validateRequest({ query: exportPurchasesQuerySchema }),
  asyncHandler(purchasesController.exportPurchases)
);

router.get(
  "/returns/export",
  requirePermission(["purchase.export"]),
  validateRequest({ query: exportPurchaseReturnsQuerySchema }),
  asyncHandler(purchasesController.exportReturns)
);

router.get(
  "/returns/:id/pdf",
  requirePermission(["purchase.export"]),
  validateRequest({ params: purchaseReturnPdfParamSchema }),
  asyncHandler(purchasesController.generateReturnPdf)
);

router.get(
  "/returns/:id",
  requirePermission(["purchase.view"]),
  validateRequest({ params: purchaseReturnIdParamSchema }),
  asyncHandler(purchasesController.getReturn)
);

router.get(
  "/returns",
  requirePermission(["purchase.view"]),
  validateRequest({ query: listPurchaseReturnsQuerySchema }),
  asyncHandler(purchasesController.listReturns)
);

router.post(
  "/returns",
  requirePermission(["purchase.return"]),
  validateRequest({ body: createPurchaseReturnSchema }),
  asyncHandler(purchasesController.createReturn)
);

router.post(
  "/returns/:id/refunds",
  requirePermission(["purchase.return"]),
  validateRequest({ params: purchaseReturnIdParamSchema, body: recordPurchaseReturnRefundSchema }),
  asyncHandler(purchasesController.recordReturnRefund)
);

router.get(
  "/:id/pdf",
  requirePermission(["purchase.export"]),
  validateRequest({ params: purchasePdfParamSchema }),
  asyncHandler(purchasesController.generatePurchasePdf)
);

router.get(
  "/:id/payments",
  requirePermission(["purchase.payment.view"]),
  validateRequest({ params: purchaseIdParamSchema, query: listPurchasePaymentsQuerySchema }),
  asyncHandler(purchasesController.listPayments)
);

router.post(
  "/:id/payments",
  requirePermission(["purchase.payment.manage"]),
  validateRequest({ params: purchaseIdParamSchema, body: recordPurchasePaymentSchema }),
  asyncHandler(purchasesController.recordPayment)
);

router.post(
  "/:id/post",
  requirePermission(["purchase.approve"]),
  validateRequest({ params: purchaseIdParamSchema }),
  asyncHandler(purchasesController.postPurchase)
);

router.post(
  "/:id/cancel",
  requirePermission(["purchase.approve"]),
  validateRequest({ params: purchaseIdParamSchema }),
  asyncHandler(purchasesController.cancelPurchase)
);

router.get(
  "/:id",
  requirePermission(["purchase.view"]),
  validateRequest({ params: purchaseIdParamSchema }),
  asyncHandler(purchasesController.getPurchase)
);

router.patch(
  "/:id",
  requirePermission(["purchase.update"]),
  validateRequest({ params: purchaseIdParamSchema, body: updatePurchaseSchema }),
  asyncHandler(purchasesController.updatePurchase)
);

router.delete(
  "/:id",
  requirePermission(["purchase.delete"]),
  validateRequest({ params: purchaseIdParamSchema }),
  asyncHandler(purchasesController.deletePurchase)
);

router.get(
  "/",
  requirePermission(["purchase.view"]),
  validateRequest({ query: listPurchasesQuerySchema }),
  asyncHandler(purchasesController.listPurchases)
);

router.post(
  "/",
  requirePermission(["purchase.create"]),
  validateRequest({ body: createPurchaseSchema }),
  asyncHandler(purchasesController.createPurchase)
);

export default router;
