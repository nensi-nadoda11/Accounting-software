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
  inventoryAlerts,
  inventoryValuationSnapshots,
  productBatches,
  productCategories,
  products,
  productUnits,
  stockAdjustments,
  stockBalances,
  stockMovements,
  warehouses
} from "../../db/schema";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type StockFilterParams = {
  companyId: string;
  search?: string | null | undefined;
  warehouseId?: string | undefined;
  categoryId?: string | undefined;
  productId?: string | undefined;
  lowStock?: boolean | undefined;
  outOfStock?: boolean | undefined;
  expired?: boolean | undefined;
  expiringSoon?: boolean | undefined;
  status?: "active" | "inactive" | "deleted" | undefined;
  expiryAlertDays: number;
};

type StockMovementFilterParams = {
  companyId: string;
  productId?: string | undefined;
  warehouseId?: string | undefined;
  batchId?: string | undefined;
  movementType?: typeof stockMovements.$inferSelect.movementType | undefined;
  referenceType?: string | null | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
};

type StockAdjustmentFilterParams = {
  companyId: string;
  productId?: string | undefined;
  warehouseId?: string | undefined;
  adjustmentType?: typeof stockAdjustments.$inferSelect.adjustmentType | undefined;
  dateFrom?: Date | null | undefined;
  dateTo?: Date | null | undefined;
};

type AlertCandidateFilter = {
  companyId: string;
  productId?: string | undefined;
  warehouseId?: string | undefined;
  batchId?: string | undefined;
};

