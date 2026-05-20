import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { uploadBrandingAsset } from "../../middlewares/upload-branding.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { companyController } from "./company.controller";
import {
  bankAccountsListQuerySchema,
  brandingDeleteParamSchema,
  brandingUploadBodySchema,
  branchesListQuerySchema,
  companyIdParamSchema,
  companyProfileUpdateSchema,
  companyTaxSettingsUpdateSchema,
  createBankAccountSchema,
  createBranchSchema,
  createFinancialYearSchema,
  invoiceSettingsUpdateSchema,
  preferencesUpdateSchema,
  updateBankAccountSchema,
  updateBranchSchema,
  updateFinancialYearSchema
} from "./company.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess, requirePermission(["settings.manage"]));

router.get("/profile", asyncHandler(companyController.getProfile));
router.patch("/profile", validateRequest({ body: companyProfileUpdateSchema }), asyncHandler(companyController.updateProfile));

router.get("/tax-settings", asyncHandler(companyController.getTaxSettings));
router.patch("/tax-settings", validateRequest({ body: companyTaxSettingsUpdateSchema }), asyncHandler(companyController.updateTaxSettings));

router.get("/financial-years", asyncHandler(companyController.listFinancialYears));
router.post("/financial-years", validateRequest({ body: createFinancialYearSchema }), asyncHandler(companyController.createFinancialYear));
router.patch("/financial-years/:id", validateRequest({ params: companyIdParamSchema, body: updateFinancialYearSchema }), asyncHandler(companyController.updateFinancialYear));
router.post("/financial-years/:id/activate", validateRequest({ params: companyIdParamSchema }), asyncHandler(companyController.activateFinancialYear));
router.post("/financial-years/:id/lock", validateRequest({ params: companyIdParamSchema }), asyncHandler(companyController.lockFinancialYear));

router.get("/bank-accounts", validateRequest({ query: bankAccountsListQuerySchema }), asyncHandler(companyController.listBankAccounts));
router.post("/bank-accounts", validateRequest({ body: createBankAccountSchema }), asyncHandler(companyController.createBankAccount));
router.patch("/bank-accounts/:id", validateRequest({ params: companyIdParamSchema, body: updateBankAccountSchema }), asyncHandler(companyController.updateBankAccount));
router.delete("/bank-accounts/:id", validateRequest({ params: companyIdParamSchema }), asyncHandler(companyController.deleteBankAccount));
router.post("/bank-accounts/:id/default", validateRequest({ params: companyIdParamSchema }), asyncHandler(companyController.setDefaultBankAccount));

router.get("/invoice-settings", asyncHandler(companyController.getInvoiceSettings));
router.patch("/invoice-settings", validateRequest({ body: invoiceSettingsUpdateSchema }), asyncHandler(companyController.updateInvoiceSettings));
router.get("/invoice-settings/preview-number", asyncHandler(companyController.previewInvoiceNumber));

router.get("/branding", asyncHandler(companyController.getBranding));
router.get("/branding/:type/file", validateRequest({ params: brandingDeleteParamSchema }), asyncHandler(companyController.downloadBranding));
router.post("/branding/upload", uploadBrandingAsset, validateRequest({ body: brandingUploadBodySchema }), asyncHandler(companyController.uploadBranding));
router.delete("/branding/:type", validateRequest({ params: brandingDeleteParamSchema }), asyncHandler(companyController.deleteBranding));

router.get("/branches", validateRequest({ query: branchesListQuerySchema }), asyncHandler(companyController.listBranches));
router.post("/branches", validateRequest({ body: createBranchSchema }), asyncHandler(companyController.createBranch));
router.patch("/branches/:id", validateRequest({ params: companyIdParamSchema, body: updateBranchSchema }), asyncHandler(companyController.updateBranch));
router.delete("/branches/:id", validateRequest({ params: companyIdParamSchema }), asyncHandler(companyController.deleteBranch));

router.get("/preferences", asyncHandler(companyController.getPreferences));
router.patch("/preferences", validateRequest({ body: preferencesUpdateSchema }), asyncHandler(companyController.updatePreferences));

router.get("/setup-status", asyncHandler(companyController.getSetupStatus));
router.post("/complete-setup", asyncHandler(companyController.completeSetup));

export default router;
