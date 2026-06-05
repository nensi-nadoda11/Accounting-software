import { db } from "../../db";
import { notificationsRepository } from "../notifications/notifications.repository";
import { auditLogService } from "../audit-logs/audit-log.service";
import { inventoryService } from "../inventory/inventory.service";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import {
  compareDecimals,
  normalizeQuantity,
  subtractDecimals,
  toDateOnly
} from "../inventory/inventory.utils";
import { stockCheckRepository } from "./stockCheck.repository";
import type {
  CreateStockCheckInput,
  ExportStockCheckQuery,
  ListStockChecksQuery,
  UpdateStockCheckInput
} from "./stockCheck.validator";
import type { StockCheckActor, StockCheckItemStatus, StockCheckRequestContext, StockCheckSummaryCounts } from "./stockCheck.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type StockCheckDetailRow = NonNullable<Awaited<ReturnType<typeof stockCheckRepository.getDetail>>>;
type StockCheckListRow = Awaited<ReturnType<typeof stockCheckRepository.list>>["rows"][number];
type PreparedItem = {
  productId: string;
  batchId: string | null;
  systemQty: string;
  physicalQty: string;
  differenceQty: string;
  status: StockCheckItemStatus;
  reason: string | null;
};

const DEFAULT_MAJOR_MISMATCH_THRESHOLD = 10;
const toAuditContext = (context: StockCheckRequestContext) => ({
  ipAddress: context.ipAddress ?? null,
  userAgent: context.userAgent ?? null
});

const toInventoryContext = (context: StockCheckRequestContext) => ({
  ipAddress: context.ipAddress ?? "",
  userAgent: context.userAgent ?? ""
});

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

const formatDateLabel = (value: Date | string | null | undefined) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const normalizeCheckNo = (previous: string | null) => {
  const previousNumber = previous ? Number(previous.replace("SC-", "")) : 0;
  const next = Number.isFinite(previousNumber) ? previousNumber + 1 : 1;
  return `SC-${String(next).padStart(6, "0")}`;
};

const getAbsoluteQuantity = (value: string) => normalizeQuantity(Math.abs(Number(value)));

class StockCheckService {
  private mapListRow(row: StockCheckListRow) {
    return {
      id: row.check.id,
      checkNo: row.check.checkNo,
      warehouse: {
        id: row.check.warehouseId,
        name: row.warehouseName,
        warehouseCode: row.warehouseCode
      },
      status: row.check.status,
      checkDate: row.check.checkDate,
      checkedBy: {
        id: row.check.checkedByUserId,
        name: row.checkedByName
      },
      approvedBy: row.check.approvedByUserId
        ? {
            id: row.check.approvedByUserId,
            name: row.approvedByName
          }
        : null,
      remarks: row.check.remarks,
      summary: {
        totalItems: row.check.totalItems,
        matchedItems: row.check.matchedItems,
        shortItems: row.check.shortItems,
        excessItems: row.check.excessItems
      },
      createdAt: row.check.createdAt,
      updatedAt: row.check.updatedAt
    };
  }

  private mapDetail(row: StockCheckDetailRow) {
    return {
      ...this.mapListRow(row),
      items: row.items.map((entry) => ({
        id: entry.item.id,
        product: {
          id: entry.item.productId,
          name: entry.productName,
          productCode: entry.productCode,
          sku: entry.sku
        },
        batch: entry.item.batchId
          ? {
              id: entry.item.batchId,
              batchNumber: entry.batchNumber,
              expiryDate: entry.expiryDate
            }
          : null,
        systemQty: normalizeQuantity(entry.item.systemQty),
        physicalQty: normalizeQuantity(entry.item.physicalQty),
        differenceQty: normalizeQuantity(entry.item.differenceQty),
        status: entry.item.status,
        reason: entry.item.reason,
        createdAt: entry.item.createdAt
      })),
      approvalHistory: [
        {
          status: "created" as const,
          userId: row.check.checkedByUserId,
          userName: row.checkedByName,
          at: row.check.createdAt
        },
        ...(row.check.status === "completed" || row.check.status === "approved"
          ? [
              {
                status: "completed" as const,
                userId: row.check.checkedByUserId,
                userName: row.checkedByName,
                at: row.check.updatedAt
              }
            ]
          : []),
        ...(row.check.approvedByUserId
          ? [
              {
                status: "approved" as const,
                userId: row.check.approvedByUserId,
                userName: row.approvedByName,
                at: row.check.updatedAt
              }
            ]
          : [])
      ]
    };
  }

