import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { users } from "./users";

export const productCategoryStatusEnum = pgEnum("product_category_status", ["active", "inactive", "deleted"]);
export const productUnitStatusEnum = pgEnum("product_unit_status", ["active", "inactive", "deleted"]);
export const productTypeEnum = pgEnum("product_type", ["goods", "service"]);
export const productTaxTypeEnum = pgEnum("product_tax_type", ["taxable", "exempt", "nil_rated", "non_gst"]);
export const productPriceTaxTypeEnum = pgEnum("product_price_tax_type", ["inclusive", "exclusive"]);
export const productStatusEnum = pgEnum("product_status", ["active", "inactive", "deleted"]);
export const productPriceHistoryChangeTypeEnum = pgEnum("product_price_history_change_type", [
  "purchase_price",
  "sale_price",
  "mrp",
  "wholesale_price",
  "minimum_sale_price",
  "gst_rate",
  "discount",
  "pricing"
]);

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    categoryCode: text("category_code").notNull(),
    name: text("name").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => productCategories.id, { onDelete: "set null" }),
    description: text("description"),
    status: productCategoryStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("product_categories_company_id_idx").on(table.companyId),
    companyNameIdx: index("product_categories_company_name_idx").on(table.companyId, table.name),
    companyStatusIdx: index("product_categories_company_status_idx").on(table.companyId, table.status),
    companyCategoryCodeUniqueIdx: uniqueIndex("product_categories_company_category_code_unique_idx").on(
      table.companyId,
      table.categoryCode
    ),
    companyNameUniqueIdx: uniqueIndex("product_categories_company_name_unique_idx")
      .on(table.companyId, table.name)
      .where(sql`${table.deletedAt} is null`)
  })
);

