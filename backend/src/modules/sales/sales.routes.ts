import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { salesController } from "./sales.controller";
import {
  barcodeLookupQuerySchema,
  createPosInvoiceSchema,
  createSalesInvoiceSchema,
  createSalesReturnSchema,
  exportSalesInvoicesQuerySchema,
  exportSalesReturnsQuerySchema,
  listSalesInvoicesQuerySchema,
  listSalesPaymentsQuerySchema,
  listSalesReturnsQuerySchema,
  recordSalesReturnRefundSchema,
  recordSalesPaymentSchema,
  salesInvoiceIdParamSchema,
  salesReturnIdParamSchema,
  sendInvoiceEmailSchema,
  sendInvoiceWhatsappSchema,
  updateSalesInvoiceSchema
} from "./sales.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/export",
  requirePermission(["sales.export"]),
  validateRequest({ query: exportSalesInvoicesQuerySchema }),
  asyncHandler(salesController.exportInvoices)
);

router.get(
  "/returns/export",
  requirePermission(["sales.export"]),
  validateRequest({ query: exportSalesReturnsQuerySchema }),
  asyncHandler(salesController.exportReturns)
);

router.get(
  "/returns/:id",
  requirePermission(["sales.view"]),
  validateRequest({ params: salesReturnIdParamSchema }),
  asyncHandler(salesController.getReturn)
);

router.get(
  "/returns",
  requirePermission(["sales.view"]),
  validateRequest({ query: listSalesReturnsQuerySchema }),
  asyncHandler(salesController.listReturns)
);

router.post(
  "/returns",
  requirePermission(["sales.return"]),
  validateRequest({ body: createSalesReturnSchema }),
  asyncHandler(salesController.createReturn)
);

router.post(
  "/returns/:id/refunds",
  requirePermission(["sales.return"]),
  validateRequest({ params: salesReturnIdParamSchema, body: recordSalesReturnRefundSchema }),
  asyncHandler(salesController.recordReturnRefund)
);

router.post(
  "/pos",
  requirePermission(["sales.pos.access"]),
  requirePermission(["sales.create"]),
  validateRequest({ body: createPosInvoiceSchema }),
  asyncHandler(salesController.createPosInvoice)
);

router.get(
  "/barcode-lookup",
  requirePermission(["sales.view", "sales.pos.access"]),
  validateRequest({ query: barcodeLookupQuerySchema }),
  asyncHandler(salesController.barcodeLookup)
);

router.get(
  "/:id/pdf",
  requirePermission(["sales.view"]),
  validateRequest({ params: salesInvoiceIdParamSchema }),
  asyncHandler(salesController.generateInvoicePdf)
);

router.post(
  "/:id/send-email",
  requirePermission(["sales.invoice.send"]),
  validateRequest({ params: salesInvoiceIdParamSchema, body: sendInvoiceEmailSchema }),
  asyncHandler(salesController.sendInvoiceEmail)
);

router.post(
  "/:id/send-whatsapp",
  requirePermission(["sales.invoice.send"]),
  validateRequest({ params: salesInvoiceIdParamSchema, body: sendInvoiceWhatsappSchema }),
  asyncHandler(salesController.sendInvoiceWhatsapp)
);

router.get(
  "/:id/payments",
  requirePermission(["sales.payment.view"]),
  validateRequest({ params: salesInvoiceIdParamSchema, query: listSalesPaymentsQuerySchema }),
  asyncHandler(salesController.listPayments)
);

router.post(
  "/:id/payments",
  requirePermission(["sales.payment.manage"]),
  validateRequest({ params: salesInvoiceIdParamSchema, body: recordSalesPaymentSchema }),
  asyncHandler(salesController.recordPayment)
);

router.post(
  "/:id/post",
  requirePermission(["sales.create"]),
  validateRequest({ params: salesInvoiceIdParamSchema }),
  asyncHandler(salesController.postInvoice)
);

router.post(
  "/:id/cancel",
  requirePermission(["sales.delete", "sales.update"]),
  validateRequest({ params: salesInvoiceIdParamSchema }),
  asyncHandler(salesController.cancelInvoice)
);

router.get(
  "/:id",
  requirePermission(["sales.view"]),
  validateRequest({ params: salesInvoiceIdParamSchema }),
  asyncHandler(salesController.getInvoice)
);

router.patch(
  "/:id",
  requirePermission(["sales.update"]),
  validateRequest({ params: salesInvoiceIdParamSchema, body: updateSalesInvoiceSchema }),
  asyncHandler(salesController.updateInvoice)
);

router.delete(
  "/:id",
  requirePermission(["sales.delete"]),
  validateRequest({ params: salesInvoiceIdParamSchema }),
  asyncHandler(salesController.deleteInvoice)
);

router.get(
  "/",
  requirePermission(["sales.view"]),
  validateRequest({ query: listSalesInvoicesQuerySchema }),
  asyncHandler(salesController.listInvoices)
);

router.post(
  "/",
  requirePermission(["sales.create"]),
  validateRequest({ body: createSalesInvoiceSchema }),
  asyncHandler(salesController.createInvoice)
);

export default router;
