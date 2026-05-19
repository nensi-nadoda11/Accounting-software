import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { createRateLimiter } from "../../middlewares/rate-limit.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { notificationsController } from "./notifications.controller";
import {
  createTemplateSchema,
  emptyBodySchema,
  listLogsQuerySchema,
  listNotificationsQuerySchema,
  listTemplatesQuerySchema,
  notificationIdParamSchema,
  sendNotificationSchema,
  updatePreferencesSchema,
  updateTemplateSchema
} from "./notifications.validator";

const router = Router();
const manualSendLimiter = createRateLimiter({
  limit: 10,
  windowMs: 60_000,
  keyPrefix: "notifications:manual-send"
});

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/unread-count",
  requirePermission(["notifications.view"]),
  asyncHandler(notificationsController.getUnreadCount)
);

router.get(
  "/recipients",
  requirePermission(["notifications.view", "notifications.send"]),
  asyncHandler(notificationsController.listRecipients)
);

router.patch(
  "/read-all",
  requirePermission(["notifications.view"]),
  validateRequest({ body: emptyBodySchema }),
  asyncHandler(notificationsController.markAllRead)
);

router.get(
  "/preferences",
  requirePermission(["notifications.view"]),
  asyncHandler(notificationsController.getPreferences)
);

router.patch(
  "/preferences",
  requirePermission(["notifications.view", "notifications.settings.manage"]),
  validateRequest({ body: updatePreferencesSchema }),
  asyncHandler(notificationsController.updatePreferences)
);

router.get(
  "/templates",
  requirePermission(["notifications.view"]),
  validateRequest({ query: listTemplatesQuerySchema }),
  asyncHandler(notificationsController.listTemplates)
);

router.post(
  "/templates",
  requirePermission(["notifications.settings.manage"]),
  validateRequest({ body: createTemplateSchema }),
  asyncHandler(notificationsController.createTemplate)
);

router.patch(
  "/templates/:id",
  requirePermission(["notifications.settings.manage"]),
  validateRequest({ params: notificationIdParamSchema, body: updateTemplateSchema }),
  asyncHandler(notificationsController.updateTemplate)
);

router.get(
  "/logs",
  requirePermission(["notifications.view"]),
  validateRequest({ query: listLogsQuerySchema }),
  asyncHandler(notificationsController.listLogs)
);

router.post(
  "/send",
  manualSendLimiter,
  requirePermission(["notifications.send"]),
  validateRequest({ body: sendNotificationSchema }),
  asyncHandler(notificationsController.sendNotification)
);

router.post(
  "/run-due-reminders",
  requirePermission(["notifications.manage"]),
  validateRequest({ body: emptyBodySchema }),
  asyncHandler(notificationsController.runDueReminders)
);

router.post(
  "/run-low-stock-check",
  requirePermission(["notifications.manage"]),
  validateRequest({ body: emptyBodySchema }),
  asyncHandler(notificationsController.runLowStockCheck)
);

router.post(
  "/run-expiry-check",
  requirePermission(["notifications.manage"]),
  validateRequest({ body: emptyBodySchema }),
  asyncHandler(notificationsController.runExpiryCheck)
);

router.post(
  "/run-invoice-reminders",
  requirePermission(["notifications.manage"]),
  validateRequest({ body: emptyBodySchema }),
  asyncHandler(notificationsController.runInvoiceReminders)
);

router.post(
  "/run-gst-reminders",
  requirePermission(["notifications.manage"]),
  validateRequest({ body: emptyBodySchema }),
  asyncHandler(notificationsController.runGstReminders)
);

router.post(
  "/run-payroll-reminders",
  requirePermission(["notifications.manage"]),
  validateRequest({ body: emptyBodySchema }),
  asyncHandler(notificationsController.runPayrollReminders)
);

router.patch(
  "/:id/read",
  requirePermission(["notifications.view"]),
  validateRequest({ params: notificationIdParamSchema, body: emptyBodySchema }),
  asyncHandler(notificationsController.markRead)
);

router.delete(
  "/:id",
  requirePermission(["notifications.view"]),
  validateRequest({ params: notificationIdParamSchema }),
  asyncHandler(notificationsController.deleteNotification)
);

router.get(
  "/",
  requirePermission(["notifications.view"]),
  validateRequest({ query: listNotificationsQuerySchema }),
  asyncHandler(notificationsController.listNotifications)
);

export default router;
