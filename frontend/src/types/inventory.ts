import type { DownloadFileResult } from "./product";

export type WarehouseStatus = "active" | "inactive" | "deleted";
export type WarehouseMutableStatus = Exclude<WarehouseStatus, "deleted">;
export type BatchStatus = "active" | "expired" | "blocked" | "deleted";
export type BatchMutableStatus = Exclude<BatchStatus, "deleted">;
export type StockMovementType =
  | "opening_stock"
  | "purchase"
  | "purchase_return"
  | "sale"
  | "sales_return"
  | "adjustment_in"
  | "adjustment_out"
  | "damaged"
  | "expired_writeoff"
  | "found"
  | "lost"
  | "transfer_in"
  | "transfer_out";
export type StockAdjustmentType =
  | "increase"
  | "decrease"
  | "damaged"
  | "lost"
  | "expired_writeoff"
  | "found"
  | "opening_correction"
  | "manual_correction";
export type StockAdjustmentStatus = "completed" | "cancelled";
export type InventoryAlertType =
  | "low_stock"
  | "out_of_stock"
  | "reorder_needed"
  | "expired"
  | "expiring_soon"
  | "overstock";
export type InventoryAlertSeverity = "low" | "medium" | "high" | "critical";
export type InventoryValuationMethod = "weighted_average";
export type InventoryExportFormat = "csv" | "xlsx" | "pdf";

export interface InventoryPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface InventoryListResponse<T> {
  items: T[];
  pagination: InventoryPagination;
}

