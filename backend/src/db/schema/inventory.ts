import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { products } from "./products";
import { users } from "./users";

export const warehouseStatusEnum = pgEnum("warehouse_status", ["active", "inactive", "deleted"]);
export const productBatchStatusEnum = pgEnum("product_batch_status", ["active", "expired", "blocked", "deleted"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
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
]);
export const stockAdjustmentTypeEnum = pgEnum("stock_adjustment_type", [
  "increase",
  "decrease",
  "damaged",
  "lost",
  "expired_writeoff",
  "found",
  "opening_correction",
  "manual_correction"
]);
export const stockAdjustmentStatusEnum = pgEnum("stock_adjustment_status", ["completed", "cancelled"]);
export const inventoryAlertTypeEnum = pgEnum("inventory_alert_type", [
  "low_stock",
  "out_of_stock",
  "reorder_needed",
  "expired",
  "expiring_soon",
  "overstock"
]);
export const inventoryAlertSeverityEnum = pgEnum("inventory_alert_severity", ["low", "medium", "high", "critical"]);
export const inventoryValuationMethodEnum = pgEnum("inventory_valuation_method", ["weighted_average"]);

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    warehouseCode: text("warehouse_code").notNull(),
    name: text("name").notNull(),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    contactPerson: text("contact_person"),
    mobile: text("mobile"),
    isDefault: boolean("is_default").notNull().default(false),
    status: warehouseStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("warehouses_company_id_idx").on(table.companyId),
    companyStatusIdx: index("warehouses_company_status_idx").on(table.companyId, table.status),
    companyWarehouseCodeUniqueIdx: uniqueIndex("warehouses_company_warehouse_code_unique_idx").on(
      table.companyId,
      table.warehouseCode
    ),
    companyDefaultActiveUniqueIdx: uniqueIndex("warehouses_company_default_active_unique_idx")
      .on(table.companyId)
      .where(sql`${table.isDefault} = true AND ${table.deletedAt} IS NULL AND ${table.status} = 'active'`)
  })
);

export const productBatches = pgTable(
  "product_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    batchNumber: text("batch_number").notNull(),
    manufacturingDate: date("manufacturing_date"),
    expiryDate: date("expiry_date"),
    purchaseRate: numeric("purchase_rate", { precision: 14, scale: 2 }).notNull().default("0"),
    saleRate: numeric("sale_rate", { precision: 14, scale: 2 }).notNull().default("0"),
    status: productBatchStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("product_batches_company_id_idx").on(table.companyId),
    productWarehouseIdx: index("product_batches_company_product_warehouse_idx").on(
      table.companyId,
      table.productId,
      table.warehouseId
    ),
    expiryIdx: index("product_batches_company_expiry_date_idx").on(table.companyId, table.expiryDate),
    companyBatchNumberUniqueIdx: uniqueIndex("product_batches_company_product_warehouse_batch_unique_idx")
      .on(table.companyId, table.productId, table.warehouseId, table.batchNumber)
      .where(sql`${table.deletedAt} IS NULL`),
    purchaseRateCheck: check("product_batches_purchase_rate_check", sql`${table.purchaseRate} >= 0`),
    saleRateCheck: check("product_batches_sale_rate_check", sql`${table.saleRate} >= 0`)
  })
);

