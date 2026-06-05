import type { InventoryExportFormat, InventoryListResponse, InventoryWarehouseRef } from "./inventory";
import type { DownloadFileResult } from "./product";

export type StockCheckStatus = "draft" | "completed" | "approved" | "cancelled";
export type StockCheckItemStatus = "matched" | "short" | "excess";
export type StockCheckExportFormat = Extract<InventoryExportFormat, "pdf" | "xlsx">;

export interface StockCheckUserRef {
  id: string;
  name: string | null;
}

export interface StockCheckProductRef {
  id: string;
  name: string;
  productCode: string;
  sku: string | null;
}

export interface StockCheckBatchRef {
  id: string;
  batchNumber: string | null;
  expiryDate: string | null;
}

export interface StockCheckSummary {
  totalItems: number;
  matchedItems: number;
  shortItems: number;
  excessItems: number;
}

export interface StockCheckListItem {
  id: string;
  checkNo: string;
  warehouse: InventoryWarehouseRef;
  status: StockCheckStatus;
  checkDate: string;
  checkedBy: StockCheckUserRef;
  approvedBy: StockCheckUserRef | null;
  remarks: string | null;
  summary: StockCheckSummary;
  createdAt: string;
  updatedAt: string;
}

export interface StockCheckItem {
  id: string;
  product: StockCheckProductRef;
  batch: StockCheckBatchRef | null;
  systemQty: string;
  physicalQty: string;
  differenceQty: string;
  status: StockCheckItemStatus;
  reason: string | null;
  createdAt: string;
}

export interface StockCheckDetail extends StockCheckListItem {
  items: StockCheckItem[];
  approvalHistory: Array<{
    status: "created" | "completed" | "approved";
    userId: string;
    userName: string | null;
    at: string;
  }>;
}

export interface StockCheckInputItem {
  productId: string;
  batchId?: string | null;
  physicalQty: number;
  reason?: string | null;
}

export interface StockCheckInput {
  warehouseId: string;
  checkDate?: string;
  remarks?: string | null;
  items: StockCheckInputItem[];
}

export interface StockCheckQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: StockCheckStatus;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type StockCheckListResponse = InventoryListResponse<StockCheckListItem>;

export interface StockCheckDetailResponse {
  stockCheck: StockCheckDetail;
}

export interface StockCheckApprovalResponse extends StockCheckDetailResponse {
  adjustedItems: number;
}

export type StockCheckExportResult = DownloadFileResult;