export interface Warehouse {
  id: string;
  warehouseCode: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contactPerson: string | null;
  mobile: string | null;
  isDefault: boolean;
  status: WarehouseStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface WarehouseInput {
  warehouseCode?: string | null;
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  contactPerson?: string | null;
  mobile?: string | null;
  isDefault?: boolean;
  status?: WarehouseMutableStatus;
}

export interface InventoryProductRef {
  id: string;
  productCode: string;
  name: string;
  sku: string | null;
  barcode?: string | null;
  status?: "active" | "inactive" | "deleted";
  stockTrackingEnabled?: boolean;
}

export interface InventoryUnitRef {
  id: string | null;
  name: string | null;
  symbol: string | null;
}

export interface InventoryCategoryRef {
  id: string | null;
  name: string | null;
}

export interface InventoryWarehouseRef {
  id: string;
  warehouseCode: string | null;
  name: string | null;
}

export interface InventoryBatchRef {
  id: string;
  batchNumber: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  status?: BatchStatus;
}

export interface StockBalance {
  product: InventoryProductRef;
  unit: InventoryUnitRef;
  category: InventoryCategoryRef;
  warehouse: InventoryWarehouseRef;
  batch: InventoryBatchRef | null;
  availableQuantity: string;
  reservedQuantity: string;
  damagedQuantity: string;
  expiredQuantity: string;
  averageCost: string;
  stockValue: string;
  lowStock: boolean;
  outOfStock: boolean;
  expired: boolean;
  expiringSoon: boolean;
  updatedAt: string;
}

export interface StockSummary {
  totalStockValue: string;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  expiredStockCount: number;
}

export interface ProductStockDetail {
  product: {
    id: string;
    productCode: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    minimumStockLevel: string;
    reorderLevel: string;
    maximumStockLevel: string;
    negativeStockAllowed: boolean;
  };
  items: Array<{
    warehouse: InventoryWarehouseRef;
    batch: InventoryBatchRef | null;
    availableQuantity: string;
    reservedQuantity: string;
    damagedQuantity: string;
    expiredQuantity: string;
    averageCost: string;
    stockValue: string;
    updatedAt: string;
  }>;
}

export interface ProductBatch {
  id: string;
  productId: string;
  warehouseId: string;
  batchNumber: string;
  manufacturingDate: string | null;
  expiryDate: string | null;
  purchaseRate: string;
  saleRate: string;
  status: BatchStatus;
  productName: string | null;
  productCode: string | null;
  warehouseName: string | null;
  warehouseCode: string | null;
  availableQuantity: string;
  averageCost: string;
  stockValue: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BatchInput {
  productId: string;
  warehouseId: string;
  batchNumber: string;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  purchaseRate?: number;
  saleRate?: number;
  status?: BatchMutableStatus;
}

export interface StockAdjustment {
  id: string;
  adjustmentType: StockAdjustmentType;
  quantity: string;
  rate: string;
  value: string;
  reason: string;
  adjustmentDate: string;
  status: StockAdjustmentStatus;
  product: InventoryProductRef;
  warehouse: InventoryWarehouseRef;
  batch: Pick<InventoryBatchRef, "id" | "batchNumber"> | null;
  createdBy: string | null;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  movementType: StockMovementType;
  referenceType: string | null;
  referenceId: string | null;
  referenceNumber: string | null;
  movementDate: string;
  inQuantity: string;
  outQuantity: string;
  balanceAfter: string;
  rate: string;
  value: string;
  remarks: string | null;
  product: InventoryProductRef;
  warehouse: InventoryWarehouseRef;
  batch: Pick<InventoryBatchRef, "id" | "batchNumber"> | null;
  createdBy: string | null;
  createdAt: string;
}

export interface InventoryAlert {
  id: string;
  alertType: InventoryAlertType;
  severity: InventoryAlertSeverity;
  message: string;
  thresholdQuantity: string | null;
  currentQuantity: string | null;
  expiryDate: string | null;
  isRead: boolean;
  resolvedAt: string | null;
  createdAt: string;
  product: InventoryProductRef;
  warehouse: InventoryWarehouseRef | null;
  batch: Pick<InventoryBatchRef, "id" | "batchNumber"> | null;
}

export interface InventoryValuationRow {
  product: {
    id: string;
    productCode: string;
    name: string;
    sku: string | null;
  };
  category: string | null;
  unit: string | null;
  quantity: string;
  stockValue: string;
  averageCost: string;
}

export interface OpeningStockInput {
  productId: string;
  warehouseId: string;
  batchId?: string | null;
  batchNumber?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  purchaseRate?: number;
  saleRate?: number;
  quantity: number;
  rate: number;
  movementDate?: string;
  remarks?: string | null;
}

export interface AdjustmentInput {
  productId: string;
  warehouseId: string;
  batchId?: string | null;
  batchNumber?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  purchaseRate?: number;
  saleRate?: number;
  adjustmentType: StockAdjustmentType;
  quantity: number;
  rate?: number;
  reason: string;
  adjustmentDate?: string;
  remarks?: string | null;
}

export interface InventoryQuery {
  page?: number;
  limit?: number;
  search?: string;
  warehouseId?: string;
  categoryId?: string;
  productId?: string;
  batchId?: string;
  lowStock?: boolean;
  outOfStock?: boolean;
  expired?: boolean;
  expiringSoon?: boolean;
  status?: string;
  adjustmentType?: StockAdjustmentType;
  movementType?: StockMovementType;
  referenceType?: string;
  type?: InventoryAlertType;
  severity?: InventoryAlertSeverity;
  read?: boolean;
  dateFrom?: string;
  dateTo?: string;
  method?: InventoryValuationMethod;
  format?: InventoryExportFormat;
}

export interface InventoryMutationAlertSync {
  created: number;
  resolved: number;
}

export interface OpeningStockResponse {
  movement: StockMovement;
  balance: {
    availableQuantity: string;
    averageCost: string;
    stockValue: string;
  };
  alerts: InventoryMutationAlertSync;
}

export interface AdjustmentResponse {
  adjustment: {
    id: string;
    adjustmentType: StockAdjustmentType;
    quantity: string;
    rate: string;
    value: string;
    reason: string;
    adjustmentDate: string;
    status: StockAdjustmentStatus;
  };
  movement: StockMovement;
  balance: {
    availableQuantity: string;
    damagedQuantity: string;
    expiredQuantity: string;
    averageCost: string;
    stockValue: string;
  };
  alerts: InventoryMutationAlertSync;
}

export interface InventoryValuationResponse {
  method: InventoryValuationMethod;
  items: InventoryValuationRow[];
  totals: {
    totalQuantity: string;
    totalValue: string;
  };
}

export interface InventoryExportResult extends DownloadFileResult {}
