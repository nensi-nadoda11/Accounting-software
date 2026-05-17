import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  ne,
  or,
  sql,
  type SQL
} from "drizzle-orm";

import { db } from "../../db";
import {
  companyTaxSettings,
  productCategories,
  productPriceHistory,
  products,
  productUnits
} from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type ListProductsParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  productType?: "goods" | "service";
  categoryId?: string;
  unitId?: string;
  gstRate?: number;
  status?: "active" | "inactive" | "deleted";
  stockTrackingEnabled?: boolean;
  lowStock?: boolean;
  taxType?: "taxable" | "exempt" | "nil_rated" | "non_gst";
  sortBy: "name" | "salePrice" | "purchasePrice" | "createdAt" | "productCode";
  sortOrder: "asc" | "desc";
};

type ExportProductsParams = Omit<ListProductsParams, "page" | "limit">;

type ListCategoriesParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  status?: "active" | "inactive" | "deleted";
  parentId?: string;
};

type ListUnitsParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string;
  status?: "active" | "inactive" | "deleted";
  decimalAllowed?: boolean;
};

class ProductsRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private buildProductConditions(params: Omit<ListProductsParams, "page" | "limit" | "sortBy" | "sortOrder">) {
    const conditions: SQL[] = [eq(products.companyId, params.companyId)];

