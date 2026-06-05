import {
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { productBatches, warehouses } from "./inventory";
import { products } from "./products";
import { users } from "./users";

export const stockCheckStatusEnum = pgEnum("stock_check_status", ["draft", "completed", "approved", "cancelled"]);
export const stockCheckItemStatusEnum = pgEnum("stock_check_item_status", ["matched", "short", "excess"]);

export const stockChecks = pgTable(
  "stock_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    checkNo: text("check_no").notNull(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    status: stockCheckStatusEnum("status").notNull().default("draft"),
    checkDate: date("check_date").notNull(),
    checkedByUserId: uuid("checked_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    remarks: text("remarks"),
    totalItems: integer("total_items").notNull().default(0),
    matchedItems: integer("matched_items").notNull().default(0),
    shortItems: integer("short_items").notNull().default(0),
    excessItems: integer("excess_items").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("stock_checks_company_id_idx").on(table.companyId),
    warehouseIdx: index("stock_checks_warehouse_id_idx").on(table.warehouseId),
    statusIdx: index("stock_checks_status_idx").on(table.status),
    checkDateIdx: index("stock_checks_check_date_idx").on(table.checkDate),
    companyCheckNoUniqueIdx: uniqueIndex("stock_checks_company_check_no_unique_idx").on(table.companyId, table.checkNo)
  })
);

export const stockCheckItems = pgTable(
  "stock_check_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stockCheckId: uuid("stock_check_id")
      .notNull()
      .references(() => stockChecks.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id").references(() => productBatches.id, { onDelete: "restrict" }),
    systemQty: numeric("system_qty", { precision: 14, scale: 3 }).notNull(),
    physicalQty: numeric("physical_qty", { precision: 14, scale: 3 }).notNull(),
    differenceQty: numeric("difference_qty", { precision: 14, scale: 3 }).notNull(),
    status: stockCheckItemStatusEnum("status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    stockCheckIdx: index("stock_check_items_stock_check_id_idx").on(table.stockCheckId),
    productIdx: index("stock_check_items_product_id_idx").on(table.productId),
    batchIdx: index("stock_check_items_batch_id_idx").on(table.batchId)
  })
);