export const stockBalances = pgTable(
  "stock_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id").references(() => productBatches.id, { onDelete: "set null" }),
    availableQuantity: numeric("available_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    reservedQuantity: numeric("reserved_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    damagedQuantity: numeric("damaged_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    expiredQuantity: numeric("expired_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    averageCost: numeric("average_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    stockValue: numeric("stock_value", { precision: 14, scale: 2 }).notNull().default("0"),
    lastMovementAt: timestamp("last_movement_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("stock_balances_company_id_idx").on(table.companyId),
    companyProductWarehouseBatchIdx: index("stock_balances_company_product_warehouse_batch_idx").on(
      table.companyId,
      table.productId,
      table.warehouseId,
      table.batchId
    ),
    batchUniqueIdx: uniqueIndex("stock_balances_company_product_warehouse_batch_unique_idx")
      .on(table.companyId, table.productId, table.warehouseId, table.batchId)
      .where(sql`${table.batchId} IS NOT NULL`),
    noBatchUniqueIdx: uniqueIndex("stock_balances_company_product_warehouse_no_batch_unique_idx")
      .on(table.companyId, table.productId, table.warehouseId)
      .where(sql`${table.batchId} IS NULL`),
    reservedQtyCheck: check("stock_balances_reserved_quantity_check", sql`${table.reservedQuantity} >= 0`),
    damagedQtyCheck: check("stock_balances_damaged_quantity_check", sql`${table.damagedQuantity} >= 0`),
    expiredQtyCheck: check("stock_balances_expired_quantity_check", sql`${table.expiredQuantity} >= 0`),
    averageCostCheck: check("stock_balances_average_cost_check", sql`${table.averageCost} >= 0`)
  })
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id").references(() => productBatches.id, { onDelete: "set null" }),
    movementType: stockMovementTypeEnum("movement_type").notNull(),
    referenceType: text("reference_type"),
    referenceId: uuid("reference_id"),
    referenceNumber: text("reference_number"),
    movementDate: timestamp("movement_date", { withTimezone: true }).notNull(),
    inQuantity: numeric("in_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    outQuantity: numeric("out_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    balanceAfter: numeric("balance_after", { precision: 14, scale: 3 }).notNull().default("0"),
    rate: numeric("rate", { precision: 14, scale: 2 }).notNull().default("0"),
    value: numeric("value", { precision: 14, scale: 2 }).notNull().default("0"),
    remarks: text("remarks"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("stock_movements_company_id_idx").on(table.companyId),
    companyProductMovementDateIdx: index("stock_movements_company_product_movement_date_idx").on(
      table.companyId,
      table.productId,
      table.movementDate
    ),
    companyWarehouseMovementDateIdx: index("stock_movements_company_warehouse_movement_date_idx").on(
      table.companyId,
      table.warehouseId,
      table.movementDate
    ),
    companyMovementTypeIdx: index("stock_movements_company_movement_type_idx").on(
      table.companyId,
      table.movementType
    ),
    inQtyCheck: check("stock_movements_in_quantity_check", sql`${table.inQuantity} >= 0`),
    outQtyCheck: check("stock_movements_out_quantity_check", sql`${table.outQuantity} >= 0`),
    rateCheck: check("stock_movements_rate_check", sql`${table.rate} >= 0`),
    valueCheck: check("stock_movements_value_check", sql`${table.value} >= 0`)
  })
);

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id").references(() => productBatches.id, { onDelete: "set null" }),
    adjustmentType: stockAdjustmentTypeEnum("adjustment_type").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    rate: numeric("rate", { precision: 14, scale: 2 }).notNull().default("0"),
    value: numeric("value", { precision: 14, scale: 2 }).notNull().default("0"),
    reason: text("reason").notNull(),
    adjustmentDate: timestamp("adjustment_date", { withTimezone: true }).notNull(),
    status: stockAdjustmentStatusEnum("status").notNull().default("completed"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("stock_adjustments_company_id_idx").on(table.companyId),
    companyProductDateIdx: index("stock_adjustments_company_product_date_idx").on(
      table.companyId,
      table.productId,
      table.adjustmentDate
    ),
    quantityCheck: check("stock_adjustments_quantity_check", sql`${table.quantity} > 0`),
    rateCheck: check("stock_adjustments_rate_check", sql`${table.rate} >= 0`),
    valueCheck: check("stock_adjustments_value_check", sql`${table.value} >= 0`)
  })
);

export const inventoryAlerts = pgTable(
  "inventory_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
    batchId: uuid("batch_id").references(() => productBatches.id, { onDelete: "set null" }),
    alertType: inventoryAlertTypeEnum("alert_type").notNull(),
    severity: inventoryAlertSeverityEnum("severity").notNull(),
    message: text("message").notNull(),
    thresholdQuantity: numeric("threshold_quantity", { precision: 14, scale: 3 }),
    currentQuantity: numeric("current_quantity", { precision: 14, scale: 3 }),
    expiryDate: date("expiry_date"),
    isRead: boolean("is_read").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("inventory_alerts_company_id_idx").on(table.companyId),
    companyAlertReadIdx: index("inventory_alerts_company_alert_type_is_read_idx").on(
      table.companyId,
      table.alertType,
      table.isRead
    )
  })
);

export const inventoryValuationSnapshots = pgTable(
  "inventory_valuation_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    valuationMethod: inventoryValuationMethodEnum("valuation_method").notNull().default("weighted_average"),
    totalQuantity: numeric("total_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    totalValue: numeric("total_value", { precision: 14, scale: 2 }).notNull().default("0"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("inventory_valuation_snapshots_company_id_idx").on(table.companyId),
    companySnapshotDateIdx: index("inventory_valuation_snapshots_company_snapshot_date_idx").on(
      table.companyId,
      table.snapshotDate
    )
  })
);
