import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { suppliersController } from "./suppliers.controller";
import {
  blacklistSchema,
  createSupplierSchema,
  exportSuppliersQuerySchema,
  ledgerExportQuerySchema,
  ledgerQuerySchema,
  listSupplierQuerySchema,
  paymentsQuerySchema,
  preferredSchema,
  purchasesQuerySchema,
  statusSchema,
  supplierIdParamSchema,
  updateSupplierSchema
} from "./suppliers.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/export",
  requirePermission(["supplier.export"]),
  validateRequest({ query: exportSuppliersQuerySchema }),
  asyncHandler(suppliersController.exportSuppliers)
);

router.get(
  "/:id/ledger/export",
  requirePermission(["supplier.export"]),
  validateRequest({ params: supplierIdParamSchema, query: ledgerExportQuerySchema }),
  asyncHandler(suppliersController.exportLedger)
);

router.get(
  "/:id/ledger",
  requirePermission(["supplier.ledger.view"]),
  validateRequest({ params: supplierIdParamSchema, query: ledgerQuerySchema }),
  asyncHandler(suppliersController.getLedger)
);

router.get(
  "/:id/purchases",
  requirePermission(["supplier.view"]),
  validateRequest({ params: supplierIdParamSchema, query: purchasesQuerySchema }),
  asyncHandler(suppliersController.getPurchases)
);

router.get(
  "/:id/payments",
  requirePermission(["supplier.view", "supplier.ledger.view"]),
  validateRequest({ params: supplierIdParamSchema, query: paymentsQuerySchema }),
  asyncHandler(suppliersController.getPayments)
);

router.get(
  "/:id/outstanding",
  requirePermission(["supplier.view"]),
  validateRequest({ params: supplierIdParamSchema }),
  asyncHandler(suppliersController.getOutstanding)
);

router.patch(
  "/:id/status",
  requirePermission(["supplier.update"]),
  validateRequest({ params: supplierIdParamSchema, body: statusSchema }),
  asyncHandler(suppliersController.updateStatus)
);

router.patch(
  "/:id/blacklist",
  requirePermission(["supplier.update"]),
  validateRequest({ params: supplierIdParamSchema, body: blacklistSchema }),
  asyncHandler(suppliersController.updateBlacklist)
);

router.patch(
  "/:id/preferred",
  requirePermission(["supplier.update"]),
  validateRequest({ params: supplierIdParamSchema, body: preferredSchema }),
  asyncHandler(suppliersController.updatePreferred)
);

router.get(
  "/:id",
  requirePermission(["supplier.view"]),
  validateRequest({ params: supplierIdParamSchema }),
  asyncHandler(suppliersController.getSupplier)
);

router.patch(
  "/:id",
  requirePermission(["supplier.update"]),
  validateRequest({ params: supplierIdParamSchema, body: updateSupplierSchema }),
  asyncHandler(suppliersController.updateSupplier)
);

router.delete(
  "/:id",
  requirePermission(["supplier.delete"]),
  validateRequest({ params: supplierIdParamSchema }),
  asyncHandler(suppliersController.deleteSupplier)
);

router.get(
  "/",
  requirePermission(["supplier.view"]),
  validateRequest({ query: listSupplierQuerySchema }),
  asyncHandler(suppliersController.listSuppliers)
);

router.post(
  "/",
  requirePermission(["supplier.create"]),
  validateRequest({ body: createSupplierSchema }),
  asyncHandler(suppliersController.createSupplier)
);

export default router;
