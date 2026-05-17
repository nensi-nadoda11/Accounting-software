import { AxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type {
  BatchStatus,
  InventoryAlert,
  InventoryAlertSeverity,
  InventoryAlertType,
  ProductBatch,
  StockAdjustmentType,
  StockBalance,
  StockMovementType,
  Warehouse,
  WarehouseMutableStatus,
} from "../../types/inventory";
import type { Product, ProductLookupItem, ProductUnit } from "../../types/product";
import {
  formatDate,
  formatDateTime,
  formatInr,
  multiplyScaled,
  normalizeMoney,
  normalizeQuantity,
  saveDownloadedFile,
} from "../products/productUtils";

type ApiErrorShape = {
  message?: string;
  errors?: string[];
};

export type InventoryTabId =
  | "current-stock"
  | "warehouses"
  | "batches"
  | "adjustments"
  | "movements"
  | "alerts"
  | "valuation";

export type LookupOption = {
  id: string;
  label: string;
  description?: string;
};

export type InventoryProductSettings = {
  id: string;
  name: string;
  productCode: string;
  productType: Product["productType"];
  stockTrackingEnabled: boolean;
  batchTrackingEnabled: boolean;
  expiryTrackingEnabled: boolean;
  negativeStockAllowed: boolean;
  purchasePrice: string;
  minimumStockLevel: string;
  reorderLevel: string;
  maximumStockLevel: string;
  unit: {
    id: string;
    name: string | null;
    symbol: string | null;
    decimalAllowed: boolean;
  };
};

export { formatDate, formatDateTime, formatInr, normalizeMoney, normalizeQuantity, saveDownloadedFile };

export const INVENTORY_TAB_LABELS: Record<InventoryTabId, string> = {
  "current-stock": "Current Stock",
  warehouses: "Warehouses",
  batches: "Batches",
  adjustments: "Adjustments",
  movements: "Movements",
  alerts: "Alerts",
  valuation: "Valuation",
};

export const WAREHOUSE_STATUS_OPTIONS: Array<{ label: string; value: WarehouseMutableStatus | "" }> = [
  { label: "All Status", value: "" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

export const BATCH_STATUS_OPTIONS: Array<{ label: string; value: BatchStatus | "" }> = [
  { label: "All Status", value: "" },
  { label: "Active", value: "active" },
  { label: "Expired", value: "expired" },
  { label: "Blocked", value: "blocked" },
];

export const YES_NO_FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Yes", value: "true" },
  { label: "No", value: "false" },
] as const;

export const STOCK_ADJUSTMENT_TYPE_LABELS: Record<StockAdjustmentType, string> = {
  increase: "Increase",
  decrease: "Decrease",
  damaged: "Damaged",
  lost: "Lost",
  expired_writeoff: "Expired Write-off",
  found: "Found",
  opening_correction: "Opening Correction",
  manual_correction: "Manual Correction",
};

export const STOCK_MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  opening_stock: "Opening Stock",
  purchase: "Purchase",
  purchase_return: "Purchase Return",
  sale: "Sale",
  sales_return: "Sales Return",
  adjustment_in: "Adjustment In",
  adjustment_out: "Adjustment Out",
  damaged: "Damaged",
  expired_writeoff: "Expired Write-off",
  found: "Found",
  lost: "Lost",
  transfer_in: "Transfer In",
  transfer_out: "Transfer Out",
};

export const INVENTORY_ALERT_TYPE_LABELS: Record<InventoryAlertType, string> = {
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
  reorder_needed: "Reorder Needed",
  expired: "Expired",
  expiring_soon: "Expiring Soon",
  overstock: "Overstock",
};

export const INVENTORY_ALERT_SEVERITY_LABELS: Record<InventoryAlertSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const ALERT_READ_FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Unread", value: "false" },
  { label: "Read", value: "true" },
] as const;

export const quantityStepFor = (decimalAllowed: boolean) => (decimalAllowed ? "0.001" : "1");

export const quantityValueFrom = (quantity: string | number, rate: string | number) => multiplyScaled(quantity, 3, rate, 2, 2);

export const toInputDateValue = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

export const toOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : undefined;
};

export const toNullableString = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const toOptionalLookup = (value: LookupOption | null) => value?.id || "";

