import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { settingsController } from "./settings.controller";
import {
  changePasswordSettingsSchema,
  createInvoiceTemplateSchema,
  createPaymentModeSchema,
  recordIdParamSchema,
  roleParamSchema,
  updateInvoiceTemplateSchema,
  updatePaymentModeSchema,
  updatePermissionsSchema,
  updateProfileSettingsSchema,
  updateTaxSettingsSchema,
  updateUiPreferencesSchema,
  userIdParamSchema
} from "./settings.validator";
import { SETTINGS_ROUTE_PERMISSIONS } from "./settings.types";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get("/overview", requirePermission([...SETTINGS_ROUTE_PERMISSIONS]), asyncHandler(settingsController.getOverview));

router.get("/permissions", requirePermission(["settings.view"]), asyncHandler(settingsController.getPermissions));
router.patch(
  "/permissions/user/:userId",
  requirePermission(["permissions.manage"]),
  validateRequest({ params: userIdParamSchema, body: updatePermissionsSchema }),
  asyncHandler(settingsController.updateUserPermissions)
);
router.patch(
  "/permissions/role/:role",
  requirePermission(["permissions.manage"]),
  validateRequest({ params: roleParamSchema, body: updatePermissionsSchema }),
  asyncHandler(settingsController.updateRolePermissions)
);

router.get("/invoice-templates", requirePermission(["invoice.settings.manage"]), asyncHandler(settingsController.listInvoiceTemplates));
router.post(
  "/invoice-templates",
  requirePermission(["invoice.settings.manage"]),
  validateRequest({ body: createInvoiceTemplateSchema }),
  asyncHandler(settingsController.createInvoiceTemplate)
);
router.patch(
  "/invoice-templates/:id",
  requirePermission(["invoice.settings.manage"]),
  validateRequest({ params: recordIdParamSchema, body: updateInvoiceTemplateSchema }),
  asyncHandler(settingsController.updateInvoiceTemplate)
);
router.post(
  "/invoice-templates/:id/default",
  requirePermission(["invoice.settings.manage"]),
  validateRequest({ params: recordIdParamSchema }),
  asyncHandler(settingsController.setDefaultInvoiceTemplate)
);
router.delete(
  "/invoice-templates/:id",
  requirePermission(["invoice.settings.manage"]),
  validateRequest({ params: recordIdParamSchema }),
  asyncHandler(settingsController.deleteInvoiceTemplate)
);

router.get("/tax", requirePermission(["tax.settings.manage"]), asyncHandler(settingsController.getTaxSettings));
router.patch(
  "/tax",
  requirePermission(["tax.settings.manage"]),
  validateRequest({ body: updateTaxSettingsSchema }),
  asyncHandler(settingsController.updateTaxSettings)
);

router.get("/payment-modes", requirePermission(["payment.settings.manage"]), asyncHandler(settingsController.listPaymentModes));
router.post(
  "/payment-modes",
  requirePermission(["payment.settings.manage"]),
  validateRequest({ body: createPaymentModeSchema }),
  asyncHandler(settingsController.createPaymentMode)
);
router.patch(
  "/payment-modes/:id",
  requirePermission(["payment.settings.manage"]),
  validateRequest({ params: recordIdParamSchema, body: updatePaymentModeSchema }),
  asyncHandler(settingsController.updatePaymentMode)
);
router.post(
  "/payment-modes/:id/default",
  requirePermission(["payment.settings.manage"]),
  validateRequest({ params: recordIdParamSchema }),
  asyncHandler(settingsController.setDefaultPaymentMode)
);
router.delete(
  "/payment-modes/:id",
  requirePermission(["payment.settings.manage"]),
  validateRequest({ params: recordIdParamSchema }),
  asyncHandler(settingsController.deletePaymentMode)
);

router.get(
  "/ui-preferences",
  requirePermission(["profile.manage", "settings.manage"]),
  asyncHandler(settingsController.getUiPreferences)
);
router.patch(
  "/ui-preferences",
  requirePermission(["profile.manage", "settings.manage"]),
  validateRequest({ body: updateUiPreferencesSchema }),
  asyncHandler(settingsController.updateUiPreferences)
);

router.get("/profile-settings", requirePermission(["profile.manage"]), asyncHandler(settingsController.getProfileSettings));
router.patch(
  "/profile-settings",
  requirePermission(["profile.manage"]),
  validateRequest({ body: updateProfileSettingsSchema }),
  asyncHandler(settingsController.updateProfileSettings)
);
router.post(
  "/profile-settings/change-password",
  requirePermission(["profile.manage"]),
  validateRequest({ body: changePasswordSettingsSchema }),
  asyncHandler(settingsController.changePassword)
);
router.post(
  "/profile-settings/logout-all",
  requirePermission(["profile.manage"]),
  asyncHandler(settingsController.logoutAll)
);

export default router;