  private calculateItemStatus(differenceQty: string): StockCheckItemStatus {
    const comparison = compareDecimals(differenceQty, "0", 3);
    if (comparison === 0) {
      return "matched";
    }

    return comparison < 0 ? "short" : "excess";
  }

  private calculateSummary(items: PreparedItem[]): StockCheckSummaryCounts {
    return items.reduce<StockCheckSummaryCounts>(
      (summary, item) => {
        summary.totalItems += 1;
        if (item.status === "matched") {
          summary.matchedItems += 1;
        } else if (item.status === "short") {
          summary.shortItems += 1;
        } else {
          summary.excessItems += 1;
        }

        return summary;
      },
      {
        totalItems: 0,
        matchedItems: 0,
        shortItems: 0,
        excessItems: 0
      }
    );
  }

  private async assertActiveWarehouse(companyId: string, warehouseId: string, executor?: TransactionClient) {
    const warehouse = await stockCheckRepository.findWarehouseById(companyId, warehouseId, executor);
    if (!warehouse) {
      throw new AppError("Warehouse not found", 404);
    }

    if (warehouse.status !== "active") {
      throw new AppError("Only active warehouses can be used for stock checks", 400);
    }

    return warehouse;
  }

  private async prepareItems(companyId: string, warehouseId: string, items: CreateStockCheckInput["items"], executor?: TransactionClient) {
    const productIds = items.map((item) => item.productId);
    const uniqueProductIds = [...new Set(productIds)];
    const batchIds = items.flatMap((item) => (item.batchId ? [item.batchId] : []));
    const uniqueBatchIds = [...new Set(batchIds)];
    const itemKeys = items.map((item) => `${item.productId}:${item.batchId ?? "no-batch"}`);

    if (new Set(itemKeys).size !== itemKeys.length) {
      throw new AppError("Duplicate product batch rows are not allowed in a stock check", 400);
    }

    const productRows = await stockCheckRepository.listProductsByIds(companyId, uniqueProductIds, executor);
    const productMap = new Map(productRows.map((row) => [row.product.id, row.product]));
    const batchRows = await stockCheckRepository.listBatchesByIds(companyId, uniqueBatchIds, executor);
    const batchMap = new Map(batchRows.map((batch) => [batch.id, batch]));

    for (const item of items) {
      const productId = item.productId;
      const product = productMap.get(productId);
      if (!product) {
        throw new AppError("Product not found", 404);
      }

      if (product.status !== "active" || product.productType !== "goods" || !product.stockTrackingEnabled) {
        throw new AppError("Only active stock-tracked goods can be used for stock checks", 400);
      }

      if (product.batchTrackingEnabled && !item.batchId) {
        throw new AppError("Batch is required for batch-tracked products", 400);
      }

      if (!product.batchTrackingEnabled && item.batchId) {
        throw new AppError("Batch is not allowed for this product", 400);
      }

      if (item.batchId) {
        const batch = batchMap.get(item.batchId);
        if (!batch || batch.productId !== product.id || batch.warehouseId !== warehouseId || batch.status === "deleted") {
          throw new AppError("Batch does not belong to the selected product and warehouse", 400);
        }
      }
    }

    const systemRows = await stockCheckRepository.listSystemQuantities(companyId, warehouseId, uniqueProductIds, executor);
    const systemQtyByProductBatch = new Map(
      systemRows.map((row) => [`${row.productId}:${row.batchId ?? "no-batch"}`, normalizeQuantity(row.systemQty)])
    );

    return items.map<PreparedItem>((item) => {
      const systemQty = systemQtyByProductBatch.get(`${item.productId}:${item.batchId ?? "no-batch"}`) ?? "0.000";
      const physicalQty = normalizeQuantity(item.physicalQty);
      const differenceQty = subtractDecimals(physicalQty, systemQty, 3);

      return {
        productId: item.productId,
        batchId: item.batchId ?? null,
        systemQty,
        physicalQty,
        differenceQty,
        status: this.calculateItemStatus(differenceQty),
        reason: item.reason ?? null
      };
    });
  }

  private async getDetailOrThrow(companyId: string, stockCheckId: string, executor?: TransactionClient) {
    const detail = await stockCheckRepository.getDetail(companyId, stockCheckId, executor);
    if (!detail) {
      throw new AppError("Stock check not found", 404);
    }

    return detail;
  }

  private async getMajorMismatchThreshold(companyId: string) {
    const settings = await stockCheckRepository.getStockCheckSettings(companyId);
    if (!settings || Array.isArray(settings)) {
      return DEFAULT_MAJOR_MISMATCH_THRESHOLD;
    }

    const threshold = settings.majorMismatchThreshold;
    return typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 0
      ? threshold
      : DEFAULT_MAJOR_MISMATCH_THRESHOLD;
  }