export const getStockStatus = (row: StockBalance) => {
  if (row.outOfStock) {
    return { label: "Out of Stock", tone: "danger" as const };
  }

  if (row.expired) {
    return { label: "Expired", tone: "danger" as const };
  }

  if (row.expiringSoon) {
    return { label: "Expiring Soon", tone: "warning" as const };
  }

  if (row.lowStock) {
    return { label: "Low Stock", tone: "warning" as const };
  }

  return { label: "Healthy", tone: "success" as const };
};

export const getBatchStatusTone = (status: BatchStatus) => {
  if (status === "active") {
    return "success" as const;
  }

  if (status === "blocked") {
    return "warning" as const;
  }

  return "danger" as const;
};

export const getAlertTone = (alertType: InventoryAlertType) => {
  if (alertType === "low_stock" || alertType === "reorder_needed" || alertType === "expiring_soon") {
    return "warning" as const;
  }

  if (alertType === "expired" || alertType === "out_of_stock") {
    return "danger" as const;
  }

  return "info" as const;
};

export const getSeverityTone = (severity: InventoryAlertSeverity) => {
  if (severity === "low") {
    return "success" as const;
  }

  if (severity === "medium" || severity === "high") {
    return "warning" as const;
  }

  return "danger" as const;
};

export const formatLookupProduct = (item: ProductLookupItem): LookupOption => ({
  id: item.id,
  label: `${item.productCode} - ${item.name}`,
  description: item.sku || item.barcode || item.unit.symbol || undefined,
});

export const formatLookupWarehouse = (warehouse: Warehouse): LookupOption => ({
  id: warehouse.id,
  label: `${warehouse.warehouseCode} - ${warehouse.name}`,
  description: warehouse.city || warehouse.contactPerson || undefined,
});

export const formatLookupBatch = (batch: ProductBatch): LookupOption => ({
  id: batch.id,
  label: batch.batchNumber,
  description: `${batch.productCode ?? ""}${batch.productCode ? " - " : ""}${batch.warehouseCode ?? ""}`.trim() || undefined,
});

export const buildProductSettings = (product: Product, unitMap: Map<string, ProductUnit>): InventoryProductSettings => ({
  id: product.id,
  name: product.name,
  productCode: product.productCode,
  productType: product.productType,
  stockTrackingEnabled: product.stockTrackingEnabled,
  batchTrackingEnabled: product.batchTrackingEnabled,
  expiryTrackingEnabled: product.expiryTrackingEnabled,
  negativeStockAllowed: product.negativeStockAllowed,
  purchasePrice: product.purchasePrice,
  minimumStockLevel: product.minimumStockLevel,
  reorderLevel: product.reorderLevel,
  maximumStockLevel: product.maximumStockLevel,
  unit: {
    id: product.unit.id,
    name: product.unit.name,
    symbol: product.unit.symbol,
    decimalAllowed: unitMap.get(product.unit.id)?.decimalAllowed ?? true,
  },
});

export const ensureIntegerQuantity = (value: number) => Number.isInteger(value);

const normalizeServerField = (field: string) => (field.startsWith("body.") ? field.slice(5) : field);

export const applyInventoryFieldErrors = <TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  hints?: Partial<Record<keyof TFieldValues & string, string>>,
) => {
  if (!(error instanceof AxiosError) || !error.response) {
    return false;
  }

  const data = error.response.data as ApiErrorShape | undefined;
  const handled = new Set<string>();

  for (const item of data?.errors ?? []) {
    const separatorIndex = item.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const field = normalizeServerField(item.slice(0, separatorIndex).trim()) as Path<TFieldValues>;
    const message = item.slice(separatorIndex + 1).trim();

    if (!field || !message) {
      continue;
    }

    handled.add(field);
    setError(field, { type: "server", message });
  }

  if (handled.size || !data?.message || !hints) {
    return handled.size > 0;
  }

  const message = data.message.toLowerCase();

  for (const [field, matchText] of Object.entries(hints)) {
    if (!matchText) {
      continue;
    }

    if (message.includes(matchText.toLowerCase())) {
      handled.add(field);
      setError(field as Path<TFieldValues>, { type: "server", message: data.message });
    }
  }

  return handled.size > 0;
};

export const getAlertStatusLabel = (alert: InventoryAlert) => {
  if (alert.resolvedAt) {
    return "Resolved";
  }

  return alert.isRead ? "Read" : "Unread";
};
