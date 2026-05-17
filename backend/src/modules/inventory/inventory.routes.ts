import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { inventoryController } from "./inventory.controller";
import {
  createAdjustmentSchema,
  createBatchSchema,
  createWarehouseSchema,
  exportMovementsQuerySchema,
  exportStockQuerySchema,
  exportValuationQuerySchema,
  inventoryIdParamSchema,
  listAdjustmentsQuerySchema,
  listAlertsQuerySchema,
  listBatchesQuerySchema,
  listMovementsQuerySchema,
  listStockQuerySchema,
  listWarehousesQuerySchema,
  markAlertReadSchema,
  openingStockSchema,
  productIdParamSchema,
  recalculateAlertsSchema,
  stockSummaryQuerySchema,
  updateBatchSchema,
  updateWarehouseSchema,
  valuationQuerySchema
} from "./inventory.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/warehouses",
  requirePermission(["inventory.view", "warehouse.manage"]),
  validateRequest({ query: listWarehousesQuerySchema }),
  asyncHandler(inventoryController.listWarehouses)
);

router.post(
  "/warehouses",
  requirePermission(["warehouse.manage"]),
  validateRequest({ body: createWarehouseSchema }),
  asyncHandler(inventoryController.createWarehouse)
);

router.patch(
  "/warehouses/:id",
  requirePermission(["warehouse.manage"]),
  validateRequest({ params: inventoryIdParamSchema, body: updateWarehouseSchema }),
  asyncHandler(inventoryController.updateWarehouse)
);

router.delete(
  "/warehouses/:id",
  requirePermission(["warehouse.manage"]),
  validateRequest({ params: inventoryIdParamSchema }),
  asyncHandler(inventoryController.deleteWarehouse)
);

router.post(
  "/warehouses/:id/default",
  requirePermission(["warehouse.manage"]),
  validateRequest({ params: inventoryIdParamSchema }),
  asyncHandler(inventoryController.setDefaultWarehouse)
);

router.get(
  "/stock/export",
  requirePermission(["inventory.export"]),
  validateRequest({ query: exportStockQuerySchema }),
  asyncHandler(inventoryController.exportStock)
);

router.get(
  "/stock/summary",
  requirePermission(["inventory.view"]),
  validateRequest({ query: stockSummaryQuerySchema }),
  asyncHandler(inventoryController.getStockSummary)
);

router.get(
  "/stock/:productId",
  requirePermission(["inventory.view"]),
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(inventoryController.getProductStock)
);

router.get(
  "/stock",
  requirePermission(["inventory.view"]),
  validateRequest({ query: listStockQuerySchema }),
  asyncHandler(inventoryController.listStock)
);

router.get(
  "/batches",
  requirePermission(["batch.view"]),
  validateRequest({ query: listBatchesQuerySchema }),
  asyncHandler(inventoryController.listBatches)
);

router.post(
  "/batches",
  requirePermission(["batch.manage"]),
  validateRequest({ body: createBatchSchema }),
  asyncHandler(inventoryController.createBatch)
);

router.patch(
  "/batches/:id",
  requirePermission(["batch.manage"]),
  validateRequest({ params: inventoryIdParamSchema, body: updateBatchSchema }),
  asyncHandler(inventoryController.updateBatch)
);

router.post(
  "/opening-stock",
  requirePermission(["inventory.manage"]),
  validateRequest({ body: openingStockSchema }),
  asyncHandler(inventoryController.addOpeningStock)
);

router.post(
  "/adjustments",
  requirePermission(["inventory.adjust"]),
  validateRequest({ body: createAdjustmentSchema }),
  asyncHandler(inventoryController.createAdjustment)
);

router.get(
  "/adjustments",
  requirePermission(["inventory.view"]),
  validateRequest({ query: listAdjustmentsQuerySchema }),
  asyncHandler(inventoryController.listAdjustments)
);

router.get(
  "/movements/export",
  requirePermission(["inventory.export"]),
  validateRequest({ query: exportMovementsQuerySchema }),
  asyncHandler(inventoryController.exportMovements)
);

router.get(
  "/movements",
  requirePermission(["inventory.view"]),
  validateRequest({ query: listMovementsQuerySchema }),
  asyncHandler(inventoryController.listMovements)
);

router.get(
  "/alerts",
  requirePermission(["inventory.view"]),
  validateRequest({ query: listAlertsQuerySchema }),
  asyncHandler(inventoryController.listAlerts)
);

router.patch(
  "/alerts/:id/read",
  requirePermission(["inventory.view", "inventory.manage"]),
  validateRequest({ params: inventoryIdParamSchema, body: markAlertReadSchema }),
  asyncHandler(inventoryController.markAlertRead)
);

router.post(
  "/alerts/recalculate",
  requirePermission(["inventory.manage"]),
  validateRequest({ body: recalculateAlertsSchema }),
  asyncHandler(inventoryController.recalculateAlerts)
);

router.get(
  "/valuation/export",
  requirePermission(["inventory.export"]),
  validateRequest({ query: exportValuationQuerySchema }),
  asyncHandler(inventoryController.exportValuation)
);

router.get(
  "/valuation",
  requirePermission(["inventory.valuation.view"]),
  validateRequest({ query: valuationQuerySchema }),
  asyncHandler(inventoryController.getValuation)
);

export default router;