export const productUnits = pgTable(
  "product_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    decimalAllowed: boolean("decimal_allowed").notNull().default(false),
    baseUnitId: uuid("base_unit_id").references((): AnyPgColumn => productUnits.id, { onDelete: "set null" }),
    conversionRate: numeric("conversion_rate", { precision: 14, scale: 4 }),
    status: productUnitStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("product_units_company_id_idx").on(table.companyId),
    companyNameIdx: index("product_units_company_name_idx").on(table.companyId, table.name),
    companyStatusIdx: index("product_units_company_status_idx").on(table.companyId, table.status),
    companyBaseUnitIdx: index("product_units_company_base_unit_idx").on(table.companyId, table.baseUnitId),
    companySymbolUniqueIdx: uniqueIndex("product_units_company_symbol_unique_idx")
      .on(table.companyId, table.symbol)
      .where(sql`${table.deletedAt} is null`),
    conversionRateCheck: check(
      "product_units_conversion_rate_check",
      sql`(${table.baseUnitId} is null and ${table.conversionRate} is null) or (${table.baseUnitId} is not null and ${table.conversionRate} > 0)`
    )
  })
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    productCode: text("product_code").notNull(),
    productType: productTypeEnum("product_type").notNull(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategories.id, { onDelete: "restrict" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => productUnits.id, { onDelete: "restrict" }),
    brand: text("brand"),
    description: text("description"),
    hsnSacCode: text("hsn_sac_code"),
    taxType: productTaxTypeEnum("tax_type").notNull().default("taxable"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    cessRate: numeric("cess_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    priceTaxType: productPriceTaxTypeEnum("price_tax_type").notNull().default("exclusive"),
    purchasePrice: numeric("purchase_price", { precision: 14, scale: 2 }).notNull().default("0"),
    salePrice: numeric("sale_price", { precision: 14, scale: 2 }).notNull().default("0"),
    mrp: numeric("mrp", { precision: 14, scale: 2 }).notNull().default("0"),
    wholesalePrice: numeric("wholesale_price", { precision: 14, scale: 2 }).notNull().default("0"),
    minimumSalePrice: numeric("minimum_sale_price", { precision: 14, scale: 2 }).notNull().default("0"),
    defaultDiscount: numeric("default_discount", { precision: 5, scale: 2 }).notNull().default("0"),
    marginPercentage: numeric("margin_percentage", { precision: 8, scale: 2 }).notNull().default("0"),
    markupPercentage: numeric("markup_percentage", { precision: 8, scale: 2 }).notNull().default("0"),
    stockTrackingEnabled: boolean("stock_tracking_enabled").notNull().default(false),
    openingStockQuantity: numeric("opening_stock_quantity", { precision: 14, scale: 3 }).notNull().default("0"),
    openingStockRate: numeric("opening_stock_rate", { precision: 14, scale: 2 }).notNull().default("0"),
    openingStockValue: numeric("opening_stock_value", { precision: 14, scale: 2 }).notNull().default("0"),
    minimumStockLevel: numeric("minimum_stock_level", { precision: 14, scale: 3 }).notNull().default("0"),
    reorderLevel: numeric("reorder_level", { precision: 14, scale: 3 }).notNull().default("0"),
    maximumStockLevel: numeric("maximum_stock_level", { precision: 14, scale: 3 }).notNull().default("0"),
    batchTrackingEnabled: boolean("batch_tracking_enabled").notNull().default(false),
    expiryTrackingEnabled: boolean("expiry_tracking_enabled").notNull().default(false),
    serialTrackingEnabled: boolean("serial_tracking_enabled").notNull().default(false),
    negativeStockAllowed: boolean("negative_stock_allowed").notNull().default(false),
    status: productStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    companyIdx: index("products_company_id_idx").on(table.companyId),
    companyNameIdx: index("products_company_name_idx").on(table.companyId, table.name),
    companyCategoryIdx: index("products_company_category_id_idx").on(table.companyId, table.categoryId),
    companyStatusIdx: index("products_company_status_idx").on(table.companyId, table.status),
    companyProductTypeIdx: index("products_company_product_type_idx").on(table.companyId, table.productType),
    hsnSacIdx: index("products_hsn_sac_code_idx").on(table.hsnSacCode),
    companyProductCodeUniqueIdx: uniqueIndex("products_company_product_code_unique_idx").on(
      table.companyId,
      table.productCode
    ),
    companySkuUniqueIdx: uniqueIndex("products_company_sku_unique_idx")
      .on(table.companyId, table.sku)
      .where(sql`${table.deletedAt} is null`),
    companyBarcodeUniqueIdx: uniqueIndex("products_company_barcode_unique_idx")
      .on(table.companyId, table.barcode)
      .where(sql`${table.barcode} is not null AND ${table.deletedAt} is null`),
    gstRateCheck: check("products_gst_rate_check", sql`${table.gstRate} >= 0 AND ${table.gstRate} <= 28`),
    cessRateCheck: check("products_cess_rate_check", sql`${table.cessRate} >= 0`),
    purchasePriceCheck: check("products_purchase_price_check", sql`${table.purchasePrice} >= 0`),
    salePriceCheck: check("products_sale_price_check", sql`${table.salePrice} >= 0`),
    mrpCheck: check("products_mrp_check", sql`${table.mrp} >= 0`),
    wholesalePriceCheck: check("products_wholesale_price_check", sql`${table.wholesalePrice} >= 0`),
    minimumSalePriceCheck: check("products_minimum_sale_price_check", sql`${table.minimumSalePrice} >= 0`),
    defaultDiscountCheck: check(
      "products_default_discount_check",
      sql`${table.defaultDiscount} >= 0 AND ${table.defaultDiscount} <= 100`
    ),
    openingStockQuantityCheck: check(
      "products_opening_stock_quantity_check",
      sql`${table.openingStockQuantity} >= 0`
    ),
    openingStockRateCheck: check("products_opening_stock_rate_check", sql`${table.openingStockRate} >= 0`),
    openingStockValueCheck: check("products_opening_stock_value_check", sql`${table.openingStockValue} >= 0`),
    minimumStockLevelCheck: check("products_minimum_stock_level_check", sql`${table.minimumStockLevel} >= 0`),
    reorderLevelCheck: check("products_reorder_level_check", sql`${table.reorderLevel} >= 0`),
    maximumStockLevelCheck: check("products_maximum_stock_level_check", sql`${table.maximumStockLevel} >= 0`)
  })
);

export const productPriceHistory = pgTable(
  "product_price_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    changeType: productPriceHistoryChangeTypeEnum("change_type").notNull(),
    oldValue: numeric("old_value", { precision: 14, scale: 2 }),
    newValue: numeric("new_value", { precision: 14, scale: 2 }),
    oldSnapshot: jsonb("old_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    newSnapshot: jsonb("new_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    reason: text("reason"),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    companyIdx: index("product_price_history_company_id_idx").on(table.companyId),
    productIdx: index("product_price_history_product_id_idx").on(table.productId),
    productCompanyIdx: index("product_price_history_company_product_id_idx").on(table.companyId, table.productId)
  })
);
