import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { paymentsController } from "./payments.controller";
import {
  cancelPaymentSchema,
  chequeStatusSchema,
  completePaymentSchema,
  createPaymentSchema,
  dueListQuerySchema,
  exportPaymentsQuerySchema,
  listPaymentsQuerySchema,
  listRemindersQuerySchema,
  paymentIdParamSchema,
  partyDueItemsParamSchema,
  reminderIdParamSchema,
  reminderPartyTypeParamSchema,
  replaceAllocationsSchema,
  sendReceiptSchema,
  sendReminderSchema,
  updatePaymentSchema,
  updateReminderStatusSchema
} from "./payments.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/export",
  requirePermission(["payment.export"]),
  validateRequest({ query: exportPaymentsQuerySchema }),
  asyncHandler(paymentsController.exportPayments)
);

router.get(
  "/customer-dues",
  requirePermission(["payment.view"]),
  validateRequest({ query: dueListQuerySchema }),
  asyncHandler(paymentsController.listCustomerDues)
);

router.get(
  "/supplier-dues",
  requirePermission(["payment.view"]),
  validateRequest({ query: dueListQuerySchema }),
  asyncHandler(paymentsController.listSupplierDues)
);

router.get(
  "/party/:type/:id/due-items",
  requirePermission(["payment.view"]),
  validateRequest({ params: partyDueItemsParamSchema }),
  asyncHandler(paymentsController.getPartyDueItems)
);

router.get(
  "/reminders",
  requirePermission(["payment.view"]),
  validateRequest({ query: listRemindersQuerySchema }),
  asyncHandler(paymentsController.listReminders)
);

router.get(
  "/reminder-parties/:type",
  requirePermission(["payment.view", "payment.reminder.manage"]),
  validateRequest({ params: reminderPartyTypeParamSchema }),
  asyncHandler(paymentsController.listReminderParties)
);

router.post(
  "/reminders/send",
  requirePermission(["payment.reminder.manage"]),
  validateRequest({ body: sendReminderSchema }),
  asyncHandler(paymentsController.sendReminder)
);

router.patch(
  "/reminders/:id/status",
  requirePermission(["payment.reminder.manage"]),
  validateRequest({ params: reminderIdParamSchema, body: updateReminderStatusSchema }),
  asyncHandler(paymentsController.updateReminderStatus)
);

router.get(
  "/:id/receipt/pdf",
  requirePermission(["payment.receipt.print"]),
  validateRequest({ params: paymentIdParamSchema }),
  asyncHandler(paymentsController.getReceiptPdf)
);

router.get(
  "/:id/receipt",
  requirePermission(["payment.view", "payment.receipt.print"]),
  validateRequest({ params: paymentIdParamSchema }),
  asyncHandler(paymentsController.getReceipt)
);

router.post(
  "/:id/send-receipt",
  requirePermission(["payment.receipt.print"]),
  validateRequest({ params: paymentIdParamSchema, body: sendReceiptSchema }),
  asyncHandler(paymentsController.sendReceipt)
);

router.get(
  "/:id/allocations",
  requirePermission(["payment.view"]),
  validateRequest({ params: paymentIdParamSchema }),
  asyncHandler(paymentsController.listAllocations)
);

router.post(
  "/:id/allocations",
  requirePermission(["payment.update"]),
  validateRequest({ params: paymentIdParamSchema, body: replaceAllocationsSchema }),
  asyncHandler(paymentsController.upsertAllocations)
);

router.patch(
  "/:id/allocations",
  requirePermission(["payment.update"]),
  validateRequest({ params: paymentIdParamSchema, body: replaceAllocationsSchema }),
  asyncHandler(paymentsController.replaceAllocations)
);

router.post(
  "/:id/complete",
  requirePermission(["payment.update", "payment.receive", "payment.pay"]),
  validateRequest({ params: paymentIdParamSchema, body: completePaymentSchema }),
  asyncHandler(paymentsController.completePayment)
);

router.post(
  "/:id/cancel",
  requirePermission(["payment.cancel"]),
  validateRequest({ params: paymentIdParamSchema, body: cancelPaymentSchema }),
  asyncHandler(paymentsController.cancelPayment)
);

router.patch(
  "/:id/cheque-status",
  requirePermission(["payment.update"]),
  validateRequest({ params: paymentIdParamSchema, body: chequeStatusSchema }),
  asyncHandler(paymentsController.updateChequeStatus)
);

router.get(
  "/:id",
  requirePermission(["payment.view"]),
  validateRequest({ params: paymentIdParamSchema }),
  asyncHandler(paymentsController.getPayment)
);

router.patch(
  "/:id",
  requirePermission(["payment.update"]),
  validateRequest({ params: paymentIdParamSchema, body: updatePaymentSchema }),
  asyncHandler(paymentsController.updatePayment)
);

router.get(
  "/",
  requirePermission(["payment.view"]),
  validateRequest({ query: listPaymentsQuerySchema }),
  asyncHandler(paymentsController.listPayments)
);

router.post(
  "/",
  requirePermission(["payment.receive", "payment.pay"]),
  validateRequest({ body: createPaymentSchema }),
  asyncHandler(paymentsController.createPayment)
);

export default router;
