import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  AdjustmentInput,
  AdjustmentResponse,
  BatchInput,
  InventoryAlert,
  InventoryExportResult,
  InventoryListResponse,
  InventoryMutationAlertSync,
  InventoryQuery,
  InventoryValuationResponse,
  OpeningStockInput,
  OpeningStockResponse,
  ProductBatch,
  ProductStockDetail,
  StockAdjustment,
  StockBalance,
  StockMovement,
  StockSummary,
  Warehouse,
  WarehouseInput,
} from "../types/inventory";

const getFileNameFromDisposition = (contentDisposition: string | undefined, fallback: string) => {
  if (!contentDisposition) {
    return fallback;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const match = contentDisposition.match(/filename=\"?([^\"]+)\"?/i);
  return match?.[1] ?? fallback;
};

const extractDownload = async (
  request: Promise<AxiosResponse<Blob>>,
  fallbackFileName: string,
): Promise<InventoryExportResult> => {
  const response = await request;

  return {
    blob: response.data,
    fileName: getFileNameFromDisposition(response.headers["content-disposition"], fallbackFileName),
    contentType:
      typeof response.headers["content-type"] === "string"
        ? response.headers["content-type"]
        : "application/octet-stream",
  };
};

export const inventoryApi = {
  listWarehouses: async (query: InventoryQuery) =>
    (
      await client.get<ApiResponse<InventoryListResponse<Warehouse>>>("/inventory/warehouses", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
        },
      })
    ).data,

  createWarehouse: async (payload: WarehouseInput) =>
    (await client.post<ApiResponse<{ warehouse: Warehouse }>>("/inventory/warehouses", payload)).data,

  updateWarehouse: async (warehouseId: string, payload: Partial<WarehouseInput>) =>
    (await client.patch<ApiResponse<{ warehouse: Warehouse }>>(`/inventory/warehouses/${warehouseId}`, payload)).data,

  deleteWarehouse: async (warehouseId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/inventory/warehouses/${warehouseId}`)).data,

  setDefaultWarehouse: async (warehouseId: string) =>
    (await client.post<ApiResponse<{ warehouse: Warehouse }>>(`/inventory/warehouses/${warehouseId}/default`)).data,

  listStock: async (query: InventoryQuery) =>
    (
      await client.get<ApiResponse<InventoryListResponse<StockBalance>>>("/inventory/stock", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          warehouseId: query.warehouseId || undefined,
          categoryId: query.categoryId || undefined,
          productId: query.productId || undefined,
          lowStock: query.lowStock,
          outOfStock: query.outOfStock,
          expired: query.expired,
          expiringSoon: query.expiringSoon,
          status: query.status || undefined,
        },
      })
    ).data,

  getProductStock: async (productId: string) =>
    (await client.get<ApiResponse<ProductStockDetail>>(`/inventory/stock/${productId}`)).data,

  getStockSummary: async (query: InventoryQuery) =>
    (
      await client.get<ApiResponse<StockSummary>>("/inventory/stock/summary", {
        params: {
          warehouseId: query.warehouseId || undefined,
          categoryId: query.categoryId || undefined,
          productId: query.productId || undefined,
        },
      })
    ).data,

  exportStock: async (query: InventoryQuery) =>
    extractDownload(
      client.get("/inventory/stock/export", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          warehouseId: query.warehouseId || undefined,
          categoryId: query.categoryId || undefined,
          productId: query.productId || undefined,
          lowStock: query.lowStock,
          outOfStock: query.outOfStock,
          expired: query.expired,
          expiringSoon: query.expiringSoon,
          status: query.status || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "inventory-stock.csv",
    ),

  listBatches: async (query: InventoryQuery) =>
    (
      await client.get<ApiResponse<InventoryListResponse<ProductBatch>>>("/inventory/batches", {
        params: {
          page: query.page,
          limit: query.limit,
          productId: query.productId || undefined,
          warehouseId: query.warehouseId || undefined,
          expired: query.expired,
          expiringSoon: query.expiringSoon,
          status: query.status || undefined,
        },
      })
    ).data,

  createBatch: async (payload: BatchInput) =>
    (await client.post<ApiResponse<{ batch: ProductBatch }>>("/inventory/batches", payload)).data,

  updateBatch: async (batchId: string, payload: Partial<BatchInput>) =>
    (await client.patch<ApiResponse<{ batch: ProductBatch }>>(`/inventory/batches/${batchId}`, payload)).data,

  addOpeningStock: async (payload: OpeningStockInput) =>
    (await client.post<ApiResponse<OpeningStockResponse>>("/inventory/opening-stock", payload)).data,

  listAdjustments: async (query: InventoryQuery) =>
    (
      await client.get<ApiResponse<InventoryListResponse<StockAdjustment>>>("/inventory/adjustments", {
        params: {
          page: query.page,
          limit: query.limit,
          productId: query.productId || undefined,
          warehouseId: query.warehouseId || undefined,
          adjustmentType: query.adjustmentType || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  createAdjustment: async (payload: AdjustmentInput) =>
    (await client.post<ApiResponse<AdjustmentResponse>>("/inventory/adjustments", payload)).data,

  listMovements: async (query: InventoryQuery) =>
    (
      await client.get<ApiResponse<InventoryListResponse<StockMovement>>>("/inventory/movements", {
        params: {
          page: query.page,
          limit: query.limit,
          productId: query.productId || undefined,
          warehouseId: query.warehouseId || undefined,
          batchId: query.batchId || undefined,
          movementType: query.movementType || undefined,
          referenceType: query.referenceType || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  exportMovements: async (query: InventoryQuery) =>
    extractDownload(
      client.get("/inventory/movements/export", {
        params: {
          page: query.page,
          limit: query.limit,
          productId: query.productId || undefined,
          warehouseId: query.warehouseId || undefined,
          batchId: query.batchId || undefined,
          movementType: query.movementType || undefined,
          referenceType: query.referenceType || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "inventory-movements.csv",
    ),

  listAlerts: async (query: InventoryQuery) =>
    (
      await client.get<ApiResponse<InventoryListResponse<InventoryAlert>>>("/inventory/alerts", {
        params: {
          page: query.page,
          limit: query.limit,
          type: query.type || undefined,
          severity: query.severity || undefined,
          read: query.read,
        },
      })
    ).data,

  markAlertRead: async (alertId: string, isRead = true) =>
    (await client.patch<ApiResponse<{ alert: { id: string; isRead: boolean } }>>(`/inventory/alerts/${alertId}/read`, { isRead })).data,

  recalculateAlerts: async (payload?: { productId?: string; warehouseId?: string; batchId?: string }) =>
    (await client.post<ApiResponse<InventoryMutationAlertSync>>("/inventory/alerts/recalculate", payload ?? {})).data,

  getValuation: async (query: InventoryQuery) =>
    (
      await client.get<ApiResponse<InventoryValuationResponse>>("/inventory/valuation", {
        params: {
          method: query.method ?? "weighted_average",
          warehouseId: query.warehouseId || undefined,
          categoryId: query.categoryId || undefined,
          productId: query.productId || undefined,
        },
      })
    ).data,

  exportValuation: async (query: InventoryQuery) =>
    extractDownload(
      client.get("/inventory/valuation/export", {
        params: {
          method: query.method ?? "weighted_average",
          warehouseId: query.warehouseId || undefined,
          categoryId: query.categoryId || undefined,
          productId: query.productId || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "inventory-valuation.csv",
    ),
};
