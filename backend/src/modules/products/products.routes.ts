import { Router } from "express";

import { requireAuth } from "../../middlewares/require-auth.middleware";
import { requireCompanyAccess } from "../../middlewares/require-company-access.middleware";
import { requirePermission } from "../../middlewares/require-permission.middleware";
import { validateRequest } from "../../middlewares/validate-request.middleware";
import { asyncHandler } from "../../utils/async-handler";
import { productsController } from "./products.controller";
import {
  barcodeRequestSchema,
  createCategorySchema,
  createProductSchema,
  createUnitSchema,
  exportProductsQuerySchema,
  listCategoriesQuerySchema,
  listProductsQuerySchema,
  listUnitsQuerySchema,
  priceHistoryQuerySchema,
  productIdParamSchema,
  productLookupQuerySchema,
  updateCategorySchema,
  updateProductSchema,
  updateUnitSchema
} from "./products.validator";

const router = Router();

router.use(requireAuth, requireCompanyAccess);

router.get(
  "/lookup",
  requirePermission(["product.view"]),
  validateRequest({ query: productLookupQuerySchema }),
  asyncHandler(productsController.lookupProducts)
);

router.get(
  "/export",
  requirePermission(["product.export"]),
  validateRequest({ query: exportProductsQuerySchema }),
  asyncHandler(productsController.exportProducts)
);

router.get(
  "/categories",
  requirePermission(["category.manage"]),
  validateRequest({ query: listCategoriesQuerySchema }),
  asyncHandler(productsController.listCategories)
);

router.post(
  "/categories",
  requirePermission(["category.manage"]),
  validateRequest({ body: createCategorySchema }),
  asyncHandler(productsController.createCategory)
);

router.patch(
  "/categories/:id",
  requirePermission(["category.manage"]),
  validateRequest({ params: productIdParamSchema, body: updateCategorySchema }),
  asyncHandler(productsController.updateCategory)
);

router.delete(
  "/categories/:id",
  requirePermission(["category.manage"]),
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(productsController.deleteCategory)
);

router.get(
  "/units",
  requirePermission(["unit.manage"]),
  validateRequest({ query: listUnitsQuerySchema }),
  asyncHandler(productsController.listUnits)
);

router.post(
  "/units",
  requirePermission(["unit.manage"]),
  validateRequest({ body: createUnitSchema }),
  asyncHandler(productsController.createUnit)
);

router.patch(
  "/units/:id",
  requirePermission(["unit.manage"]),
  validateRequest({ params: productIdParamSchema, body: updateUnitSchema }),
  asyncHandler(productsController.updateUnit)
);

router.delete(
  "/units/:id",
  requirePermission(["unit.manage"]),
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(productsController.deleteUnit)
);

router.get(
  "/:id/price-history",
  requirePermission(["product.price.view"]),
  validateRequest({ params: productIdParamSchema, query: priceHistoryQuerySchema }),
  asyncHandler(productsController.getPriceHistory)
);

router.get(
  "/:id/stock-summary",
  requirePermission(["product.view"]),
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(productsController.getStockSummary)
);

router.post(
  "/:id/generate-barcode",
  requirePermission(["product.update", "product.price.manage"]),
  validateRequest({ params: productIdParamSchema, body: barcodeRequestSchema }),
  asyncHandler(productsController.generateBarcode)
);

router.get(
  "/:id",
  requirePermission(["product.view"]),
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(productsController.getProduct)
);

router.patch(
  "/:id",
  requirePermission(["product.update"]),
  validateRequest({ params: productIdParamSchema, body: updateProductSchema }),
  asyncHandler(productsController.updateProduct)
);

router.delete(
  "/:id",
  requirePermission(["product.delete"]),
  validateRequest({ params: productIdParamSchema }),
  asyncHandler(productsController.deleteProduct)
);

router.get(
  "/",
  requirePermission(["product.view"]),
  validateRequest({ query: listProductsQuerySchema }),
  asyncHandler(productsController.listProducts)
);

router.post(
  "/",
  requirePermission(["product.create"]),
  validateRequest({ body: createProductSchema }),
  asyncHandler(productsController.createProduct)
);

export default router;