class InventoryRepository {
  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private buildStockConditions(params: StockFilterParams) {
    const conditions: SQL[] = [eq(stockBalances.companyId, params.companyId), eq(products.companyId, params.companyId)];

    if (params.status === "deleted") {
      conditions.push(eq(products.status, "deleted"));
    } else {
      conditions.push(isNull(products.deletedAt), isNull(warehouses.deletedAt));

      if (params.status) {
        conditions.push(eq(products.status, params.status));
      }
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(products.name, searchPattern),
          ilike(products.productCode, searchPattern),
          ilike(products.sku, searchPattern),
          ilike(products.barcode, searchPattern),
          ilike(productCategories.name, searchPattern),
          ilike(warehouses.name, searchPattern),
          ilike(warehouses.warehouseCode, searchPattern),
          ilike(productBatches.batchNumber, searchPattern)
        )!
      );
    }

    if (params.warehouseId) {
      conditions.push(eq(stockBalances.warehouseId, params.warehouseId));
    }

    if (params.categoryId) {
      conditions.push(eq(products.categoryId, params.categoryId));
    }

    if (params.productId) {
      conditions.push(eq(stockBalances.productId, params.productId));
    }

    if (params.lowStock !== undefined) {
      const clause = sql`${stockBalances.availableQuantity} <= ${products.minimumStockLevel}`;
      conditions.push(params.lowStock ? clause : sql`NOT (${clause})`);
    }

    if (params.outOfStock !== undefined) {
      const clause = sql`${stockBalances.availableQuantity} <= 0`;
      conditions.push(params.outOfStock ? clause : sql`NOT (${clause})`);
    }

    if (params.expired !== undefined) {
      const clause = sql`${productBatches.expiryDate} IS NOT NULL AND ${productBatches.expiryDate} < CURRENT_DATE AND ${stockBalances.availableQuantity} > 0`;
      conditions.push(params.expired ? clause : sql`NOT (${clause})`);
    }

    if (params.expiringSoon !== undefined) {
      const clause = sql`${productBatches.expiryDate} IS NOT NULL AND ${productBatches.expiryDate} >= CURRENT_DATE AND ${productBatches.expiryDate} <= CURRENT_DATE + ${params.expiryAlertDays} AND ${stockBalances.availableQuantity} > 0`;
      conditions.push(params.expiringSoon ? clause : sql`NOT (${clause})`);
    }

    return conditions;
  }

  private buildMovementConditions(params: StockMovementFilterParams) {
    const conditions: SQL[] = [eq(stockMovements.companyId, params.companyId)];

    if (params.productId) {
      conditions.push(eq(stockMovements.productId, params.productId));
    }

    if (params.warehouseId) {
      conditions.push(eq(stockMovements.warehouseId, params.warehouseId));
    }

    if (params.batchId) {
      conditions.push(eq(stockMovements.batchId, params.batchId));
    }

    if (params.movementType) {
      conditions.push(eq(stockMovements.movementType, params.movementType));
    }

    if (params.referenceType) {
      conditions.push(eq(stockMovements.referenceType, params.referenceType));
    }

    if (params.dateFrom) {
      conditions.push(sql`${stockMovements.movementDate} >= ${params.dateFrom}`);
    }

    if (params.dateTo) {
      conditions.push(sql`${stockMovements.movementDate} <= ${params.dateTo}`);
    }

    return conditions;
  }

  private buildAdjustmentConditions(params: StockAdjustmentFilterParams) {
    const conditions: SQL[] = [eq(stockAdjustments.companyId, params.companyId)];

    if (params.productId) {
      conditions.push(eq(stockAdjustments.productId, params.productId));
    }

    if (params.warehouseId) {
      conditions.push(eq(stockAdjustments.warehouseId, params.warehouseId));
    }

    if (params.adjustmentType) {
      conditions.push(eq(stockAdjustments.adjustmentType, params.adjustmentType));
    }

    if (params.dateFrom) {
      conditions.push(sql`${stockAdjustments.adjustmentDate} >= ${params.dateFrom}`);
    }

    if (params.dateTo) {
      conditions.push(sql`${stockAdjustments.adjustmentDate} <= ${params.dateTo}`);
    }

    return conditions;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findLatestWarehouseCode(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ warehouseCode: warehouses.warehouseCode })
      .from(warehouses)
      .where(eq(warehouses.companyId, companyId))
      .orderBy(desc(warehouses.warehouseCode))
      .limit(1);

    return row?.warehouseCode ?? null;
  }

  public async findWarehouseById(companyId: string, warehouseId: string, includeDeleted = false, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(warehouses.companyId, companyId), eq(warehouses.id, warehouseId)];

    if (!includeDeleted) {
      conditions.push(isNull(warehouses.deletedAt));
    }

    const [row] = await this.getExecutor(executor).select().from(warehouses).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async findWarehouseByCode(companyId: string, warehouseCode: string, excludeId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [
      eq(warehouses.companyId, companyId),
      eq(warehouses.warehouseCode, warehouseCode),
      isNull(warehouses.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(warehouses.id, excludeId));
    }

    const [row] = await this.getExecutor(executor).select().from(warehouses).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async createWarehouse(data: typeof warehouses.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(warehouses).values(data).returning();
    return row ?? null;
  }

  public async updateWarehouse(
    companyId: string,
    warehouseId: string,
    data: Partial<typeof warehouses.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(warehouses)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(warehouses.companyId, companyId), eq(warehouses.id, warehouseId), isNull(warehouses.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async unsetDefaultWarehouses(companyId: string, excludeWarehouseId?: string, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(warehouses.companyId, companyId), eq(warehouses.isDefault, true), isNull(warehouses.deletedAt)];

    if (excludeWarehouseId) {
      conditions.push(ne(warehouses.id, excludeWarehouseId));
    }

    await this
      .getExecutor(executor)
      .update(warehouses)
      .set({
        isDefault: false,
        updatedAt: new Date()
      })
      .where(and(...conditions));
  }

  public async softDeleteWarehouse(companyId: string, warehouseId: string, actorId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .update(warehouses)
      .set({
        isDefault: false,
        status: "deleted",
        updatedBy: actorId,
        updatedAt: new Date(),
        deletedAt: new Date()
      })
      .where(and(eq(warehouses.companyId, companyId), eq(warehouses.id, warehouseId), isNull(warehouses.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async listWarehouses(params: {
    companyId: string;
    page: number;
    limit: number;
    search?: string | null | undefined;
    status?: typeof warehouses.$inferSelect.status | undefined;
  }) {
    const conditions: SQL[] = [eq(warehouses.companyId, params.companyId)];

    if (params.status === "deleted") {
      conditions.push(eq(warehouses.status, "deleted"));
    } else {
      conditions.push(isNull(warehouses.deletedAt));

      if (params.status) {
        conditions.push(eq(warehouses.status, params.status));
      }
    }

    if (params.search) {
      const searchPattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(warehouses.name, searchPattern),
          ilike(warehouses.warehouseCode, searchPattern),
          ilike(warehouses.city, searchPattern),
          ilike(warehouses.state, searchPattern),
          ilike(warehouses.contactPerson, searchPattern)
        )!
      );
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select()
      .from(warehouses)
      .where(whereClause)
      .orderBy(desc(warehouses.isDefault), asc(warehouses.name), desc(warehouses.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);
    const [totalRow] = await db.select({ value: count() }).from(warehouses).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async hasWarehouseStock(companyId: string, warehouseId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(stockBalances)
      .where(
        and(
          eq(stockBalances.companyId, companyId),
          eq(stockBalances.warehouseId, warehouseId),
          sql`(${stockBalances.availableQuantity} > 0 OR ${stockBalances.reservedQuantity} > 0 OR ${stockBalances.damagedQuantity} > 0 OR ${stockBalances.expiredQuantity} > 0)`
        )
      );

    return (row?.value ?? 0) > 0;
  }

  public async findProductInventoryContext(companyId: string, productId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({
        product: products,
        categoryName: productCategories.name,
        unitName: productUnits.name,
        unitSymbol: productUnits.symbol,
        unitDecimalAllowed: productUnits.decimalAllowed
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .leftJoin(productUnits, eq(products.unitId, productUnits.id))
      .where(and(eq(products.companyId, companyId), eq(products.id, productId)))
      .limit(1);

    return row ?? null;
  }

  public async findBatchById(companyId: string, batchId: string, includeDeleted = false, executor?: DbExecutor) {
    const conditions: SQL[] = [eq(productBatches.companyId, companyId), eq(productBatches.id, batchId)];

    if (!includeDeleted) {
      conditions.push(isNull(productBatches.deletedAt));
    }

    const [row] = await this
      .getExecutor(executor)
      .select({
        batch: productBatches,
        productName: products.name,
        productCode: products.productCode,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode
      })
      .from(productBatches)
      .leftJoin(products, eq(productBatches.productId, products.id))
      .leftJoin(warehouses, eq(productBatches.warehouseId, warehouses.id))
      .where(and(...conditions))
      .limit(1);

    return row ?? null;
  }

  public async findBatchByNumber(
    companyId: string,
    productId: string,
    warehouseId: string,
    batchNumber: string,
    excludeId?: string,
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [
      eq(productBatches.companyId, companyId),
      eq(productBatches.productId, productId),
      eq(productBatches.warehouseId, warehouseId),
      eq(productBatches.batchNumber, batchNumber),
      isNull(productBatches.deletedAt)
    ];

    if (excludeId) {
      conditions.push(ne(productBatches.id, excludeId));
    }

    const [row] = await this.getExecutor(executor).select().from(productBatches).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async createBatch(data: typeof productBatches.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(productBatches).values(data).returning();
    return row ?? null;
  }

  public async updateBatch(
    companyId: string,
    batchId: string,
    data: Partial<typeof productBatches.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(productBatches)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(productBatches.companyId, companyId), eq(productBatches.id, batchId), isNull(productBatches.deletedAt)))
      .returning();

    return row ?? null;
  }

  public async listBatches(params: {
    companyId: string;
    page: number;
    limit: number;
    productId?: string | undefined;
    warehouseId?: string | undefined;
    expired?: boolean | undefined;
    expiringSoon?: boolean | undefined;
    status?: typeof productBatches.$inferSelect.status | undefined;
    expiryAlertDays: number;
  }) {
    const conditions: SQL[] = [eq(productBatches.companyId, params.companyId)];

    if (params.status === "deleted") {
      conditions.push(eq(productBatches.status, "deleted"));
    } else {
      conditions.push(isNull(productBatches.deletedAt));

      if (params.status) {
        conditions.push(eq(productBatches.status, params.status));
      }
    }

    if (params.productId) {
      conditions.push(eq(productBatches.productId, params.productId));
    }

    if (params.warehouseId) {
      conditions.push(eq(productBatches.warehouseId, params.warehouseId));
    }

    if (params.expired !== undefined) {
      const clause = sql`${productBatches.expiryDate} IS NOT NULL AND ${productBatches.expiryDate} < CURRENT_DATE`;
      conditions.push(params.expired ? clause : sql`NOT (${clause})`);
    }

    if (params.expiringSoon !== undefined) {
      const clause = sql`${productBatches.expiryDate} IS NOT NULL AND ${productBatches.expiryDate} >= CURRENT_DATE AND ${productBatches.expiryDate} <= CURRENT_DATE + ${params.expiryAlertDays}`;
      conditions.push(params.expiringSoon ? clause : sql`NOT (${clause})`);
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select({
        batch: productBatches,
        productName: products.name,
        productCode: products.productCode,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        availableQuantity: stockBalances.availableQuantity,
        averageCost: stockBalances.averageCost,
        stockValue: stockBalances.stockValue
      })
      .from(productBatches)
      .leftJoin(products, eq(productBatches.productId, products.id))
      .leftJoin(warehouses, eq(productBatches.warehouseId, warehouses.id))
      .leftJoin(stockBalances, eq(productBatches.id, stockBalances.batchId))
      .where(whereClause)
      .orderBy(asc(productBatches.expiryDate), asc(productBatches.batchNumber), desc(productBatches.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);
    const [totalRow] = await db.select({ value: count() }).from(productBatches).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async countBatchMovements(companyId: string, batchId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(stockMovements)
      .where(and(eq(stockMovements.companyId, companyId), eq(stockMovements.batchId, batchId)));

    return row?.value ?? 0;
  }

  public async findStockBalance(
    companyId: string,
    productId: string,
    warehouseId: string,
    batchId: string | null,
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [
      eq(stockBalances.companyId, companyId),
      eq(stockBalances.productId, productId),
      eq(stockBalances.warehouseId, warehouseId)
    ];

    if (batchId) {
      conditions.push(eq(stockBalances.batchId, batchId));
    } else {
      conditions.push(isNull(stockBalances.batchId));
    }

    const [row] = await this.getExecutor(executor).select().from(stockBalances).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async createStockBalance(data: typeof stockBalances.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(stockBalances).values(data).returning();
    return row ?? null;
  }

  public async updateStockBalance(
    companyId: string,
    balanceId: string,
    data: Partial<typeof stockBalances.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(stockBalances)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(stockBalances.companyId, companyId), eq(stockBalances.id, balanceId)))
      .returning();

    return row ?? null;
  }

  public async hasOpeningStockMovement(
    companyId: string,
    productId: string,
    warehouseId: string,
    batchId: string | null,
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [
      eq(stockMovements.companyId, companyId),
      eq(stockMovements.productId, productId),
      eq(stockMovements.warehouseId, warehouseId),
      eq(stockMovements.movementType, "opening_stock")
    ];

    if (batchId) {
      conditions.push(eq(stockMovements.batchId, batchId));
    } else {
      conditions.push(isNull(stockMovements.batchId));
    }

    const [row] = await this
      .getExecutor(executor)
      .select({ id: stockMovements.id })
      .from(stockMovements)
      .where(and(...conditions))
      .limit(1);

    return Boolean(row);
  }

  public async createStockMovement(data: typeof stockMovements.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(stockMovements).values(data).returning();
    return row ?? null;
  }

  public async createStockAdjustment(data: typeof stockAdjustments.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(stockAdjustments).values(data).returning();
    return row ?? null;
  }

  public async listAdjustments(params: StockAdjustmentFilterParams & { page: number; limit: number }) {
    const whereClause = and(...this.buildAdjustmentConditions(params));
    const rows = await db
      .select({
        adjustment: stockAdjustments,
        productName: products.name,
        productCode: products.productCode,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        batchNumber: productBatches.batchNumber
      })
      .from(stockAdjustments)
      .leftJoin(products, eq(stockAdjustments.productId, products.id))
      .leftJoin(warehouses, eq(stockAdjustments.warehouseId, warehouses.id))
      .leftJoin(productBatches, eq(stockAdjustments.batchId, productBatches.id))
      .where(whereClause)
      .orderBy(desc(stockAdjustments.adjustmentDate), desc(stockAdjustments.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);
    const [totalRow] = await db.select({ value: count() }).from(stockAdjustments).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listMovements(params: StockMovementFilterParams & { page: number; limit: number }) {
    const whereClause = and(...this.buildMovementConditions(params));
    const rows = await db
      .select({
        movement: stockMovements,
        productName: products.name,
        productCode: products.productCode,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        batchNumber: productBatches.batchNumber
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .leftJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .leftJoin(productBatches, eq(stockMovements.batchId, productBatches.id))
      .where(whereClause)
      .orderBy(desc(stockMovements.movementDate), desc(stockMovements.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);
    const [totalRow] = await db.select({ value: count() }).from(stockMovements).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listMovementsForExport(params: StockMovementFilterParams) {
    const whereClause = and(...this.buildMovementConditions(params));
    return db
      .select({
        movement: stockMovements,
        productName: products.name,
        productCode: products.productCode,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        batchNumber: productBatches.batchNumber
      })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .leftJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .leftJoin(productBatches, eq(stockMovements.batchId, productBatches.id))
      .where(whereClause)
      .orderBy(desc(stockMovements.movementDate), desc(stockMovements.createdAt));
  }

  public async listStock(params: StockFilterParams & { page: number; limit: number }) {
    const whereClause = and(...this.buildStockConditions(params));
    const rows = await db
      .select({
        balance: stockBalances,
        product: products,
        categoryName: productCategories.name,
        unitName: productUnits.name,
        unitSymbol: productUnits.symbol,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        batchNumber: productBatches.batchNumber,
        manufacturingDate: productBatches.manufacturingDate,
        expiryDate: productBatches.expiryDate,
        batchStatus: productBatches.status
      })
      .from(stockBalances)
      .innerJoin(products, eq(stockBalances.productId, products.id))
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .leftJoin(productUnits, eq(products.unitId, productUnits.id))
      .innerJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
      .leftJoin(productBatches, eq(stockBalances.batchId, productBatches.id))
      .where(whereClause)
      .orderBy(desc(stockBalances.updatedAt), asc(products.name), asc(warehouses.name))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);
    const [totalRow] = await db
      .select({ value: count() })
      .from(stockBalances)
      .innerJoin(products, eq(stockBalances.productId, products.id))
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .innerJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
      .leftJoin(productBatches, eq(stockBalances.batchId, productBatches.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async listStockForExport(params: StockFilterParams) {
    const whereClause = and(...this.buildStockConditions(params));
    return db
      .select({
        balance: stockBalances,
        product: products,
        categoryName: productCategories.name,
        unitName: productUnits.name,
        unitSymbol: productUnits.symbol,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        batchNumber: productBatches.batchNumber,
        expiryDate: productBatches.expiryDate
      })
      .from(stockBalances)
      .innerJoin(products, eq(stockBalances.productId, products.id))
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .leftJoin(productUnits, eq(products.unitId, productUnits.id))
      .innerJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
      .leftJoin(productBatches, eq(stockBalances.batchId, productBatches.id))
      .where(whereClause)
      .orderBy(asc(products.name), asc(warehouses.name), asc(productBatches.batchNumber));
  }

  public async getProductStock(companyId: string, productId: string) {
    return db
      .select({
        balance: stockBalances,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        batchNumber: productBatches.batchNumber,
        manufacturingDate: productBatches.manufacturingDate,
        expiryDate: productBatches.expiryDate,
        batchStatus: productBatches.status
      })
      .from(stockBalances)
      .innerJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
      .leftJoin(productBatches, eq(stockBalances.batchId, productBatches.id))
      .where(and(eq(stockBalances.companyId, companyId), eq(stockBalances.productId, productId)))
      .orderBy(desc(stockBalances.updatedAt), asc(warehouses.name), asc(productBatches.batchNumber));
  }

  public async listAlertCandidates(params: AlertCandidateFilter) {
    const conditions: SQL[] = [eq(stockBalances.companyId, params.companyId), isNull(products.deletedAt), isNull(warehouses.deletedAt)];

    if (params.productId) {
      conditions.push(eq(stockBalances.productId, params.productId));
    }

    if (params.warehouseId) {
      conditions.push(eq(stockBalances.warehouseId, params.warehouseId));
    }

    if (params.batchId) {
      conditions.push(eq(stockBalances.batchId, params.batchId));
    }

    return db
      .select({
        balance: stockBalances,
        product: products,
        warehouse: warehouses,
        batch: productBatches
      })
      .from(stockBalances)
      .innerJoin(products, eq(stockBalances.productId, products.id))
      .innerJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
      .leftJoin(productBatches, eq(stockBalances.batchId, productBatches.id))
      .where(and(...conditions));
  }

  public async listAlerts(params: {
    companyId: string;
    page: number;
    limit: number;
    alertType?: typeof inventoryAlerts.$inferSelect.alertType | undefined;
    severity?: typeof inventoryAlerts.$inferSelect.severity | undefined;
    isRead?: boolean | undefined;
  }) {
    const conditions: SQL[] = [eq(inventoryAlerts.companyId, params.companyId)];

    if (params.alertType) {
      conditions.push(eq(inventoryAlerts.alertType, params.alertType));
    }

    if (params.severity) {
      conditions.push(eq(inventoryAlerts.severity, params.severity));
    }

    if (params.isRead !== undefined) {
      conditions.push(eq(inventoryAlerts.isRead, params.isRead));
    }

    const whereClause = and(...conditions);
    const rows = await db
      .select({
        alert: inventoryAlerts,
        productName: products.name,
        productCode: products.productCode,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        batchNumber: productBatches.batchNumber
      })
      .from(inventoryAlerts)
      .leftJoin(products, eq(inventoryAlerts.productId, products.id))
      .leftJoin(warehouses, eq(inventoryAlerts.warehouseId, warehouses.id))
      .leftJoin(productBatches, eq(inventoryAlerts.batchId, productBatches.id))
      .where(whereClause)
      .orderBy(desc(inventoryAlerts.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);
    const [totalRow] = await db.select({ value: count() }).from(inventoryAlerts).where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async findAlertById(companyId: string, alertId: string) {
    const [row] = await db
      .select()
      .from(inventoryAlerts)
      .where(and(eq(inventoryAlerts.companyId, companyId), eq(inventoryAlerts.id, alertId)))
      .limit(1);

    return row ?? null;
  }

  public async updateAlertReadState(companyId: string, alertId: string, isRead: boolean) {
    const [row] = await db
      .update(inventoryAlerts)
      .set({
        isRead
      })
      .where(and(eq(inventoryAlerts.companyId, companyId), eq(inventoryAlerts.id, alertId)))
      .returning();

    return row ?? null;
  }

  public async findOpenAlert(
    companyId: string,
    productId: string,
    warehouseId: string | null,
    batchId: string | null,
    alertType: typeof inventoryAlerts.$inferSelect.alertType,
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [
      eq(inventoryAlerts.companyId, companyId),
      eq(inventoryAlerts.productId, productId),
      eq(inventoryAlerts.alertType, alertType),
      isNull(inventoryAlerts.resolvedAt)
    ];

    if (warehouseId) {
      conditions.push(eq(inventoryAlerts.warehouseId, warehouseId));
    } else {
      conditions.push(isNull(inventoryAlerts.warehouseId));
    }

    if (batchId) {
      conditions.push(eq(inventoryAlerts.batchId, batchId));
    } else {
      conditions.push(isNull(inventoryAlerts.batchId));
    }

    const [row] = await this.getExecutor(executor).select().from(inventoryAlerts).where(and(...conditions)).limit(1);
    return row ?? null;
  }

  public async createAlert(data: typeof inventoryAlerts.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(inventoryAlerts).values(data).returning();
    return row ?? null;
  }

  public async resolveOpenAlert(
    companyId: string,
    productId: string,
    warehouseId: string | null,
    batchId: string | null,
    alertType: typeof inventoryAlerts.$inferSelect.alertType,
    executor?: DbExecutor
  ) {
    const conditions: SQL[] = [
      eq(inventoryAlerts.companyId, companyId),
      eq(inventoryAlerts.productId, productId),
      eq(inventoryAlerts.alertType, alertType),
      isNull(inventoryAlerts.resolvedAt)
    ];

    if (warehouseId) {
      conditions.push(eq(inventoryAlerts.warehouseId, warehouseId));
    } else {
      conditions.push(isNull(inventoryAlerts.warehouseId));
    }

    if (batchId) {
      conditions.push(eq(inventoryAlerts.batchId, batchId));
    } else {
      conditions.push(isNull(inventoryAlerts.batchId));
    }

    await this
      .getExecutor(executor)
      .update(inventoryAlerts)
      .set({
        resolvedAt: new Date()
      })
      .where(and(...conditions));
  }

  public async listValuation(params: {
    companyId: string;
    warehouseId?: string | undefined;
    categoryId?: string | undefined;
    productId?: string | undefined;
  }) {
    const conditions: SQL[] = [eq(stockBalances.companyId, params.companyId), isNull(products.deletedAt), isNull(warehouses.deletedAt)];

    if (params.warehouseId) {
      conditions.push(eq(stockBalances.warehouseId, params.warehouseId));
    }

    if (params.categoryId) {
      conditions.push(eq(products.categoryId, params.categoryId));
    }

    if (params.productId) {
      conditions.push(eq(stockBalances.productId, params.productId));
    }

    return db
      .select({
        productId: products.id,
        productCode: products.productCode,
        productName: products.name,
        sku: products.sku,
        categoryName: productCategories.name,
        unitName: productUnits.name,
        unitSymbol: productUnits.symbol,
        totalQuantity: sql<string>`coalesce(sum(${stockBalances.availableQuantity}), 0)`,
        totalValue: sql<string>`coalesce(sum(${stockBalances.stockValue}), 0)`
      })
      .from(stockBalances)
      .innerJoin(products, eq(stockBalances.productId, products.id))
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .leftJoin(productUnits, eq(products.unitId, productUnits.id))
      .innerJoin(warehouses, eq(stockBalances.warehouseId, warehouses.id))
      .where(and(...conditions))
      .groupBy(
        products.id,
        products.productCode,
        products.name,
        products.sku,
        productCategories.name,
        productUnits.name,
        productUnits.symbol
      )
      .orderBy(asc(products.name), asc(products.productCode));
  }

  public async createValuationSnapshot(data: typeof inventoryValuationSnapshots.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(inventoryValuationSnapshots).values(data).returning();
    return row ?? null;
  }

  public async updateProductOpeningStock(
    companyId: string,
    productId: string,
    data: Pick<typeof products.$inferInsert, "openingStockQuantity" | "openingStockRate" | "openingStockValue" | "updatedBy">,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(products)
      .set({
        openingStockQuantity: data.openingStockQuantity,
        openingStockRate: data.openingStockRate,
        openingStockValue: data.openingStockValue,
        updatedBy: data.updatedBy,
        updatedAt: new Date()
      })
      .where(and(eq(products.companyId, companyId), eq(products.id, productId), isNull(products.deletedAt)))
      .returning();

    return row ?? null;
  }
}

export const inventoryRepository = new InventoryRepository();
