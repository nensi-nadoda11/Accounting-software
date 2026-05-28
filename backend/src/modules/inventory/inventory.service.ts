import { db } from "../../db";
import {
  inventoryAlerts,
  productBatches,
  products,
  stockAdjustments,
  stockBalances,
  warehouses
} from "../../db/schema";
import { env } from "../../config/env";
import { auditLogService } from "../audit-logs/audit-log.service";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { inventoryRepository } from "./inventory.repository";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
import type {
  AddOpeningStockInput,
  CreateAdjustmentInput,
  CreateBatchInput,
  CreateWarehouseInput,
  ExportMovementsQuery,
  ExportStockQuery,
  ExportValuationQuery,
  ListAdjustmentsQuery,
  ListAlertsQuery,
  ListBatchesQuery,
  ListMovementsQuery,
  ListStockQuery,
  ListWarehousesQuery,
  MarkAlertReadInput,
  RecalculateAlertsInput,
  StockSummaryQuery,
  UpdateBatchInput,
  UpdateWarehouseInput,
  ValuationQuery
} from "./inventory.validator";
import type {
  BatchStatus,
  InventoryActor,
  InventoryAlertSeverity,
  InventoryAlertType,
  InventoryExportPayload,
  InventoryRequestContext,
  StockAdjustmentType,
  StockMovementType
} from "./inventory.types";
import {
  addDecimals,
  calculateStockValue,
  calculateWeightedAverageCost,
  compareDecimals,
  decimalToScaledBigInt,
  divideMoneyByQuantity,
  isPositiveDecimal,
  multiplyQtyRate,
  normalizeMoney,
  normalizeQuantity,
  subtractDecimals,
  toDateOnly
} from "./inventory.utils";

type WarehouseRecord = typeof warehouses.$inferSelect;
type BatchRecord = typeof productBatches.$inferSelect;
type BalanceRecord = typeof stockBalances.$inferSelect;
type ProductRecord = typeof products.$inferSelect;

type ProductContextRow = Awaited<ReturnType<typeof inventoryRepository.findProductInventoryContext>>;
type BatchContextRow = Awaited<ReturnType<typeof inventoryRepository.findBatchById>>;
type InventoryTransactionExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

type BatchResolutionInput = {
  companyId: string;
  actorId: string;
  product: ProductRecord;
  warehouse: WarehouseRecord;
  batchId: string | null;
  batchNumber: string | null;
  manufacturingDate?: Date | null;
  expiryDate?: Date | null;
  purchaseRate?: number | null;
  saleRate?: number | null;
};

type AlertCandidate = Awaited<ReturnType<typeof inventoryRepository.listAlertCandidates>>[number];

type StockMutationResult = {
  balance: BalanceRecord;
  movement: typeof import("../../db/schema").stockMovements.$inferSelect;
};