    if (params.status === "deleted") {
      conditions.push(eq(products.status, "deleted"));
    } else {
      conditions.push(isNull(products.deletedAt));

      if (params.status) {
        conditions.push(eq(products.status, params.status));
      }
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(products.name, searchPattern),
          ilike(products.sku, searchPattern),
          ilike(products.barcode, searchPattern),
          ilike(products.hsnSacCode, searchPattern),
          ilike(products.brand, searchPattern),
          ilike(products.productCode, searchPattern),
          ilike(productCategories.name, searchPattern)
        )!
      );
    }

    if (params.productType) {
      conditions.push(eq(products.productType, params.productType));
    }

    if (params.categoryId) {
      conditions.push(eq(products.categoryId, params.categoryId));
    }

    if (params.unitId) {
      conditions.push(eq(products.unitId, params.unitId));
    }

    if (params.gstRate !== undefined) {
      conditions.push(eq(products.gstRate, params.gstRate.toFixed(2)));
    }

    if (params.stockTrackingEnabled !== undefined) {
      conditions.push(eq(products.stockTrackingEnabled, params.stockTrackingEnabled));
    }

    if (params.lowStock !== undefined) {
      const lowStockSql = sql`(${products.stockTrackingEnabled} = true and ${products.openingStockQuantity} <= greatest(${products.reorderLevel}, ${products.minimumStockLevel}))`;
      conditions.push(params.lowStock ? lowStockSql : sql`not ${lowStockSql}`);
    }

    if (params.taxType) {
      conditions.push(eq(products.taxType, params.taxType));
    }

    return conditions;
  }

  private getProductOrderBy(sortBy: ListProductsParams["sortBy"], sortOrder: ListProductsParams["sortOrder"]) {
    const direction = sortOrder === "asc" ? asc : desc;

    if (sortBy === "name") {
      return [direction(products.name), desc(products.createdAt)] as const;
    }

    if (sortBy === "salePrice") {
      return [direction(products.salePrice), asc(products.name)] as const;
    }

    if (sortBy === "purchasePrice") {
      return [direction(products.purchasePrice), asc(products.name)] as const;
    }

    if (sortBy === "productCode") {
      return [direction(products.productCode), asc(products.name)] as const;
    }

    return [direction(products.createdAt), asc(products.name)] as const;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this
      .getExecutor(executor)
      .execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findCompanyTaxSettings(companyId: string) {
    const [settings] = await db
      .select({
        gstEnabled: companyTaxSettings.gstEnabled,
        hsnSacEnabled: companyTaxSettings.hsnSacEnabled
      })
      .from(companyTaxSettings)
      .where(eq(companyTaxSettings.companyId, companyId))
      .limit(1);

    return settings ?? null;
  }

  public async findLatestCategoryCode(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ categoryCode: productCategories.categoryCode })
      .from(productCategories)
      .where(eq(productCategories.companyId, companyId))
      .orderBy(desc(productCategories.categoryCode))
      .limit(1);

    return row?.categoryCode ?? null;
  }

  public async findLatestProductCode(companyId: string, prefix: "PROD" | "SERV", executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ productCode: products.productCode })
      .from(products)
      .where(and(eq(products.companyId, companyId), ilike(products.productCode, `${prefix}-%`)))
      .orderBy(desc(products.productCode))
      .limit(1);

    return row?.productCode ?? null;
  }

  public async findLatestGeneratedBarcode(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ barcode: products.barcode })
      .from(products)
      .where(and(eq(products.companyId, companyId), sql`${products.barcode} ~ '^[0-9]{12}$'`))
      .orderBy(desc(products.barcode))
      .limit(1);

    return row?.barcode ?? null;
  }

  public async findCategoryById(companyId: string, categoryId: string, includeDeleted = false, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(productCategories.companyId, companyId), eq(productCategories.id, categoryId)];

    if (!includeDeleted) {
      conditions.push(isNull(productCategories.deletedAt));
    }

    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(productCategories)
      .where(and(...conditions))
      .limit(1);

    return row ?? null;
  }

  public async findCategoryByName(companyId: string, name: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(productCategories.companyId, companyId),
      eq(productCategories.name, name),
      isNull(productCategories.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(productCategories.id, excludeId));
    }

    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(productCategories)
      .where(and(...conditions))
      .limit(1);

    return row ?? null;
  }

  public async createCategory(data: typeof productCategories.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(productCategories).values(data).returning();
    return row ?? null;
  }

  public async updateCategory(
    companyId: string,
    categoryId: string,
    data: Partial<typeof productCategories.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(productCategories)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(productCategories.companyId, companyId),
          eq(productCategories.id, categoryId),
          isNull(productCategories.deletedAt)
        )
      )
      .returning();

    return row ?? null;
  }

  public async softDeleteCategory(companyId: string, categoryId: string, actorId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(productCategories)
      .set({
        status: "deleted",
        updatedBy: actorId,
        updatedAt: new Date(),
        deletedAt: new Date()
      })
      .where(
        and(
          eq(productCategories.companyId, companyId),
          eq(productCategories.id, categoryId),
          isNull(productCategories.deletedAt)
        )
      )
      .returning();

    return row ?? null;
  }

  public async listCategories(params: ListCategoriesParams) {
    const conditions: SQL[] = [eq(productCategories.companyId, params.companyId)];

    if (params.status === "deleted") {
      conditions.push(eq(productCategories.status, "deleted"));
    } else {
      conditions.push(isNull(productCategories.deletedAt));

      if (params.status) {
        conditions.push(eq(productCategories.status, params.status));
      }
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(productCategories.name, searchPattern),
          ilike(productCategories.categoryCode, searchPattern),
          ilike(productCategories.description, searchPattern)
        )!
      );
    }

    if (params.parentId) {
      conditions.push(eq(productCategories.parentId, params.parentId));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select()
      .from(productCategories)
      .where(whereClause)
      .orderBy(asc(productCategories.name), desc(productCategories.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);
    const [totalRow] = await db.select({ value: count() }).from(productCategories).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async countActiveProductsByCategory(companyId: string, categoryId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(products)
      .where(
        and(
          eq(products.companyId, companyId),
          eq(products.categoryId, categoryId),
          eq(products.status, "active"),
          isNull(products.deletedAt)
        )
      );

    return row?.value ?? 0;
  }

  public async findUnitById(companyId: string, unitId: string, includeDeleted = false, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(productUnits.companyId, companyId), eq(productUnits.id, unitId)];

    if (!includeDeleted) {
      conditions.push(isNull(productUnits.deletedAt));
    }

    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(productUnits)
      .where(and(...conditions))
      .limit(1);

    return row ?? null;
  }

  public async findUnitBySymbol(companyId: string, symbol: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(productUnits.companyId, companyId),
      eq(productUnits.symbol, symbol),
      isNull(productUnits.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(productUnits.id, excludeId));
    }

    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(productUnits)
      .where(and(...conditions))
      .limit(1);

    return row ?? null;
  }

  public async createUnit(data: typeof productUnits.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(productUnits).values(data).returning();
    return row ?? null;
  }

  public async updateUnit(
    companyId: string,
    unitId: string,
    data: Partial<typeof productUnits.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(productUnits)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(productUnits.companyId, companyId), eq(productUnits.id, unitId), isNull(productUnits.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async softDeleteUnit(companyId: string, unitId: string, actorId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(productUnits)
      .set({
        status: "deleted",
        updatedBy: actorId,
        updatedAt: new Date(),
        deletedAt: new Date()
      })
      .where(and(eq(productUnits.companyId, companyId), eq(productUnits.id, unitId), isNull(productUnits.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async listUnits(params: ListUnitsParams) {
    const conditions: SQL[] = [eq(productUnits.companyId, params.companyId)];

    if (params.status === "deleted") {
      conditions.push(eq(productUnits.status, "deleted"));
    } else {
      conditions.push(isNull(productUnits.deletedAt));

      if (params.status) {
        conditions.push(eq(productUnits.status, params.status));
      }
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(ilike(productUnits.name, searchPattern), ilike(productUnits.symbol, searchPattern))!
      );
    }

    if (params.decimalAllowed !== undefined) {
      conditions.push(eq(productUnits.decimalAllowed, params.decimalAllowed));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select()
      .from(productUnits)
      .where(whereClause)
      .orderBy(asc(productUnits.name), desc(productUnits.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);
    const [totalRow] = await db.select({ value: count() }).from(productUnits).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async countActiveProductsByUnit(companyId: string, unitId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(products)
      .where(
        and(
          eq(products.companyId, companyId),
          eq(products.unitId, unitId),
          eq(products.status, "active"),
          isNull(products.deletedAt)
        )
      );

    return row?.value ?? 0;
  }

  public async findProductById(companyId: string, productId: string, includeDeleted = false, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(products.companyId, companyId), eq(products.id, productId)];

    if (!includeDeleted) {
      conditions.push(isNull(products.deletedAt));
    }

    const [row] = await this
      .getExecutor(executor)
      .select({
        product: products,
        categoryName: productCategories.name,
        unitName: productUnits.name,
        unitSymbol: productUnits.symbol
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .leftJoin(productUnits, eq(products.unitId, productUnits.id))
      .where(and(...conditions))
      .limit(1);

    return row ?? null;
  }

  public async findProductBySku(companyId: string, sku: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(products.companyId, companyId), eq(products.sku, sku), isNull(products.deletedAt)];

    if (excludeId) {
      conditions.push(ne(products.id, excludeId));
    }

    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(1);

    return row ?? null;
  }

  public async findProductByBarcode(
    companyId: string,
    barcode: string,
    excludeId?: string,
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [
      eq(products.companyId, companyId),
      eq(products.barcode, barcode),
      isNull(products.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(products.id, excludeId));
    }

    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(1);

    return row ?? null;
  }

  public async createProduct(data: typeof products.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(products).values(data).returning();
    return row ?? null;
  }

  public async updateProduct(
    companyId: string,
    productId: string,
    data: Partial<typeof products.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(products)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(products.companyId, companyId), eq(products.id, productId), isNull(products.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async softDeleteProduct(companyId: string, productId: string, actorId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(products)
      .set({
        status: "deleted",
        updatedBy: actorId,
        updatedAt: new Date(),
        deletedAt: new Date()
      })
      .where(and(eq(products.companyId, companyId), eq(products.id, productId), isNull(products.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async listProducts(params: ListProductsParams) {
    const conditions = this.buildProductConditions(params);
    const whereClause = and(...conditions);
    const orderBy = this.getProductOrderBy(params.sortBy, params.sortOrder);

    const rows = await db
      .select({
        id: products.id,
        productCode: products.productCode,
        productType: products.productType,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        categoryId: products.categoryId,
        categoryName: productCategories.name,
        unitId: products.unitId,
        unitName: productUnits.name,
        unitSymbol: productUnits.symbol,
        brand: products.brand,
        hsnSacCode: products.hsnSacCode,
        taxType: products.taxType,
        gstRate: products.gstRate,
        cessRate: products.cessRate,
        priceTaxType: products.priceTaxType,
        purchasePrice: products.purchasePrice,
        salePrice: products.salePrice,
        mrp: products.mrp,
        wholesalePrice: products.wholesalePrice,
        minimumSalePrice: products.minimumSalePrice,
        defaultDiscount: products.defaultDiscount,
        marginPercentage: products.marginPercentage,
        markupPercentage: products.markupPercentage,
        stockTrackingEnabled: products.stockTrackingEnabled,
        openingStockQuantity: products.openingStockQuantity,
        minimumStockLevel: products.minimumStockLevel,
        reorderLevel: products.reorderLevel,
        maximumStockLevel: products.maximumStockLevel,
        status: products.status,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .leftJoin(productUnits, eq(products.unitId, productUnits.id))
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listProductsForExport(params: ExportProductsParams) {
    const conditions = this.buildProductConditions(params);
    const whereClause = and(...conditions);
    const orderBy = this.getProductOrderBy(params.sortBy, params.sortOrder);

    return db
      .select({
        product: products,
        categoryName: productCategories.name,
        unitName: productUnits.name,
        unitSymbol: productUnits.symbol
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .leftJoin(productUnits, eq(products.unitId, productUnits.id))
      .where(whereClause)
      .orderBy(...orderBy);
  }

  public async lookupProducts(companyId: string, search?: string | null, limit = 20) {
    const conditions: SQL[] = [
      eq(products.companyId, companyId),
      isNull(products.deletedAt),
      eq(products.status, "active")
    ];

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(products.name, searchPattern),
          ilike(products.productCode, searchPattern),
          ilike(products.sku, searchPattern),
          ilike(products.barcode, searchPattern)
        )!
      );
    }

    return db
      .select({
        id: products.id,
        name: products.name,
        productCode: products.productCode,
        sku: products.sku,
        barcode: products.barcode,
        salePrice: products.salePrice,
        purchasePrice: products.purchasePrice,
        gstRate: products.gstRate,
        productType: products.productType,
        stockTrackingEnabled: products.stockTrackingEnabled,
        unitName: productUnits.name,
        unitSymbol: productUnits.symbol
      })
      .from(products)
      .leftJoin(productUnits, eq(products.unitId, productUnits.id))
      .where(and(...conditions))
      .orderBy(asc(products.name), asc(products.productCode))
      .limit(limit);
  }

  public async createPriceHistory(data: typeof productPriceHistory.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(productPriceHistory).values(data).returning();
    return row ?? null;
  }

  public async listPriceHistory(companyId: string, productId: string, page: number, limit: number) {
    const whereClause = and(eq(productPriceHistory.companyId, companyId), eq(productPriceHistory.productId, productId));

    const rows = await db
      .select()
      .from(productPriceHistory)
      .where(whereClause)
      .orderBy(desc(productPriceHistory.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);
    const [totalRow] = await db.select({ value: count() }).from(productPriceHistory).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async hasLinkedTransactions(_companyId: string, _productId: string) {
    return false;
  }
}

export const productsRepository = new ProductsRepository();