  private async createInAppNotifications(
    input: {
      companyId: string;
      actorId: string;
      stockCheckId: string;
      checkNo: string;
      title: string;
      message: string;
      priority: "success" | "warning";
      type: "system" | "warning";
    },
    executor: TransactionClient
  ) {
    const recipients = await notificationsRepository.listCompanyUsersWithPreferences(input.companyId);

    for (const recipient of recipients) {
      if (recipient.preference && !recipient.preference.inAppEnabled) {
        continue;
      }

      const notification = await notificationsRepository.createNotification(
        {
          companyId: input.companyId,
          userId: recipient.user.id,
          title: input.title,
          message: input.message,
          type: input.type,
          priority: input.priority,
          channel: "in_app",
          entityType: "stock_check",
          entityId: input.stockCheckId,
          actionUrl: `/app/inventory/stock-check?id=${input.stockCheckId}`,
          createdBy: input.actorId
        },
        executor
      );

      if (!notification) {
        throw new AppError("Failed to create stock check notification", 500);
      }

      await notificationsRepository.createLog(
        {
          companyId: input.companyId,
          notificationId: notification.id,
          channel: "in_app",
          recipient: recipient.user.id,
          status: "sent",
          metadata: {
            checkNo: input.checkNo
          },
          sentAt: new Date()
        },
        executor
      );
    }
  }

