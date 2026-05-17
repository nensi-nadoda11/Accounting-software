export const WAREHOUSE_STATUSES = ["active", "inactive", "deleted"] as const;
export const WAREHOUSE_MUTABLE_STATUSES = ["active", "inactive"] as const;
export const BATCH_STATUSES = ["active", "expired", "blocked", "deleted"] as const;
export const BATCH_MUTABLE_STATUSES = ["active", "expired", "blocked"] as const;
export const STOCK_MOVEMENT_TYPES = [
  "opening_stock",
  "purchase",
  "purchase_return",
  "sale",
  "sales_return",
  "adjustment_in",
  "adjustment_out",
  "damaged",
  "expired_writeoff",
  "found",
  "lost",
  "transfer_in",
  "transfer_out"
] as const;
export const STOCK_ADJUSTMENT_TYPES = [
  "increase",
  "decrease",
  "damaged",
  "lost",
  "expired_writeoff",
  "found",
  "opening_correction",
  "manual_correction"
] as const;
export const STOCK_ADJUSTMENT_STATUSES = ["completed", "cancelled"] as const;
export const INVENTORY_ALERT_TYPES = [
  "low_stock",
  "out_of_stock",
  "reorder_needed",
  "expired",
  "expiring_soon",
  "overstock"
] as const;
export const INVENTORY_ALERT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const INVENTORY_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const INVENTORY_VALUATION_METHODS = ["weighted_average"] as const;

export type InventoryActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type InventoryRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type InventoryExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export type WarehouseStatus = (typeof WAREHOUSE_STATUSES)[number];
export type WarehouseMutableStatus = (typeof WAREHOUSE_MUTABLE_STATUSES)[number];
export type BatchStatus = (typeof BATCH_STATUSES)[number];
export type BatchMutableStatus = (typeof BATCH_MUTABLE_STATUSES)[number];
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
export type StockAdjustmentType = (typeof STOCK_ADJUSTMENT_TYPES)[number];
export type StockAdjustmentStatus = (typeof STOCK_ADJUSTMENT_STATUSES)[number];
export type InventoryAlertType = (typeof INVENTORY_ALERT_TYPES)[number];
export type InventoryAlertSeverity = (typeof INVENTORY_ALERT_SEVERITIES)[number];
export type InventoryValuationMethod = (typeof INVENTORY_VALUATION_METHODS)[number];