const ALL_ALERT_TYPES: InventoryAlertType[] = [
  "low_stock",
  "out_of_stock",
  "reorder_needed",
  "expired",
  "expiring_soon",
  "overstock"
];

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const formatReportDateLabel = (value: Date | null | undefined) => {
  if (!value) {
    return "-";
  }

  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

class InventoryService {
  private mapWarehouse(warehouse: WarehouseRecord) {
    return {
      id: warehouse.id,
      warehouseCode: warehouse.warehouseCode,
      name: warehouse.name,
      addressLine1: warehouse.addressLine1,
      addressLine2: warehouse.addressLine2,
      city: warehouse.city,
      state: warehouse.state,
      pincode: warehouse.pincode,
      contactPerson: warehouse.contactPerson,
      mobile: warehouse.mobile,
      isDefault: warehouse.isDefault,
      status: warehouse.status,
      createdBy: warehouse.createdBy,
      updatedBy: warehouse.updatedBy,
      createdAt: warehouse.createdAt,
      updatedAt: warehouse.updatedAt,
      deletedAt: warehouse.deletedAt
    };
  }

  private mapBatch(row: NonNullable<BatchContextRow> | Awaited<ReturnType<typeof inventoryRepository.listBatches>>["rows"][number]) {
    const batch = row.batch;
    const availableQuantity = "availableQuantity" in row ? row.availableQuantity : null;
    const averageCost = "averageCost" in row ? row.averageCost : null;
    const stockValue = "stockValue" in row ? row.stockValue : null;

    return {
      id: batch.id,
      productId: batch.productId,
      warehouseId: batch.warehouseId,
      batchNumber: batch.batchNumber,
      manufacturingDate: batch.manufacturingDate,
      expiryDate: batch.expiryDate,
      purchaseRate: normalizeMoney(batch.purchaseRate),
      saleRate: normalizeMoney(batch.saleRate),
      status: batch.status,
      productName: row.productName ?? null,
      productCode: row.productCode ?? null,
      warehouseName: row.warehouseName ?? null,
      warehouseCode: row.warehouseCode ?? null,
      availableQuantity: availableQuantity ? normalizeQuantity(availableQuantity) : "0.000",
      averageCost: averageCost ? normalizeMoney(averageCost) : "0.00",
      stockValue: stockValue ? normalizeMoney(stockValue) : "0.00",
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      deletedAt: batch.deletedAt
    };
  }

  private mapStockRow(row: Awaited<ReturnType<typeof inventoryRepository.listStock>>["rows"][number]) {
    const expiryDate = row.expiryDate;
    const today = this.getTodayDateOnly();
    const expiryDateOnly = expiryDate ? toDateOnly(expiryDate) : null;
    const availableQuantity = normalizeQuantity(row.balance.availableQuantity);

    return {
      product: {
        id: row.product.id,
        productCode: row.product.productCode,
        name: row.product.name,
        sku: row.product.sku,
        barcode: row.product.barcode,
        status: row.product.status,
        stockTrackingEnabled: row.product.stockTrackingEnabled
      },
      unit: {
        id: row.product.unitId,
        name: row.unitName,
        symbol: row.unitSymbol
      },
      category: {
        id: row.product.categoryId,
        name: row.categoryName
      },
      warehouse: {
        id: row.balance.warehouseId,
        warehouseCode: row.warehouseCode,
        name: row.warehouseName
      },
      batch: row.balance.batchId
        ? {
            id: row.balance.batchId,
            batchNumber: row.batchNumber,
            manufacturingDate: row.manufacturingDate,
            expiryDate,
            status: row.batchStatus
          }
        : null,
      availableQuantity,
      reservedQuantity: normalizeQuantity(row.balance.reservedQuantity),
      damagedQuantity: normalizeQuantity(row.balance.damagedQuantity),
      expiredQuantity: normalizeQuantity(row.balance.expiredQuantity),
      averageCost: normalizeMoney(row.balance.averageCost),
      stockValue: normalizeMoney(row.balance.stockValue),
      lowStock: compareDecimals(row.balance.availableQuantity, row.product.minimumStockLevel, 3) <= 0,
      outOfStock: compareDecimals(row.balance.availableQuantity, "0", 3) <= 0,
      expired: Boolean(expiryDateOnly && expiryDateOnly < today && compareDecimals(availableQuantity, "0", 3) > 0),
      expiringSoon: Boolean(
        expiryDateOnly &&
          expiryDateOnly >= today &&
          expiryDateOnly <= this.getFutureDateOnly(env.INVENTORY_EXPIRY_ALERT_DAYS) &&
          compareDecimals(availableQuantity, "0", 3) > 0
      ),
      updatedAt: row.balance.updatedAt
    };
  }

  private mapMovementRow(row: Awaited<ReturnType<typeof inventoryRepository.listMovements>>["rows"][number]) {
    return {
      id: row.movement.id,
      movementType: row.movement.movementType,
      referenceType: row.movement.referenceType,
      referenceId: row.movement.referenceId,
      referenceNumber: row.movement.referenceNumber,
      movementDate: row.movement.movementDate,
      inQuantity: normalizeQuantity(row.movement.inQuantity),
      outQuantity: normalizeQuantity(row.movement.outQuantity),
      balanceAfter: normalizeQuantity(row.movement.balanceAfter),
      rate: normalizeMoney(row.movement.rate),
      value: normalizeMoney(row.movement.value),
      remarks: row.movement.remarks,
      product: {
        id: row.movement.productId,
        name: row.productName,
        productCode: row.productCode
      },
      warehouse: {
        id: row.movement.warehouseId,
        name: row.warehouseName,
        warehouseCode: row.warehouseCode
      },
      batch: row.movement.batchId
        ? {
            id: row.movement.batchId,
            batchNumber: row.batchNumber
          }
        : null,
      createdBy: row.movement.createdBy,
      createdAt: row.movement.createdAt
    };
  }

  private mapAdjustmentRow(row: Awaited<ReturnType<typeof inventoryRepository.listAdjustments>>["rows"][number]) {
    return {
      id: row.adjustment.id,
      adjustmentType: row.adjustment.adjustmentType,
      quantity: normalizeQuantity(row.adjustment.quantity),
      rate: normalizeMoney(row.adjustment.rate),
      value: normalizeMoney(row.adjustment.value),
      reason: row.adjustment.reason,
      adjustmentDate: row.adjustment.adjustmentDate,
      status: row.adjustment.status,
      product: {
        id: row.adjustment.productId,
        name: row.productName,
        productCode: row.productCode
      },
      warehouse: {
        id: row.adjustment.warehouseId,
        name: row.warehouseName,
        warehouseCode: row.warehouseCode
      },
      batch: row.adjustment.batchId
        ? {
            id: row.adjustment.batchId,
            batchNumber: row.batchNumber
          }
        : null,
      createdBy: row.adjustment.createdBy,
      createdAt: row.adjustment.createdAt
    };
  }

  private mapAlertRow(row: Awaited<ReturnType<typeof inventoryRepository.listAlerts>>["rows"][number]) {
    return {
      id: row.alert.id,
      alertType: row.alert.alertType,
      severity: row.alert.severity,
      message: row.alert.message,
      thresholdQuantity: row.alert.thresholdQuantity ? normalizeQuantity(row.alert.thresholdQuantity) : null,
      currentQuantity: row.alert.currentQuantity ? normalizeQuantity(row.alert.currentQuantity) : null,
      expiryDate: row.alert.expiryDate,
      isRead: row.alert.isRead,
      resolvedAt: row.alert.resolvedAt,
      createdAt: row.alert.createdAt,
      product: {
        id: row.alert.productId,
        name: row.productName,
        productCode: row.productCode
      },
      warehouse: row.alert.warehouseId
        ? {
            id: row.alert.warehouseId,
            name: row.warehouseName,
            warehouseCode: row.warehouseCode
          }
        : null,
      batch: row.alert.batchId
        ? {
            id: row.alert.batchId,
            batchNumber: row.batchNumber
          }
        : null
    };
  }

  private getTodayDateOnly() {
    return toDateOnly(new Date());
  }

  private getFutureDateOnly(days: number) {
    const next = new Date();
    next.setUTCDate(next.getUTCDate() + days);
    return toDateOnly(next);
  }

  private assertNotFutureDate(date: Date, label: string) {
    if (date.getTime() > Date.now()) {
      throw new AppError(`${label} cannot be in the future`, 400);
    }
  }

  private hasFractionalQuantity(value: string | number | null | undefined) {
    return decimalToScaledBigInt(value, 3) % 1000n !== 0n;
  }

  private buildNextWarehouseCode(previousCode: string | null) {
    const lastSequence = previousCode ? Number(previousCode.replace("WH-", "")) : 0;
    return `WH-${String((Number.isFinite(lastSequence) ? lastSequence : 0) + 1).padStart(6, "0")}`;
  }

  private async getProductOrThrow(companyId: string, productId: string, executor?: InventoryTransactionExecutor) {
    const row = await inventoryRepository.findProductInventoryContext(companyId, productId, executor);
    if (!row) {
      throw new AppError("Product not found", 404);
    }

    return row;
  }

  private async getWarehouseOrThrow(
    companyId: string,
    warehouseId: string,
    includeDeleted = false,
    executor?: InventoryTransactionExecutor
  ) {
    const warehouse = await inventoryRepository.findWarehouseById(companyId, warehouseId, includeDeleted, executor);
    if (!warehouse) {
      throw new AppError("Warehouse not found", 404);
    }

    return warehouse;
  }

  private async getBatchOrThrow(
    companyId: string,
    batchId: string,
    includeDeleted = false,
    executor?: InventoryTransactionExecutor
  ) {
    const row = await inventoryRepository.findBatchById(companyId, batchId, includeDeleted, executor);
    if (!row) {
      throw new AppError("Batch not found", 404);
    }

    return row;
  }

  private assertGoodsInventoryProduct(row: NonNullable<ProductContextRow>) {
    if (row.product.deletedAt || row.product.status === "deleted") {
      throw new AppError("Deleted products cannot be used for inventory operations", 400);
    }

    if (row.product.status !== "active") {
      throw new AppError("Only active products can be used for inventory operations", 400);
    }

    if (row.product.productType !== "goods") {
      throw new AppError("Service products are not allowed in inventory flows", 400);
    }

    if (!row.product.stockTrackingEnabled) {
      throw new AppError("Stock tracking must be enabled for this product", 400);
    }
  }

  private assertActiveWarehouse(warehouse: WarehouseRecord) {
    if (warehouse.deletedAt || warehouse.status === "deleted") {
      throw new AppError("Deleted warehouses cannot be used", 400);
    }

    if (warehouse.status !== "active") {
      throw new AppError("Only active warehouses can be used", 400);
    }
  }

  private assertDecimalQuantityAllowed(quantity: string, decimalAllowed: boolean) {
    if (!decimalAllowed && this.hasFractionalQuantity(quantity)) {
      throw new AppError("Decimal quantity is not allowed for this product unit", 400);
    }
  }

  private normalizeBatchStatus(expiryDate: Date | string | null | undefined, requestedStatus: BatchStatus) {
    if (expiryDate && toDateOnly(expiryDate) < this.getTodayDateOnly()) {
      return "expired" as const;
    }

    return requestedStatus;
  }

  private async resolveBatchForMutation(input: BatchResolutionInput, executor: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
    if (input.product.expiryTrackingEnabled && !input.batchId && !input.batchNumber) {
      throw new AppError("Batch details are required when expiry tracking is enabled", 400);
    }

    if (input.product.batchTrackingEnabled && !input.batchId && !input.batchNumber) {
      throw new AppError("Batch number is required for this product", 400);
    }

    if (!input.product.batchTrackingEnabled && (input.batchId || input.batchNumber)) {
      throw new AppError("This product does not support batch tracking", 400);
    }

    if (!input.batchId && !input.batchNumber) {
      return null;
    }

    if (input.batchId) {
      const batchRow = await this.getBatchOrThrow(input.companyId, input.batchId, false, executor);
      if (batchRow.batch.productId !== input.product.id || batchRow.batch.warehouseId !== input.warehouse.id) {
        throw new AppError("Batch does not belong to the selected product and warehouse", 400);
      }

      if (batchRow.batch.deletedAt || batchRow.batch.status === "deleted") {
        throw new AppError("Deleted batches cannot be used", 400);
      }

      if (input.product.expiryTrackingEnabled && !batchRow.batch.expiryDate) {
        throw new AppError("Expiry date is required for this product batch", 400);
      }

      return batchRow.batch;
    }

    const batchNumber = input.batchNumber!.trim();
    const existing = await inventoryRepository.findBatchByNumber(
      input.companyId,
      input.product.id,
      input.warehouse.id,
      batchNumber,
      undefined,
      executor
    );

    if (existing) {
      if (input.product.expiryTrackingEnabled && !existing.expiryDate) {
        throw new AppError("Expiry date is required for this product batch", 400);
      }

      return existing;
    }

    if (input.product.expiryTrackingEnabled && !input.expiryDate) {
      throw new AppError("Expiry date is required when expiry tracking is enabled", 400);
    }

    if (input.expiryDate && input.manufacturingDate && input.expiryDate <= input.manufacturingDate) {
      throw new AppError("Expiry date must be after manufacturing date", 400);
    }

    const created = await inventoryRepository.createBatch(
      {
        companyId: input.companyId,
        productId: input.product.id,
        warehouseId: input.warehouse.id,
        batchNumber,
        manufacturingDate: input.manufacturingDate ? toDateOnly(input.manufacturingDate) : null,
        expiryDate: input.expiryDate ? toDateOnly(input.expiryDate) : null,
        purchaseRate: normalizeMoney(input.purchaseRate ?? 0),
        saleRate: normalizeMoney(input.saleRate ?? 0),
        status: this.normalizeBatchStatus(input.expiryDate, "active"),
        createdBy: input.actorId,
        updatedBy: input.actorId
      },
      executor
    );

    if (!created) {
      throw new AppError("Failed to create batch", 500);
    }

    return created;
  }

  private async applyStockMutation(
    actor: InventoryActor,
    payload: {
      product: ProductRecord;
      warehouse: WarehouseRecord;
      batch: BatchRecord | null;
      movementType: StockMovementType;
      movementDate: Date;
      inQuantity: string;
      outQuantity: string;
      rate: string;
      remarks: string | null;
      referenceType: string | null;
      referenceId: string | null;
      referenceNumber: string | null;
      allowNegativeStock: boolean;
      movementValue?: string | undefined;
      damagedIncrement?: string | undefined;
      expiredIncrement?: string | undefined;
    },
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ): Promise<StockMutationResult> {
    if (isPositiveDecimal(payload.inQuantity, 3) && isPositiveDecimal(payload.outQuantity, 3)) {
      throw new AppError("In quantity and out quantity cannot both be greater than zero", 400);
    }

    if (!isPositiveDecimal(payload.inQuantity, 3) && !isPositiveDecimal(payload.outQuantity, 3)) {
      throw new AppError("Either in quantity or out quantity must be greater than zero", 400);
    }

    const batchId = payload.batch?.id ?? null;
    await inventoryRepository.acquireScopedLock(
      `stock-balance:${payload.product.id}:${payload.warehouse.id}:${batchId ?? "no-batch"}`,
      actor.companyId,
      executor
    );

    const existingBalance = await inventoryRepository.findStockBalance(
      actor.companyId,
      payload.product.id,
      payload.warehouse.id,
      batchId,
      executor
    );

    const oldAvailable = existingBalance?.availableQuantity ?? "0.000";
    const oldReserved = existingBalance?.reservedQuantity ?? "0.000";
    const oldDamaged = existingBalance?.damagedQuantity ?? "0.000";
    const oldExpired = existingBalance?.expiredQuantity ?? "0.000";
    const oldAverageCost = existingBalance?.averageCost ?? "0.00";

    let availableQuantity = oldAvailable;
    let averageCost = oldAverageCost;
    let damagedQuantity = oldDamaged;
    let expiredQuantity = oldExpired;

    if (isPositiveDecimal(payload.inQuantity, 3)) {
      availableQuantity = addDecimals(oldAvailable, payload.inQuantity, 3);
      averageCost = calculateWeightedAverageCost(oldAvailable, oldAverageCost, payload.inQuantity, payload.rate);
    } else {
      availableQuantity = subtractDecimals(oldAvailable, payload.outQuantity, 3);

      if (!payload.allowNegativeStock && compareDecimals(availableQuantity, "0", 3) < 0) {
        throw new AppError("Insufficient available quantity for this operation", 409);
      }

      if (compareDecimals(availableQuantity, "0", 3) === 0) {
        // Reset average cost when stock is fully depleted so the next inbound movement defines the fresh baseline.
        averageCost = "0.00";
      }
    }

    if (payload.damagedIncrement && compareDecimals(payload.damagedIncrement, "0", 3) > 0) {
      damagedQuantity = addDecimals(damagedQuantity, payload.damagedIncrement, 3);
    }

    if (payload.expiredIncrement && compareDecimals(payload.expiredIncrement, "0", 3) > 0) {
      expiredQuantity = addDecimals(expiredQuantity, payload.expiredIncrement, 3);
    }

    const stockValue = calculateStockValue(availableQuantity, averageCost);

    const balance =
      existingBalance
        ? await inventoryRepository.updateStockBalance(
            actor.companyId,
            existingBalance.id,
            {
              availableQuantity,
              reservedQuantity: oldReserved,
              damagedQuantity,
              expiredQuantity,
              averageCost,
              stockValue,
              lastMovementAt: payload.movementDate
            },
            executor
          )
        : await inventoryRepository.createStockBalance(
            {
              companyId: actor.companyId,
              productId: payload.product.id,
              warehouseId: payload.warehouse.id,
              batchId,
              availableQuantity,
              reservedQuantity: oldReserved,
              damagedQuantity,
              expiredQuantity,
              averageCost,
              stockValue,
              lastMovementAt: payload.movementDate
            },
            executor
          );

    if (!balance) {
      throw new AppError("Failed to update stock balance", 500);
    }

    const quantityForValue = isPositiveDecimal(payload.inQuantity, 3) ? payload.inQuantity : payload.outQuantity;
    const movementValue = payload.movementValue ? normalizeMoney(payload.movementValue) : multiplyQtyRate(quantityForValue, payload.rate);
    const movement = await inventoryRepository.createStockMovement(
      {
        companyId: actor.companyId,
        productId: payload.product.id,
        warehouseId: payload.warehouse.id,
        batchId,
        movementType: payload.movementType,
        referenceType: payload.referenceType,
        referenceId: payload.referenceId,
        referenceNumber: payload.referenceNumber,
        movementDate: payload.movementDate,
        inQuantity: payload.inQuantity,
        outQuantity: payload.outQuantity,
        balanceAfter: balance.availableQuantity,
        rate: payload.rate,
        value: movementValue,
        remarks: payload.remarks,
        createdBy: actor.id
      },
      executor
    );

    if (!movement) {
      throw new AppError("Failed to create stock movement", 500);
    }

    return {
      balance,
      movement
    };
  }

  private getMovementTypeForAdjustment(adjustmentType: StockAdjustmentType): StockMovementType {
    if (adjustmentType === "increase" || adjustmentType === "manual_correction" || adjustmentType === "opening_correction") {
      return "adjustment_in";
    }

    if (adjustmentType === "decrease") {
      return "adjustment_out";
    }

    if (adjustmentType === "damaged") {
      return "damaged";
    }

    if (adjustmentType === "lost") {
      return "lost";
    }

    if (adjustmentType === "expired_writeoff") {
      return "expired_writeoff";
    }

    return "found";
  }

  private getAlertSeverity(type: InventoryAlertType): InventoryAlertSeverity {
    if (type === "out_of_stock" || type === "expired") {
      return "critical";
    }

    if (type === "reorder_needed" || type === "overstock") {
      return "high";
    }

    if (type === "expiring_soon") {
      return "medium";
    }

    return "low";
  }

  private buildAlertMessage(candidate: AlertCandidate, alertType: InventoryAlertType, currentQuantity: string) {
    const warehouseName = candidate.warehouse.name;
    const batchNumber = candidate.batch?.batchNumber ? ` batch ${candidate.batch.batchNumber}` : "";

    if (alertType === "low_stock") {
      return `${candidate.product.name}${batchNumber} is below minimum stock in ${warehouseName}`;
    }

    if (alertType === "out_of_stock") {
      return `${candidate.product.name}${batchNumber} is out of stock in ${warehouseName}`;
    }

    if (alertType === "reorder_needed") {
      return `${candidate.product.name}${batchNumber} reached reorder level in ${warehouseName}`;
    }

    if (alertType === "overstock") {
      return `${candidate.product.name}${batchNumber} exceeded maximum stock in ${warehouseName}`;
    }

    if (alertType === "expired") {
      return `${candidate.product.name}${batchNumber} has expired with ${currentQuantity} quantity in ${warehouseName}`;
    }

    return `${candidate.product.name}${batchNumber} will expire soon in ${warehouseName}`;
  }

  private evaluateCandidateAlerts(candidate: AlertCandidate) {
    const currentQuantity = normalizeQuantity(candidate.balance.availableQuantity);
    const alerts: Array<{
      alertType: InventoryAlertType;
      severity: InventoryAlertSeverity;
      thresholdQuantity: string | null;
      currentQuantity: string;
      expiryDate: string | null;
      message: string;
    }> = [];

    if (compareDecimals(currentQuantity, candidate.product.minimumStockLevel, 3) <= 0) {
      alerts.push({
        alertType: "low_stock",
        severity: this.getAlertSeverity("low_stock"),
        thresholdQuantity: normalizeQuantity(candidate.product.minimumStockLevel),
        currentQuantity,
        expiryDate: null,
        message: this.buildAlertMessage(candidate, "low_stock", currentQuantity)
      });
    }

    if (compareDecimals(currentQuantity, "0", 3) <= 0) {
      alerts.push({
        alertType: "out_of_stock",
        severity: this.getAlertSeverity("out_of_stock"),
        thresholdQuantity: "0.000",
        currentQuantity,
        expiryDate: null,
        message: this.buildAlertMessage(candidate, "out_of_stock", currentQuantity)
      });
    }

    if (compareDecimals(currentQuantity, candidate.product.reorderLevel, 3) <= 0) {
      alerts.push({
        alertType: "reorder_needed",
        severity: this.getAlertSeverity("reorder_needed"),
        thresholdQuantity: normalizeQuantity(candidate.product.reorderLevel),
        currentQuantity,
        expiryDate: null,
        message: this.buildAlertMessage(candidate, "reorder_needed", currentQuantity)
      });
    }

    if (
      compareDecimals(candidate.product.maximumStockLevel, "0", 3) > 0 &&
      compareDecimals(currentQuantity, candidate.product.maximumStockLevel, 3) > 0
    ) {
      alerts.push({
        alertType: "overstock",
        severity: this.getAlertSeverity("overstock"),
        thresholdQuantity: normalizeQuantity(candidate.product.maximumStockLevel),
        currentQuantity,
        expiryDate: null,
        message: this.buildAlertMessage(candidate, "overstock", currentQuantity)
      });
    }

    if (candidate.batch?.expiryDate && compareDecimals(currentQuantity, "0", 3) > 0) {
      const expiryDate = candidate.batch.expiryDate;
      const expiryDateOnly = toDateOnly(expiryDate);
      const today = this.getTodayDateOnly();

      if (expiryDateOnly < today) {
        alerts.push({
          alertType: "expired",
          severity: this.getAlertSeverity("expired"),
          thresholdQuantity: null,
          currentQuantity,
          expiryDate: expiryDateOnly,
          message: this.buildAlertMessage(candidate, "expired", currentQuantity)
        });
      } else if (expiryDateOnly <= this.getFutureDateOnly(env.INVENTORY_EXPIRY_ALERT_DAYS)) {
        alerts.push({
          alertType: "expiring_soon",
          severity: this.getAlertSeverity("expiring_soon"),
          thresholdQuantity: null,
          currentQuantity,
          expiryDate: expiryDateOnly,
          message: this.buildAlertMessage(candidate, "expiring_soon", currentQuantity)
        });
      }
    }

    return alerts;
  }

  private async syncAlertsForCandidates(
    actor: InventoryActor,
    candidates: AlertCandidate[],
    context: InventoryRequestContext,
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    let createdCount = 0;
    let resolvedCount = 0;

    for (const candidate of candidates) {
      const applicable = this.evaluateCandidateAlerts(candidate);
      const applicableTypes = new Set(applicable.map((entry) => entry.alertType));

      for (const type of ALL_ALERT_TYPES) {
        if (!applicableTypes.has(type)) {
          await inventoryRepository.resolveOpenAlert(
            actor.companyId,
            candidate.product.id,
            candidate.warehouse.id,
            candidate.batch?.id ?? null,
            type,
            executor
          );
          resolvedCount += 1;
        }
      }

      for (const entry of applicable) {
        const existing = await inventoryRepository.findOpenAlert(
          actor.companyId,
          candidate.product.id,
          candidate.warehouse.id,
          candidate.batch?.id ?? null,
          entry.alertType,
          executor
        );

        if (existing) {
          continue;
        }

        const created = await inventoryRepository.createAlert(
          {
            companyId: actor.companyId,
            productId: candidate.product.id,
            warehouseId: candidate.warehouse.id,
            batchId: candidate.batch?.id ?? null,
            alertType: entry.alertType,
            severity: entry.severity,
            message: entry.message,
            thresholdQuantity: entry.thresholdQuantity,
            currentQuantity: entry.currentQuantity,
            expiryDate: entry.expiryDate,
            isRead: false
          },
          executor
        );

        if (created) {
          createdCount += 1;
          await auditLogService.log({
            companyId: actor.companyId,
            userId: actor.id,
            action:
              entry.alertType === "expired" || entry.alertType === "expiring_soon"
                ? "expiry_alert_generated"
                : "low_stock_alert_generated",
            entityType: "inventory_alert",
            entityId: created.id,
            metadata: {
              alertType: entry.alertType,
              productId: candidate.product.id,
              warehouseId: candidate.warehouse.id,
              batchId: candidate.batch?.id ?? null
            },
            ipAddress: context.ipAddress,
            userAgent: context.userAgent
          });
        }
      }
    }

    return { createdCount, resolvedCount };
  }

  public async listWarehouses(actor: Pick<InventoryActor, "companyId">, query: ListWarehousesQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await inventoryRepository.listWarehouses({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      ...pickDefined({
        search: query.search,
        status: query.status
      })
    });

    return {
      items: result.rows.map((row) => this.mapWarehouse(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createWarehouse(actor: InventoryActor, input: CreateWarehouseInput, context: InventoryRequestContext) {
    const normalizedCode = input.warehouseCode?.trim().toUpperCase() ?? null;
    let createdWarehouse: WarehouseRecord | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        createdWarehouse = await db.transaction(async (transaction) => {
          const warehouseCode =
            normalizedCode ??
            this.buildNextWarehouseCode(await inventoryRepository.findLatestWarehouseCode(actor.companyId, transaction));

          const duplicate = await inventoryRepository.findWarehouseByCode(actor.companyId, warehouseCode, undefined, transaction);
          if (duplicate) {
            throw new AppError("A warehouse with this code already exists", 409);
          }

          if (input.isDefault) {
            await inventoryRepository.unsetDefaultWarehouses(actor.companyId, undefined, transaction);
          }

          const created = await inventoryRepository.createWarehouse(
            {
              companyId: actor.companyId,
              warehouseCode,
              name: input.name,
              addressLine1: input.addressLine1 ?? null,
              addressLine2: input.addressLine2 ?? null,
              city: input.city ?? null,
              state: input.state ?? null,
              pincode: input.pincode ?? null,
              contactPerson: input.contactPerson ?? null,
              mobile: input.mobile ?? null,
              isDefault: input.isDefault,
              status: input.status,
              createdBy: actor.id,
              updatedBy: actor.id
            },
            transaction
          );

          if (!created) {
            throw new AppError("Failed to create warehouse", 500);
          }

          return created;
        });
        break;
      } catch (error) {
        const databaseError = error as { code?: string; constraint?: string };
        if (
          attempt < 2 &&
          databaseError.code === "23505" &&
          databaseError.constraint === "warehouses_company_warehouse_code_unique_idx"
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!createdWarehouse) {
      throw new AppError("Failed to create warehouse", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "warehouse_created",
      entityType: "warehouse",
      entityId: createdWarehouse.id,
      metadata: {
        warehouseCode: createdWarehouse.warehouseCode,
        isDefault: createdWarehouse.isDefault
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      warehouse: this.mapWarehouse(createdWarehouse)
    };
  }

  public async updateWarehouse(
    actor: InventoryActor,
    warehouseId: string,
    input: UpdateWarehouseInput,
    context: InventoryRequestContext
  ) {
    const existing = await this.getWarehouseOrThrow(actor.companyId, warehouseId, true);
    if (existing.deletedAt || existing.status === "deleted") {
      throw new AppError("Deleted warehouses cannot be updated", 400);
    }

    const warehouseCode = input.warehouseCode?.trim().toUpperCase() ?? existing.warehouseCode;
    if (warehouseCode !== existing.warehouseCode) {
      const duplicate = await inventoryRepository.findWarehouseByCode(actor.companyId, warehouseCode, existing.id);
      if (duplicate) {
        throw new AppError("A warehouse with this code already exists", 409);
      }
    }

    const shouldBeDefault = input.isDefault ?? existing.isDefault;
    const nextStatus = input.status ?? existing.status;
    const nextIsDefault = nextStatus === "active" ? shouldBeDefault : false;

    const updated = await db.transaction(async (transaction) => {
      if (nextIsDefault) {
        await inventoryRepository.unsetDefaultWarehouses(actor.companyId, existing.id, transaction);
      }

      return inventoryRepository.updateWarehouse(
        actor.companyId,
        warehouseId,
        {
          warehouseCode,
          name: input.name ?? existing.name,
          addressLine1: input.addressLine1 === undefined ? existing.addressLine1 : input.addressLine1,
          addressLine2: input.addressLine2 === undefined ? existing.addressLine2 : input.addressLine2,
          city: input.city === undefined ? existing.city : input.city,
          state: input.state === undefined ? existing.state : input.state,
          pincode: input.pincode === undefined ? existing.pincode : input.pincode,
          contactPerson: input.contactPerson === undefined ? existing.contactPerson : input.contactPerson,
          mobile: input.mobile === undefined ? existing.mobile : input.mobile,
          isDefault: nextIsDefault,
          status: nextStatus,
          updatedBy: actor.id
        },
        transaction
      );
    });

    if (!updated) {
      throw new AppError("Failed to update warehouse", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "warehouse_updated",
      entityType: "warehouse",
      entityId: updated.id,
      metadata: {
        fields: Object.keys(input)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      warehouse: this.mapWarehouse(updated)
    };
  }

  public async deleteWarehouse(actor: InventoryActor, warehouseId: string, context: InventoryRequestContext) {
    const existing = await this.getWarehouseOrThrow(actor.companyId, warehouseId, true);
    if (existing.deletedAt || existing.status === "deleted") {
      throw new AppError("Warehouse is already deleted", 400);
    }

    if (await inventoryRepository.hasWarehouseStock(actor.companyId, warehouseId)) {
      throw new AppError("Warehouse cannot be deleted while stock exists", 409);
    }

    const deleted = await inventoryRepository.softDeleteWarehouse(actor.companyId, warehouseId, actor.id);
    if (!deleted) {
      throw new AppError("Failed to delete warehouse", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "warehouse_deleted",
      entityType: "warehouse",
      entityId: deleted.id,
      metadata: {
        warehouseCode: deleted.warehouseCode
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async setDefaultWarehouse(actor: InventoryActor, warehouseId: string, context: InventoryRequestContext) {
    const warehouse = await this.getWarehouseOrThrow(actor.companyId, warehouseId);
    this.assertActiveWarehouse(warehouse);

    const updated = await db.transaction(async (transaction) => {
      await inventoryRepository.unsetDefaultWarehouses(actor.companyId, warehouse.id, transaction);
      return inventoryRepository.updateWarehouse(
        actor.companyId,
        warehouse.id,
        {
          isDefault: true,
          updatedBy: actor.id
        },
        transaction
      );
    });

    if (!updated) {
      throw new AppError("Failed to set default warehouse", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "warehouse_default_changed",
      entityType: "warehouse",
      entityId: updated.id,
      metadata: {
        warehouseCode: updated.warehouseCode
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      warehouse: this.mapWarehouse(updated)
    };
  }

  public async listBatches(actor: Pick<InventoryActor, "companyId">, query: ListBatchesQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await inventoryRepository.listBatches({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      expiryAlertDays: env.INVENTORY_EXPIRY_ALERT_DAYS,
      ...pickDefined({
        productId: query.productId,
        warehouseId: query.warehouseId,
        expired: query.expired,
        expiringSoon: query.expiringSoon,
        status: query.status
      })
    });

    return {
      items: result.rows.map((row) => this.mapBatch(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createBatch(actor: InventoryActor, input: CreateBatchInput, context: InventoryRequestContext) {
    const productRow = await this.getProductOrThrow(actor.companyId, input.productId);
    this.assertGoodsInventoryProduct(productRow);
    const warehouse = await this.getWarehouseOrThrow(actor.companyId, input.warehouseId);
    this.assertActiveWarehouse(warehouse);

    if (productRow.product.expiryTrackingEnabled && !input.expiryDate) {
      throw new AppError("Expiry date is required when expiry tracking is enabled", 400);
    }

    const duplicate = await inventoryRepository.findBatchByNumber(
      actor.companyId,
      input.productId,
      input.warehouseId,
      input.batchNumber
    );
    if (duplicate) {
      throw new AppError("A batch with this number already exists for the selected product and warehouse", 409);
    }

    const created = await inventoryRepository.createBatch({
      companyId: actor.companyId,
      productId: input.productId,
      warehouseId: input.warehouseId,
      batchNumber: input.batchNumber,
      manufacturingDate: input.manufacturingDate ? toDateOnly(input.manufacturingDate) : null,
      expiryDate: input.expiryDate ? toDateOnly(input.expiryDate) : null,
      purchaseRate: normalizeMoney(input.purchaseRate),
      saleRate: normalizeMoney(input.saleRate),
      status: this.normalizeBatchStatus(input.expiryDate, input.status),
      createdBy: actor.id,
      updatedBy: actor.id
    });

    if (!created) {
      throw new AppError("Failed to create batch", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "batch_created",
      entityType: "product_batch",
      entityId: created.id,
      metadata: {
        batchNumber: created.batchNumber,
        productId: created.productId,
        warehouseId: created.warehouseId
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    const row = await this.getBatchOrThrow(actor.companyId, created.id);
    return {
      batch: this.mapBatch(row)
    };
  }

  public async updateBatch(actor: InventoryActor, batchId: string, input: UpdateBatchInput, context: InventoryRequestContext) {
    const existingRow = await this.getBatchOrThrow(actor.companyId, batchId, true);
    const existing = existingRow.batch;
    if (existing.deletedAt || existing.status === "deleted") {
      throw new AppError("Deleted batches cannot be updated", 400);
    }

    const productRow = await this.getProductOrThrow(actor.companyId, input.productId ?? existing.productId);
    this.assertGoodsInventoryProduct(productRow);
    const warehouse = await this.getWarehouseOrThrow(actor.companyId, input.warehouseId ?? existing.warehouseId);
    this.assertActiveWarehouse(warehouse);

    if (productRow.product.expiryTrackingEnabled && input.expiryDate === null) {
      throw new AppError("Expiry date is required when expiry tracking is enabled", 400);
    }

    const movementCount = await inventoryRepository.countBatchMovements(actor.companyId, batchId);
    const unsafeFieldsChanged =
      (input.productId !== undefined && input.productId !== existing.productId) ||
      (input.warehouseId !== undefined && input.warehouseId !== existing.warehouseId) ||
      (input.batchNumber !== undefined && input.batchNumber !== existing.batchNumber) ||
      (input.manufacturingDate !== undefined &&
        toDateOnly(input.manufacturingDate ?? new Date(0)) !==
          (existing.manufacturingDate ? toDateOnly(existing.manufacturingDate) : null));

    if (movementCount > 0 && unsafeFieldsChanged) {
      throw new AppError("Batch product, warehouse, batch number, and manufacturing date cannot be changed after movements exist", 409);
    }

    const nextBatchNumber = input.batchNumber ?? existing.batchNumber;
    if (
      nextBatchNumber !== existing.batchNumber ||
      (input.productId !== undefined && input.productId !== existing.productId) ||
      (input.warehouseId !== undefined && input.warehouseId !== existing.warehouseId)
    ) {
      const duplicate = await inventoryRepository.findBatchByNumber(
        actor.companyId,
        input.productId ?? existing.productId,
        input.warehouseId ?? existing.warehouseId,
        nextBatchNumber,
        existing.id
      );
      if (duplicate) {
        throw new AppError("A batch with this number already exists for the selected product and warehouse", 409);
      }
    }

    const updated = await inventoryRepository.updateBatch(actor.companyId, batchId, {
      productId: input.productId ?? existing.productId,
      warehouseId: input.warehouseId ?? existing.warehouseId,
      batchNumber: nextBatchNumber,
      manufacturingDate:
        input.manufacturingDate === undefined
          ? existing.manufacturingDate ? toDateOnly(existing.manufacturingDate) : null
          : input.manufacturingDate ? toDateOnly(input.manufacturingDate) : null,
      expiryDate:
        input.expiryDate === undefined
          ? existing.expiryDate ? toDateOnly(existing.expiryDate) : null
          : input.expiryDate ? toDateOnly(input.expiryDate) : null,
      purchaseRate:
        input.purchaseRate === undefined ? normalizeMoney(existing.purchaseRate) : normalizeMoney(input.purchaseRate),
      saleRate: input.saleRate === undefined ? normalizeMoney(existing.saleRate) : normalizeMoney(input.saleRate),
      status: this.normalizeBatchStatus(
        input.expiryDate === undefined ? existing.expiryDate : input.expiryDate,
        input.status ?? existing.status
      ),
      updatedBy: actor.id
    });

    if (!updated) {
      throw new AppError("Failed to update batch", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "batch_updated",
      entityType: "product_batch",
      entityId: updated.id,
      metadata: {
        fields: Object.keys(input)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    const row = await this.getBatchOrThrow(actor.companyId, updated.id);
    return {
      batch: this.mapBatch(row)
    };
  }

  public async addOpeningStock(actor: InventoryActor, input: AddOpeningStockInput, context: InventoryRequestContext) {
    const productRow = await this.getProductOrThrow(actor.companyId, input.productId);
    this.assertGoodsInventoryProduct(productRow);
    const warehouse = await this.getWarehouseOrThrow(actor.companyId, input.warehouseId);
    this.assertActiveWarehouse(warehouse);

    const quantity = normalizeQuantity(input.quantity);
    const rate = normalizeMoney(input.rate);
    this.assertDecimalQuantityAllowed(quantity, Boolean(productRow.unitDecimalAllowed));

    const movementDate = input.movementDate ?? new Date();
    this.assertNotFutureDate(movementDate, "Movement date");

    const opening = await db.transaction(async (transaction) => {
      const batch = await this.resolveBatchForMutation(
        {
          companyId: actor.companyId,
          actorId: actor.id,
          product: productRow.product,
          warehouse,
          batchId: input.batchId ?? null,
          batchNumber: input.batchNumber ?? null,
          manufacturingDate: input.manufacturingDate ?? null,
          expiryDate: input.expiryDate ?? null,
          purchaseRate: input.purchaseRate ?? null,
          saleRate: input.saleRate ?? null
        },
        transaction
      );

      if (
        await inventoryRepository.hasOpeningStockMovement(
          actor.companyId,
          productRow.product.id,
          warehouse.id,
          batch?.id ?? null,
          transaction
        )
      ) {
        throw new AppError("Opening stock already exists for this product, warehouse, and batch", 409);
      }

      const result = await this.applyStockMutation(
        actor,
        {
          product: productRow.product,
          warehouse,
          batch,
          movementType: "opening_stock",
          movementDate,
          inQuantity: quantity,
          outQuantity: "0.000",
          rate,
          remarks: input.remarks ?? null,
          referenceType: "opening_stock",
          referenceId: null,
          referenceNumber: null,
          allowNegativeStock: productRow.product.negativeStockAllowed
        },
        transaction
      );

      await inventoryRepository.updateProductOpeningStock(
        actor.companyId,
        productRow.product.id,
        {
          openingStockQuantity: result.balance.availableQuantity,
          openingStockRate: rate,
          openingStockValue: multiplyQtyRate(result.balance.availableQuantity, rate),
          updatedBy: actor.id
        },
        transaction
      );

      return {
        batch,
        ...result
      };
    });

    const alertSync = await this.recalculateAlerts(
      actor,
      {
        productId: input.productId,
        warehouseId: input.warehouseId,
        batchId: opening.batch?.id
      },
      context
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "opening_stock_added",
      entityType: "stock_movement",
      entityId: opening.movement.id,
      metadata: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        batchId: opening.batch?.id ?? null,
        quantity,
        rate
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "stock_movement_created",
      entityType: "stock_movement",
      entityId: opening.movement.id,
      metadata: {
        movementType: opening.movement.movementType
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      movement: this.mapMovementRow({
        movement: opening.movement,
        productName: productRow.product.name,
        productCode: productRow.product.productCode,
        warehouseName: warehouse.name,
        warehouseCode: warehouse.warehouseCode,
        batchNumber: opening.batch?.batchNumber ?? null
      }),
      balance: {
        availableQuantity: normalizeQuantity(opening.balance.availableQuantity),
        averageCost: normalizeMoney(opening.balance.averageCost),
        stockValue: normalizeMoney(opening.balance.stockValue)
      },
      alerts: alertSync
    };
  }

  public async createAdjustment(actor: InventoryActor, input: CreateAdjustmentInput, context: InventoryRequestContext) {
    const productRow = await this.getProductOrThrow(actor.companyId, input.productId);
    this.assertGoodsInventoryProduct(productRow);
    const warehouse = await this.getWarehouseOrThrow(actor.companyId, input.warehouseId);
    this.assertActiveWarehouse(warehouse);

    const quantity = normalizeQuantity(input.quantity);
    this.assertDecimalQuantityAllowed(quantity, Boolean(productRow.unitDecimalAllowed));

    const adjustmentDate = input.adjustmentDate ?? new Date();
    this.assertNotFutureDate(adjustmentDate, "Adjustment date");

    const isIncreaseType = ["increase", "found", "opening_correction", "manual_correction"].includes(input.adjustmentType);
    const batch = await db.transaction(async (transaction) => {
      return this.resolveBatchForMutation(
        {
          companyId: actor.companyId,
          actorId: actor.id,
          product: productRow.product,
          warehouse,
          batchId: input.batchId ?? null,
          batchNumber: input.batchNumber ?? null,
          manufacturingDate: input.manufacturingDate ?? null,
          expiryDate: input.expiryDate ?? null,
          purchaseRate: input.purchaseRate ?? null,
          saleRate: input.saleRate ?? null
        },
        transaction
      );
    });

    if (input.adjustmentType === "expired_writeoff") {
      if (!batch?.expiryDate) {
        throw new AppError("Expired write-off requires a batch with an expiry date", 400);
      }

      if (toDateOnly(batch.expiryDate) >= this.getTodayDateOnly()) {
        throw new AppError("Expired write-off requires an already expired batch", 400);
      }
    }

    const existingBalance = await inventoryRepository.findStockBalance(
      actor.companyId,
      productRow.product.id,
      warehouse.id,
      batch?.id ?? null
    );
    const currentAvailable = existingBalance?.availableQuantity ?? "0.000";
    if (!isIncreaseType && !productRow.product.negativeStockAllowed && compareDecimals(currentAvailable, quantity, 3) < 0) {
      throw new AppError("Adjustment quantity cannot exceed available stock", 409);
    }

    const derivedRate =
      input.rate !== undefined
        ? normalizeMoney(input.rate)
        : existingBalance?.averageCost
          ? normalizeMoney(existingBalance.averageCost)
          : normalizeMoney(productRow.product.purchasePrice);

    const mutation = await db.transaction(async (transaction) => {
      const adjustment = await inventoryRepository.createStockAdjustment(
        {
          companyId: actor.companyId,
          productId: productRow.product.id,
          warehouseId: warehouse.id,
          batchId: batch?.id ?? null,
          adjustmentType: input.adjustmentType,
          quantity,
          rate: derivedRate,
          value: multiplyQtyRate(quantity, derivedRate),
          reason: input.reason,
          adjustmentDate,
          status: "completed",
          createdBy: actor.id
        },
        transaction
      );

      if (!adjustment) {
        throw new AppError("Failed to create stock adjustment", 500);
      }

      const movement = await this.applyStockMutation(
        actor,
        {
          product: productRow.product,
          warehouse,
          batch,
          movementType: this.getMovementTypeForAdjustment(input.adjustmentType),
          movementDate: adjustmentDate,
          inQuantity: isIncreaseType ? quantity : "0.000",
          outQuantity: isIncreaseType ? "0.000" : quantity,
          rate: derivedRate,
          remarks: input.remarks ?? input.reason,
          referenceType: "stock_adjustment",
          referenceId: adjustment.id,
          referenceNumber: adjustment.id,
          allowNegativeStock: productRow.product.negativeStockAllowed,
          ...pickDefined({
            damagedIncrement: input.adjustmentType === "damaged" ? quantity : undefined,
            expiredIncrement: input.adjustmentType === "expired_writeoff" ? quantity : undefined
          })
        },
        transaction
      );

      return {
        adjustment,
        ...movement
      };
    });

    const alertSync = await this.recalculateAlerts(
      actor,
      {
        productId: input.productId,
        warehouseId: input.warehouseId,
        batchId: batch?.id
      },
      context
    );

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "stock_adjusted",
      entityType: "stock_adjustment",
      entityId: mutation.adjustment.id,
      metadata: {
        adjustmentType: mutation.adjustment.adjustmentType,
        productId: input.productId,
        warehouseId: input.warehouseId,
        batchId: batch?.id ?? null,
        quantity
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "stock_movement_created",
      entityType: "stock_movement",
      entityId: mutation.movement.id,
      metadata: {
        movementType: mutation.movement.movementType,
        adjustmentId: mutation.adjustment.id
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      adjustment: {
        id: mutation.adjustment.id,
        adjustmentType: mutation.adjustment.adjustmentType,
        quantity: normalizeQuantity(mutation.adjustment.quantity),
        rate: normalizeMoney(mutation.adjustment.rate),
        value: normalizeMoney(mutation.adjustment.value),
        reason: mutation.adjustment.reason,
        adjustmentDate: mutation.adjustment.adjustmentDate,
        status: mutation.adjustment.status
      },
      movement: this.mapMovementRow({
        movement: mutation.movement,
        productName: productRow.product.name,
        productCode: productRow.product.productCode,
        warehouseName: warehouse.name,
        warehouseCode: warehouse.warehouseCode,
        batchNumber: batch?.batchNumber ?? null
      }),
      balance: {
        availableQuantity: normalizeQuantity(mutation.balance.availableQuantity),
        damagedQuantity: normalizeQuantity(mutation.balance.damagedQuantity),
        expiredQuantity: normalizeQuantity(mutation.balance.expiredQuantity),
        averageCost: normalizeMoney(mutation.balance.averageCost),
        stockValue: normalizeMoney(mutation.balance.stockValue)
      },
      alerts: alertSync
    };
  }

  public async receivePurchaseStock(
    actor: InventoryActor,
    input: {
      movementDate: Date;
      referenceType: string;
      referenceId: string;
      referenceNumber: string;
      remarks?: string | null | undefined;
      items: Array<{
        productId: string;
        warehouseId: string | null;
        batchId?: string | null | undefined;
        batchNumber?: string | null | undefined;
        manufacturingDate?: Date | null | undefined;
        expiryDate?: Date | null | undefined;
        quantity: string;
        rate: string;
        movementValue?: string | undefined;
      }>;
    },
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    const touched: Array<{ productId: string; warehouseId: string | null; batchId: string | null }> = [];
    const productCache = new Map<string, NonNullable<ProductContextRow>>();
    const warehouseCache = new Map<string, WarehouseRecord>();

    for (const item of input.items) {
      let productRow = productCache.get(item.productId);
      if (!productRow) {
        productRow = await this.getProductOrThrow(actor.companyId, item.productId, executor);
        productCache.set(item.productId, productRow);
      }

      if (productRow.product.productType !== "goods" || !productRow.product.stockTrackingEnabled) {
        continue;
      }

      this.assertGoodsInventoryProduct(productRow);
      if (!item.warehouseId) {
        throw new AppError("Warehouse is required for goods inventory updates", 400);
      }

      let warehouse = warehouseCache.get(item.warehouseId);
      if (!warehouse) {
        warehouse = await this.getWarehouseOrThrow(actor.companyId, item.warehouseId, false, executor);
        warehouseCache.set(item.warehouseId, warehouse);
      }
      this.assertActiveWarehouse(warehouse);
      this.assertDecimalQuantityAllowed(item.quantity, Boolean(productRow.unitDecimalAllowed));

      const batch = await this.resolveBatchForMutation(
        {
          companyId: actor.companyId,
          actorId: actor.id,
          product: productRow.product,
          warehouse,
          batchId: item.batchId ?? null,
          batchNumber: item.batchNumber ?? null,
          manufacturingDate: item.manufacturingDate ?? null,
          expiryDate: item.expiryDate ?? null,
          purchaseRate: Number(item.rate),
          saleRate: Number(productRow.product.salePrice)
        },
        executor
      );

      await this.applyStockMutation(
        actor,
        {
          product: productRow.product,
          warehouse,
          batch,
          movementType: "purchase",
          movementDate: input.movementDate,
          inQuantity: normalizeQuantity(item.quantity),
          outQuantity: "0.000",
          rate: normalizeMoney(item.rate),
          remarks: input.remarks ?? null,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          referenceNumber: input.referenceNumber,
          movementValue: item.movementValue,
          allowNegativeStock: false
        },
        executor
      );

      touched.push({
        productId: productRow.product.id,
        warehouseId: warehouse.id,
        batchId: batch?.id ?? null
      });
    }

    return touched;
  }

  public async reducePurchaseStock(
    actor: InventoryActor,
    input: {
      movementDate: Date;
      referenceType: string;
      referenceId: string;
      referenceNumber: string;
      remarks?: string | null | undefined;
      items: Array<{
        productId: string;
        warehouseId: string | null;
        batchId?: string | null | undefined;
        quantity: string;
        rate: string;
        movementValue?: string | undefined;
      }>;
    },
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    const touched: Array<{ productId: string; warehouseId: string | null; batchId: string | null }> = [];

    for (const item of input.items) {
      const productRow = await this.getProductOrThrow(actor.companyId, item.productId);

      if (productRow.product.productType !== "goods" || !productRow.product.stockTrackingEnabled) {
        continue;
      }

      this.assertGoodsInventoryProduct(productRow);
      if (!item.warehouseId) {
        throw new AppError("Warehouse is required for goods inventory updates", 400);
      }

      const warehouse = await this.getWarehouseOrThrow(actor.companyId, item.warehouseId);
      this.assertActiveWarehouse(warehouse);
      this.assertDecimalQuantityAllowed(item.quantity, Boolean(productRow.unitDecimalAllowed));

      const batch = item.batchId ? (await this.getBatchOrThrow(actor.companyId, item.batchId)).batch : null;

      if (batch && (batch.productId !== productRow.product.id || batch.warehouseId !== warehouse.id)) {
        throw new AppError("Batch does not belong to the selected product and warehouse", 400);
      }

      await this.applyStockMutation(
        actor,
        {
          product: productRow.product,
          warehouse,
          batch,
          movementType: "purchase_return",
          movementDate: input.movementDate,
          inQuantity: "0.000",
          outQuantity: normalizeQuantity(item.quantity),
          rate: normalizeMoney(item.rate),
          remarks: input.remarks ?? null,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          referenceNumber: input.referenceNumber,
          movementValue: item.movementValue,
          allowNegativeStock: productRow.product.negativeStockAllowed
        },
        executor
      );

      touched.push({
        productId: productRow.product.id,
        warehouseId: warehouse.id,
        batchId: batch?.id ?? null
      });
    }

    return touched;
  }

  public async reduceSalesStock(
    actor: InventoryActor,
    input: {
      movementDate: Date;
      referenceType: string;
      referenceId: string;
      referenceNumber: string;
      remarks?: string | null | undefined;
      items: Array<{
        productId: string;
        warehouseId: string | null;
        batchId?: string | null | undefined;
        quantity: string;
        rate: string;
      }>;
    },
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    const touched: Array<{ productId: string; warehouseId: string | null; batchId: string | null }> = [];

    for (const item of input.items) {
      const productRow = await this.getProductOrThrow(actor.companyId, item.productId);

      if (productRow.product.productType !== "goods" || !productRow.product.stockTrackingEnabled) {
        continue;
      }

      this.assertGoodsInventoryProduct(productRow);
      if (!item.warehouseId) {
        throw new AppError("Warehouse is required for goods inventory updates", 400);
      }

      const warehouse = await this.getWarehouseOrThrow(actor.companyId, item.warehouseId);
      this.assertActiveWarehouse(warehouse);
      this.assertDecimalQuantityAllowed(item.quantity, Boolean(productRow.unitDecimalAllowed));

      const batch = item.batchId ? (await this.getBatchOrThrow(actor.companyId, item.batchId)).batch : null;

      if (batch && (batch.productId !== productRow.product.id || batch.warehouseId !== warehouse.id)) {
        throw new AppError("Batch does not belong to the selected product and warehouse", 400);
      }

      await this.applyStockMutation(
        actor,
        {
          product: productRow.product,
          warehouse,
          batch,
          movementType: "sale",
          movementDate: input.movementDate,
          inQuantity: "0.000",
          outQuantity: normalizeQuantity(item.quantity),
          rate: normalizeMoney(item.rate),
          remarks: input.remarks ?? null,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          referenceNumber: input.referenceNumber,
          allowNegativeStock: productRow.product.negativeStockAllowed
        },
        executor
      );

      touched.push({
        productId: productRow.product.id,
        warehouseId: warehouse.id,
        batchId: batch?.id ?? null
      });
    }

    return touched;
  }

  public async increaseSalesReturnStock(
    actor: InventoryActor,
    input: {
      movementDate: Date;
      referenceType: string;
      referenceId: string;
      referenceNumber: string;
      remarks?: string | null | undefined;
      items: Array<{
        productId: string;
        warehouseId: string | null;
        batchId?: string | null | undefined;
        quantity: string;
        rate: string;
      }>;
    },
    executor: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    const touched: Array<{ productId: string; warehouseId: string | null; batchId: string | null }> = [];

    for (const item of input.items) {
      const productRow = await this.getProductOrThrow(actor.companyId, item.productId);

      if (productRow.product.productType !== "goods" || !productRow.product.stockTrackingEnabled) {
        continue;
      }

      this.assertGoodsInventoryProduct(productRow);
      if (!item.warehouseId) {
        throw new AppError("Warehouse is required for goods inventory updates", 400);
      }

      const warehouse = await this.getWarehouseOrThrow(actor.companyId, item.warehouseId);
      this.assertActiveWarehouse(warehouse);
      this.assertDecimalQuantityAllowed(item.quantity, Boolean(productRow.unitDecimalAllowed));

      const batch = item.batchId ? (await this.getBatchOrThrow(actor.companyId, item.batchId)).batch : null;

      if (batch && (batch.productId !== productRow.product.id || batch.warehouseId !== warehouse.id)) {
        throw new AppError("Batch does not belong to the selected product and warehouse", 400);
      }

      await this.applyStockMutation(
        actor,
        {
          product: productRow.product,
          warehouse,
          batch,
          movementType: "sales_return",
          movementDate: input.movementDate,
          inQuantity: normalizeQuantity(item.quantity),
          outQuantity: "0.000",
          rate: normalizeMoney(item.rate),
          remarks: input.remarks ?? null,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          referenceNumber: input.referenceNumber,
          allowNegativeStock: false
        },
        executor
      );

      touched.push({
        productId: productRow.product.id,
        warehouseId: warehouse.id,
        batchId: batch?.id ?? null
      });
    }

    return touched;
  }

  public async listAdjustments(actor: Pick<InventoryActor, "companyId">, query: ListAdjustmentsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await inventoryRepository.listAdjustments({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      ...pickDefined({
        productId: query.productId,
        warehouseId: query.warehouseId,
        adjustmentType: query.adjustmentType
      })
    });

    return {
      items: result.rows.map((row) => this.mapAdjustmentRow(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async listMovements(actor: Pick<InventoryActor, "companyId">, query: ListMovementsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await inventoryRepository.listMovements({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      referenceType: query.referenceType ?? null,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      ...pickDefined({
        productId: query.productId,
        warehouseId: query.warehouseId,
        batchId: query.batchId,
        movementType: query.movementType
      })
    });

    return {
      items: result.rows.map((row) => this.mapMovementRow(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async exportMovements(actor: InventoryActor, query: ExportMovementsQuery, context: InventoryRequestContext): Promise<InventoryExportPayload> {
    const rows = await inventoryRepository.listMovementsForExport({
      companyId: actor.companyId,
      referenceType: query.referenceType ?? null,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      ...pickDefined({
        productId: query.productId,
        warehouseId: query.warehouseId,
        batchId: query.batchId,
        movementType: query.movementType
      })
    });

    let totalInQuantity = "0.000";
    let totalOutQuantity = "0.000";
    let totalValue = "0.00";

    for (const row of rows) {
      totalInQuantity = addDecimals(totalInQuantity, row.movement.inQuantity, 3);
      totalOutQuantity = addDecimals(totalOutQuantity, row.movement.outQuantity, 3);
      totalValue = addDecimals(totalValue, row.movement.value, 2);
    }

    const dataset: ReportExportDataset = {
      title: "Inventory Movements",
      subtitle: "Stock movement register",
      metadata: [
        { label: "Date From", value: formatReportDateLabel(query.dateFrom ?? null) },
        { label: "Date To", value: formatReportDateLabel(query.dateTo ?? null) },
        { label: "Reference", value: query.referenceType ?? "All" },
        { label: "Movement Type", value: query.movementType ?? "All" }
      ],
      summary: [
        { label: "Total Records", value: rows.length },
        { label: "Total In Qty", value: normalizeQuantity(totalInQuantity) },
        { label: "Total Out Qty", value: normalizeQuantity(totalOutQuantity) },
        { label: "Total Value", value: normalizeMoney(totalValue) }
      ],
      columns: [
        { key: "movementDate", label: "Date", type: "datetime" },
        { key: "movementType", label: "Type" },
        { key: "product", label: "Product" },
        { key: "warehouse", label: "Warehouse" },
        { key: "batchNumber", label: "Batch" },
        { key: "reference", label: "Reference" },
        { key: "inQuantity", label: "In", type: "number" },
        { key: "outQuantity", label: "Out", type: "number" },
        { key: "balanceAfter", label: "Balance", type: "number" },
        { key: "rate", label: "Rate", type: "number" },
        { key: "value", label: "Value", type: "number" }
      ],
      rows: rows.map((row) => ({
        movementDate: row.movement.movementDate.toISOString(),
        movementType: row.movement.movementType,
        product: row.productName
          ? row.productCode
            ? `${row.productName} (${row.productCode})`
            : row.productName
          : row.productCode ?? "",
        warehouse: row.warehouseName
          ? row.warehouseCode
            ? `${row.warehouseName} (${row.warehouseCode})`
            : row.warehouseName
          : row.warehouseCode ?? "",
        batchNumber: row.batchNumber ?? "-",
        reference: row.movement.referenceType
          ? row.movement.referenceNumber
            ? `${row.movement.referenceType} (${row.movement.referenceNumber})`
            : row.movement.referenceType
          : row.movement.referenceNumber ?? "",
        inQuantity: normalizeQuantity(row.movement.inQuantity),
        outQuantity: normalizeQuantity(row.movement.outQuantity),
        balanceAfter: normalizeQuantity(row.movement.balanceAfter),
        rate: normalizeMoney(row.movement.rate),
        value: normalizeMoney(row.movement.value)
      }))
    };
    const file = buildReportFile(dataset, query.format, `inventory-movements-${new Date().toISOString().slice(0, 10)}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "inventory_exported",
      entityType: "stock_movement",
      metadata: {
        format: query.format,
        type: "movements",
        rowCount: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }

  public async listStock(actor: Pick<InventoryActor, "companyId">, query: ListStockQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await inventoryRepository.listStock({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      expiryAlertDays: env.INVENTORY_EXPIRY_ALERT_DAYS,
      ...pickDefined({
        search: query.search,
        warehouseId: query.warehouseId,
        categoryId: query.categoryId,
        productId: query.productId,
        lowStock: query.lowStock,
        outOfStock: query.outOfStock,
        expired: query.expired,
        expiringSoon: query.expiringSoon,
        status: query.status
      })
    });

    return {
      items: result.rows.map((row) => this.mapStockRow(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async getProductStock(actor: Pick<InventoryActor, "companyId">, productId: string) {
    const productRow = await this.getProductOrThrow(actor.companyId, productId);
    const rows = await inventoryRepository.getProductStock(actor.companyId, productId);

    return {
      product: {
        id: productRow.product.id,
        productCode: productRow.product.productCode,
        name: productRow.product.name,
        sku: productRow.product.sku,
        barcode: productRow.product.barcode,
        minimumStockLevel: normalizeQuantity(productRow.product.minimumStockLevel),
        reorderLevel: normalizeQuantity(productRow.product.reorderLevel),
        maximumStockLevel: normalizeQuantity(productRow.product.maximumStockLevel),
        negativeStockAllowed: productRow.product.negativeStockAllowed
      },
      items: rows.map((row) => ({
        warehouse: {
          id: row.balance.warehouseId,
          warehouseCode: row.warehouseCode,
          name: row.warehouseName
        },
        batch: row.balance.batchId
          ? {
              id: row.balance.batchId,
              batchNumber: row.batchNumber,
              manufacturingDate: row.manufacturingDate,
              expiryDate: row.expiryDate,
              status: row.batchStatus
            }
          : null,
        availableQuantity: normalizeQuantity(row.balance.availableQuantity),
        reservedQuantity: normalizeQuantity(row.balance.reservedQuantity),
        damagedQuantity: normalizeQuantity(row.balance.damagedQuantity),
        expiredQuantity: normalizeQuantity(row.balance.expiredQuantity),
        averageCost: normalizeMoney(row.balance.averageCost),
        stockValue: normalizeMoney(row.balance.stockValue),
        updatedAt: row.balance.updatedAt
      }))
    };
  }

  public async getStockSummary(actor: Pick<InventoryActor, "companyId">, query: StockSummaryQuery) {
    const rows = await inventoryRepository.listAlertCandidates({
      companyId: actor.companyId,
      ...pickDefined({
        productId: query.productId,
        warehouseId: query.warehouseId
      })
    });

    let totalStockValue = "0.00";
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiringSoonCount = 0;
    let expiredStockCount = 0;

    for (const row of rows) {
      if (query.categoryId && row.product.categoryId !== query.categoryId) {
        continue;
      }

      totalStockValue = addDecimals(totalStockValue, row.balance.stockValue, 2);
      const alertTypes = this.evaluateCandidateAlerts(row).map((entry) => entry.alertType);

      if (alertTypes.includes("low_stock")) {
        lowStockCount += 1;
      }

      if (alertTypes.includes("out_of_stock")) {
        outOfStockCount += 1;
      }

      if (alertTypes.includes("expiring_soon")) {
        expiringSoonCount += 1;
      }

      if (alertTypes.includes("expired")) {
        expiredStockCount += 1;
      }
    }

    return {
      totalStockValue: normalizeMoney(totalStockValue),
      lowStockCount,
      outOfStockCount,
      expiringSoonCount,
      expiredStockCount
    };
  }

  public async exportStock(actor: InventoryActor, query: ExportStockQuery, context: InventoryRequestContext): Promise<InventoryExportPayload> {
    const rows = await inventoryRepository.listStockForExport({
      companyId: actor.companyId,
      expiryAlertDays: env.INVENTORY_EXPIRY_ALERT_DAYS,
      ...pickDefined({
        search: query.search,
        warehouseId: query.warehouseId,
        categoryId: query.categoryId,
        productId: query.productId,
        lowStock: query.lowStock,
        outOfStock: query.outOfStock,
        expired: query.expired,
        expiringSoon: query.expiringSoon,
        status: query.status
      })
    });

    let totalStockValue = "0.00";
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;

    for (const row of rows) {
      totalStockValue = addDecimals(totalStockValue, row.balance.stockValue, 2);

      if (compareDecimals(row.balance.availableQuantity, row.product.minimumStockLevel, 3) <= 0) {
        lowStockCount += 1;
      }

      if (compareDecimals(row.balance.availableQuantity, "0", 3) <= 0) {
        outOfStockCount += 1;
      }

      const expiryDateOnly = row.expiryDate ? toDateOnly(row.expiryDate) : null;
      if (expiryDateOnly && expiryDateOnly < this.getTodayDateOnly() && compareDecimals(row.balance.availableQuantity, "0", 3) > 0) {
        expiredCount += 1;
      }

      if (
        expiryDateOnly &&
        expiryDateOnly >= this.getTodayDateOnly() &&
        expiryDateOnly <= this.getFutureDateOnly(env.INVENTORY_EXPIRY_ALERT_DAYS) &&
        compareDecimals(row.balance.availableQuantity, "0", 3) > 0
      ) {
        expiringSoonCount += 1;
      }
    }

    const dataset: ReportExportDataset = {
      title: "Inventory Stock",
      subtitle: "Current stock snapshot",
      metadata: [
        { label: "Search", value: query.search ?? "All" },
        { label: "Status", value: query.status ?? "All" },
        { label: "Low Stock", value: query.lowStock === undefined ? "All" : query.lowStock ? "Yes" : "No" },
        { label: "Out Of Stock", value: query.outOfStock === undefined ? "All" : query.outOfStock ? "Yes" : "No" }
      ],
      summary: [
        { label: "Total Records", value: rows.length },
        { label: "Stock Value", value: normalizeMoney(totalStockValue) },
        { label: "Low Stock", value: lowStockCount },
        { label: "Out Of Stock", value: outOfStockCount },
        { label: "Expired", value: expiredCount },
        { label: "Expiring Soon", value: expiringSoonCount }
      ],
      columns: [
        { key: "product", label: "Product" },
        { key: "category", label: "Category" },
        { key: "warehouse", label: "Warehouse" },
        { key: "batchNumber", label: "Batch" },
        { key: "expiryDate", label: "Expiry", type: "date" },
        { key: "availableQuantity", label: "Available", type: "number" },
        { key: "reservedQuantity", label: "Reserved", type: "number" },
        { key: "damagedQuantity", label: "Damaged", type: "number" },
        { key: "expiredQuantity", label: "Expired", type: "number" },
        { key: "averageCost", label: "Avg Cost", type: "number" },
        { key: "stockValue", label: "Stock Value", type: "number" }
      ],
      rows: rows.map((row) => ({
        product: `${row.product.name} (${row.product.productCode})`,
        category: row.categoryName ?? "",
        warehouse: row.warehouseName
          ? row.warehouseCode
            ? `${row.warehouseName} (${row.warehouseCode})`
            : row.warehouseName
          : row.warehouseCode ?? "",
        batchNumber: row.batchNumber ?? "-",
        expiryDate: row.expiryDate ? toDateOnly(row.expiryDate) : "",
        availableQuantity: normalizeQuantity(row.balance.availableQuantity),
        reservedQuantity: normalizeQuantity(row.balance.reservedQuantity),
        damagedQuantity: normalizeQuantity(row.balance.damagedQuantity),
        expiredQuantity: normalizeQuantity(row.balance.expiredQuantity),
        averageCost: normalizeMoney(row.balance.averageCost),
        stockValue: normalizeMoney(row.balance.stockValue)
      }))
    };
    const file = buildReportFile(dataset, query.format, `inventory-stock-${new Date().toISOString().slice(0, 10)}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "inventory_exported",
      entityType: "stock_balance",
      metadata: {
        format: query.format,
        type: "stock",
        rowCount: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }

  public async listAlerts(actor: Pick<InventoryActor, "companyId">, query: ListAlertsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await inventoryRepository.listAlerts({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      ...pickDefined({
        alertType: query.type,
        severity: query.severity,
        isRead: query.read
      })
    });

    return {
      items: result.rows.map((row) => this.mapAlertRow(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async markAlertRead(actor: Pick<InventoryActor, "companyId">, alertId: string, input: MarkAlertReadInput) {
    const existing = await inventoryRepository.findAlertById(actor.companyId, alertId);
    if (!existing) {
      throw new AppError("Alert not found", 404);
    }

    const updated = await inventoryRepository.updateAlertReadState(actor.companyId, alertId, input.isRead ?? true);
    if (!updated) {
      throw new AppError("Failed to update alert state", 500);
    }

    return {
      alert: {
        id: updated.id,
        isRead: updated.isRead
      }
    };
  }

  public async recalculateAlerts(actor: InventoryActor, input: RecalculateAlertsInput, context: InventoryRequestContext) {
    const rows = await inventoryRepository.listAlertCandidates({
      companyId: actor.companyId,
      ...pickDefined({
        productId: input.productId,
        warehouseId: input.warehouseId,
        batchId: input.batchId
      })
    });

    const result = await db.transaction(async (transaction) => {
      return this.syncAlertsForCandidates(actor, rows, context, transaction);
    });

    return {
      created: result.createdCount,
      resolved: result.resolvedCount
    };
  }

  public async getValuation(actor: InventoryActor, query: ValuationQuery, context: InventoryRequestContext) {
    const rows = await inventoryRepository.listValuation({
      companyId: actor.companyId,
      ...pickDefined({
        warehouseId: query.warehouseId,
        categoryId: query.categoryId,
        productId: query.productId
      })
    });

    let totalQuantity = "0.000";
    let totalValue = "0.00";
    const items = rows.map((row) => {
      totalQuantity = addDecimals(totalQuantity, row.totalQuantity, 3);
      totalValue = addDecimals(totalValue, row.totalValue, 2);

      const averageCost =
        compareDecimals(row.totalQuantity, "0", 3) > 0
          ? divideMoneyByQuantity(row.totalValue, row.totalQuantity)
          : "0.00";

      return {
        product: {
          id: row.productId,
          productCode: row.productCode,
          name: row.productName,
          sku: row.sku
        },
        category: row.categoryName,
        unit: row.unitSymbol ?? row.unitName,
        quantity: normalizeQuantity(row.totalQuantity),
        stockValue: normalizeMoney(row.totalValue),
        averageCost
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "valuation_viewed",
      entityType: "inventory_valuation",
      metadata: pickDefined({
        warehouseId: query.warehouseId,
        categoryId: query.categoryId,
        productId: query.productId
      }),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      method: query.method,
      items,
      totals: {
        totalQuantity: normalizeQuantity(totalQuantity),
        totalValue: normalizeMoney(totalValue)
      }
    };
  }

  public async exportValuation(
    actor: InventoryActor,
    query: ExportValuationQuery,
    context: InventoryRequestContext
  ): Promise<InventoryExportPayload> {
    const valuation = await this.getValuation(actor, query, context);

    const dataset: ReportExportDataset = {
      title: "Inventory Valuation",
      subtitle: "Inventory value summary",
      metadata: [
        { label: "Method", value: query.method },
        { label: "Warehouse", value: query.warehouseId ? "Selected" : "All" },
        { label: "Category", value: query.categoryId ? "Selected" : "All" },
        { label: "Product", value: query.productId ? "Selected" : "All" }
      ],
      summary: [
        { label: "Total Records", value: valuation.items.length },
        { label: "Total Quantity", value: valuation.totals.totalQuantity },
        { label: "Total Value", value: valuation.totals.totalValue }
      ],
      columns: [
        { key: "productCode", label: "Product Code" },
        { key: "productName", label: "Product Name" },
        { key: "sku", label: "SKU" },
        { key: "category", label: "Category" },
        { key: "unit", label: "Unit" },
        { key: "quantity", label: "Quantity", type: "number" },
        { key: "averageCost", label: "Average Cost", type: "number" },
        { key: "stockValue", label: "Stock Value", type: "number" }
      ],
      rows: valuation.items.map((item) => ({
        productCode: item.product.productCode,
        productName: item.product.name,
        sku: item.product.sku,
        category: item.category ?? "",
        unit: item.unit ?? "",
        quantity: item.quantity,
        averageCost: item.averageCost,
        stockValue: item.stockValue
      }))
    };
    const file = buildReportFile(dataset, query.format, `inventory-valuation-${new Date().toISOString().slice(0, 10)}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "valuation_exported",
      entityType: "inventory_valuation",
      metadata: {
        format: query.format,
        rowCount: valuation.items.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }
}

export const inventoryService = new InventoryService();