  public async list(actor: Pick<StockCheckActor, "companyId">, query: ListStockChecksQuery) {
    const pagination = getPagination(query.page, query.limit);
    const result = await stockCheckRepository.list({
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      search: query.search ?? null,
      ...pickDefined({
        status: query.status,
        warehouseId: query.warehouseId,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo
      })
    });

    return {
      items: result.rows.map((row) => this.mapListRow(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async getById(actor: Pick<StockCheckActor, "companyId">, stockCheckId: string) {
    return {
      stockCheck: this.mapDetail(await this.getDetailOrThrow(actor.companyId, stockCheckId))
    };
  }

  public async create(actor: StockCheckActor, input: CreateStockCheckInput, context: StockCheckRequestContext) {
    await this.assertActiveWarehouse(actor.companyId, input.warehouseId);
    const preparedItems = await this.prepareItems(actor.companyId, input.warehouseId, input.items);
    const summary = this.calculateSummary(preparedItems);
    const checkDate = input.checkDate ?? new Date();

    const created = await db.transaction(async (transaction) => {
      await stockCheckRepository.acquireScopedLock("stock-check-sequence", actor.companyId, transaction);
      const checkNo = normalizeCheckNo(await stockCheckRepository.findLatestCheckNo(actor.companyId, transaction));
      const check = await stockCheckRepository.createStockCheck(
        {
          companyId: actor.companyId,
          checkNo,
          warehouseId: input.warehouseId,
          status: "draft",
          checkDate: toDateOnly(checkDate),
          checkedByUserId: actor.id,
          remarks: input.remarks ?? null,
          ...summary
        },
        transaction
      );

      if (!check) {
        throw new AppError("Failed to create stock check", 500);
      }

      await stockCheckRepository.insertItems(
        preparedItems.map((item) => ({
          stockCheckId: check.id,
          productId: item.productId,
          batchId: item.batchId,
          systemQty: item.systemQty,
          physicalQty: item.physicalQty,
          differenceQty: item.differenceQty,
          status: item.status,
          reason: item.reason
        })),
        transaction
      );

      return check;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "stock_check_created",
      module: "stock_check",
      entityType: "stock_check",
      entityId: created.id,
      metadata: {
        checkNo: created.checkNo,
        warehouseId: created.warehouseId,
        ...summary
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, created.id);
  }

  public async update(actor: StockCheckActor, stockCheckId: string, input: UpdateStockCheckInput, context: StockCheckRequestContext) {
    const existing = await stockCheckRepository.findById(actor.companyId, stockCheckId);
    if (!existing) {
      throw new AppError("Stock check not found", 404);
    }

    if (existing.status !== "draft") {
      throw new AppError("Only draft stock checks can be edited", 400);
    }

    const warehouseId = input.warehouseId ?? existing.warehouseId;
    if (input.warehouseId) {
      await this.assertActiveWarehouse(actor.companyId, input.warehouseId);
    }

    const preparedItems = input.items ? await this.prepareItems(actor.companyId, warehouseId, input.items) : null;
    const summary = preparedItems ? this.calculateSummary(preparedItems) : null;

    await db.transaction(async (transaction) => {
      const updated = await stockCheckRepository.updateStockCheck(
        actor.companyId,
        stockCheckId,
        {
          warehouseId,
          checkDate: input.checkDate ? toDateOnly(input.checkDate) : existing.checkDate,
          remarks: input.remarks === undefined ? existing.remarks : input.remarks,
          ...(summary ?? {})
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update stock check", 500);
      }

      if (preparedItems) {
        await stockCheckRepository.deleteItems(stockCheckId, transaction);
        await stockCheckRepository.insertItems(
          preparedItems.map((item) => ({
            stockCheckId,
            productId: item.productId,
            batchId: item.batchId,
            systemQty: item.systemQty,
            physicalQty: item.physicalQty,
            differenceQty: item.differenceQty,
            status: item.status,
            reason: item.reason
          })),
          transaction
        );
      }
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "stock_check_updated",
      module: "stock_check",
      entityType: "stock_check",
      entityId: stockCheckId,
      metadata: {
        checkNo: existing.checkNo,
        warehouseId,
        ...(summary ?? {
          totalItems: existing.totalItems,
          matchedItems: existing.matchedItems,
          shortItems: existing.shortItems,
          excessItems: existing.excessItems
        })
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, stockCheckId);
  }

  public async complete(actor: StockCheckActor, stockCheckId: string, context: StockCheckRequestContext) {
    const existing = await stockCheckRepository.findById(actor.companyId, stockCheckId);
    if (!existing) {
      throw new AppError("Stock check not found", 404);
    }

    if (existing.status === "approved") {
      throw new AppError("Approved stock checks cannot be completed again", 400);
    }

    if (existing.totalItems === 0) {
      throw new AppError("Cannot complete empty stock check", 400);
    }

    if (existing.status === "draft") {
      await stockCheckRepository.updateStockCheck(actor.companyId, stockCheckId, { status: "completed" });
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "stock_check_completed",
      module: "stock_check",
      entityType: "stock_check",
      entityId: stockCheckId,
      metadata: {
        checkNo: existing.checkNo
      },
      ...toAuditContext(context)
    });

    return this.getById(actor, stockCheckId);
  }

  public async approve(actor: StockCheckActor, stockCheckId: string, context: StockCheckRequestContext) {
    const threshold = await this.getMajorMismatchThreshold(actor.companyId);

    const result = await db.transaction(async (transaction) => {
      await stockCheckRepository.acquireScopedLock(`stock-check-approval:${stockCheckId}`, actor.companyId, transaction);
      const detail = await this.getDetailOrThrow(actor.companyId, stockCheckId, transaction);

      if (detail.check.status === "approved") {
        throw new AppError("Stock check is already approved", 409);
      }

      if (detail.check.status !== "completed") {
        throw new AppError("Only completed stock checks can be approved", 400);
      }

      if (!detail.items.length) {
        throw new AppError("Cannot approve empty stock check", 400);
      }

      const adjustedItems: Array<{ productId: string; batchId: string | null; differenceQty: string; adjustmentId: string; movementId: string }> = [];
      for (const item of detail.items) {
        const differenceQty = normalizeQuantity(item.item.differenceQty);
        if (compareDecimals(differenceQty, "0", 3) === 0) {
          continue;
        }

        const adjustment = await inventoryService.applyStockCheckAdjustment(
          actor,
          {
            productId: item.item.productId,
            batchId: item.item.batchId,
            warehouseId: detail.check.warehouseId,
            adjustmentType: compareDecimals(differenceQty, "0", 3) > 0 ? "increase" : "decrease",
            quantity: getAbsoluteQuantity(differenceQty),
            reason: item.item.reason ?? `Stock check ${detail.check.checkNo}`,
            adjustmentDate: new Date(),
            remarks: `Stock check ${detail.check.checkNo}`,
            referenceId: detail.check.id,
            referenceNumber: detail.check.checkNo
          },
          transaction
        );

        adjustedItems.push({
          productId: item.item.productId,
          batchId: item.item.batchId,
          differenceQty,
          adjustmentId: adjustment.adjustment.id,
          movementId: adjustment.movement.id
        });
      }

      const approved = await stockCheckRepository.updateStockCheck(
        actor.companyId,
        stockCheckId,
        {
          status: "approved",
          approvedByUserId: actor.id
        },
        transaction
      );

      if (!approved) {
        throw new AppError("Failed to approve stock check", 500);
      }

      await this.createInAppNotifications(
        {
          companyId: actor.companyId,
          actorId: actor.id,
          stockCheckId,
          checkNo: detail.check.checkNo,
          title: `Stock check ${detail.check.checkNo} approved`,
          message: `Stock check ${detail.check.checkNo} has been approved and inventory adjustments were posted.`,
          priority: "success",
          type: "system"
        },
        transaction
      );

      const majorItems = detail.items.filter((item) => Math.abs(Number(item.item.differenceQty)) > threshold);
      if (majorItems.length > 0) {
        await this.createInAppNotifications(
          {
            companyId: actor.companyId,
            actorId: actor.id,
            stockCheckId,
            checkNo: detail.check.checkNo,
            title: `Major mismatch in ${detail.check.checkNo}`,
            message: `${majorItems.length} item(s) exceeded the stock mismatch threshold of ${threshold}.`,
            priority: "warning",
            type: "warning"
          },
          transaction
        );
      }

      return {
        checkNo: detail.check.checkNo,
        adjustedItems
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "stock_check_approved",
      module: "stock_check",
      entityType: "stock_check",
      entityId: stockCheckId,
      metadata: {
        checkNo: result.checkNo,
        adjustedCount: result.adjustedItems.length
      },
      ...toAuditContext(context)
    });

    for (const item of result.adjustedItems) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "inventory_adjusted",
        module: "stock_check",
        entityType: "stock_adjustment",
        entityId: item.adjustmentId,
        metadata: {
          stockCheckId,
          checkNo: result.checkNo,
          productId: item.productId,
          batchId: item.batchId,
          differenceQty: item.differenceQty,
          movementId: item.movementId
        },
        ...toAuditContext(context)
      });
    }

    const approvedDetail = await this.getDetailOrThrow(actor.companyId, stockCheckId);
    const touchedItems = new Map(result.adjustedItems.map((item) => [`${item.productId}:${item.batchId ?? "no-batch"}`, item]));
    for (const item of touchedItems.values()) {
      await inventoryService.recalculateAlerts(
        actor,
        {
          productId: item.productId,
          warehouseId: approvedDetail.check.warehouseId,
          batchId: item.batchId ?? undefined
        },
        toInventoryContext(context)
      );
    }

    return {
      stockCheck: this.mapDetail(approvedDetail),
      adjustedItems: result.adjustedItems.length
    };
  }

  public async exportById(
    actor: StockCheckActor,
    stockCheckId: string,
    query: ExportStockCheckQuery,
    context: StockCheckRequestContext
  ) {
    const detail = this.mapDetail(await this.getDetailOrThrow(actor.companyId, stockCheckId));

    const dataset: ReportExportDataset = {
      title: `Stock Check ${detail.checkNo}`,
      subtitle: "Physical stock verification",
      metadata: [
        { label: "Check No", value: detail.checkNo },
        { label: "Date", value: formatDateLabel(detail.checkDate) },
        { label: "Warehouse", value: detail.warehouse.name ?? detail.warehouse.warehouseCode ?? "-" },
        { label: "Status", value: detail.status }
      ],
      summary: [
        { label: "Total Items", value: detail.summary.totalItems },
        { label: "Matched", value: detail.summary.matchedItems },
        { label: "Short", value: detail.summary.shortItems },
        { label: "Excess", value: detail.summary.excessItems }
      ],
      columns: [
        { key: "product", label: "Product" },
        { key: "batch", label: "Batch" },
        { key: "sku", label: "SKU" },
        { key: "systemQty", label: "System Qty", type: "number" },
        { key: "physicalQty", label: "Physical Qty", type: "number" },
        { key: "differenceQty", label: "Difference", type: "number" },
        { key: "status", label: "Status" },
        { key: "reason", label: "Reason" }
      ],
      rows: detail.items.map((item) => ({
        product: `${item.product.name} (${item.product.productCode})`,
        batch: item.batch?.batchNumber ?? "-",
        sku: item.product.sku ?? "",
        systemQty: item.systemQty,
        physicalQty: item.physicalQty,
        differenceQty: item.differenceQty,
        status: item.status,
        reason: item.reason ?? ""
      }))
    };

    const file = buildReportFile(dataset, query.format, `stock-check-${detail.checkNo.toLowerCase()}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "stock_check_exported",
      module: "stock_check",
      entityType: "stock_check",
      entityId: stockCheckId,
      metadata: {
        checkNo: detail.checkNo,
        format: query.format
      },
      ...toAuditContext(context)
    });

    return file;
  }
}

export const stockCheckService = new StockCheckService();
