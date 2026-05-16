import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { customersController } from "./customers.controller";
import {
  blacklistSchema,
  createCustomerSchema,
  customerIdParamSchema,
  exportCustomersQuerySchema,
  ledgerExportQuerySchema,
  ledgerQuerySchema,
  listCustomerQuerySchema,
  paymentsQuerySchema,
  statusSchema,
  updateCustomerSchema
} from "./customers.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/export",
  requirePermission(["customer.export"]),
  validateRequest({ query: exportCustomersQuerySchema }),
  asyncHandler(customersController.exportCustomers)
);

router.get(
  "/:id/ledger/export",
  requirePermission(["customer.export"]),
  validateRequest({ params: customerIdParamSchema, query: ledgerExportQuerySchema }),
  asyncHandler(customersController.exportLedger)
);

router.get(
  "/:id/ledger",
  requirePermission(["customer.ledger.view"]),
  validateRequest({ params: customerIdParamSchema, query: ledgerQuerySchema }),
  asyncHandler(customersController.getLedger)
);

router.get(
  "/:id/payments",
  requirePermission(["customer.view", "customer.ledger.view"]),
  validateRequest({ params: customerIdParamSchema, query: paymentsQuerySchema }),
  asyncHandler(customersController.getPayments)
);

router.get(
  "/:id/outstanding",
  requirePermission(["customer.view"]),
  validateRequest({ params: customerIdParamSchema }),
  asyncHandler(customersController.getOutstanding)
);

router.patch(
  "/:id/status",
  requirePermission(["customer.update"]),
  validateRequest({ params: customerIdParamSchema, body: statusSchema }),
  asyncHandler(customersController.updateStatus)
);

router.patch(
  "/:id/blacklist",
  requirePermission(["customer.update"]),
  validateRequest({ params: customerIdParamSchema, body: blacklistSchema }),
  asyncHandler(customersController.updateBlacklist)
);

router.get(
  "/:id",
  requirePermission(["customer.view"]),
  validateRequest({ params: customerIdParamSchema }),
  asyncHandler(customersController.getCustomer)
);

router.patch(
  "/:id",
  requirePermission(["customer.update"]),
  validateRequest({ params: customerIdParamSchema, body: updateCustomerSchema }),
  asyncHandler(customersController.updateCustomer)
);

router.delete(
  "/:id",
  requirePermission(["customer.delete"]),
  validateRequest({ params: customerIdParamSchema }),
  asyncHandler(customersController.deleteCustomer)
);

router.get(
  "/",
  requirePermission(["customer.view"]),
  validateRequest({ query: listCustomerQuerySchema }),
  asyncHandler(customersController.listCustomers)
);

router.post(
  "/",
  requirePermission(["customer.create"]),
  validateRequest({ body: createCustomerSchema }),
  asyncHandler(customersController.createCustomer)
);

export default router;
