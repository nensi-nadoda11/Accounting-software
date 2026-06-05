import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../db";
import {
  appSettings,
  productBatches,
  products,
  productUnits,
  stockBalances,
  stockCheckItems,
  stockChecks,
  users,
  warehouses
} from "../../db/schema";
import type { StockCheckStatus } from "./stockCheck.types";

type TransactionClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbExecutor = typeof db | TransactionClient;

type ListStockChecksParams = {
  companyId: string;
  page: number;
  limit: number;
  search?: string | null | undefined;
  status?: StockCheckStatus | undefined;
  warehouseId?: string | undefined;
  dateFrom?: Date | undefined;
  dateTo?: Date | undefined;
};

class StockCheckRepository {
  private approvedUsers = alias(users, "approved_user");

  private getExecutor(executor?: DbExecutor) {
    return executor ?? db;
  }

  private buildListConditions(params: Omit<ListStockChecksParams, "page" | "limit">) {
    const conditions: SQL[] = [eq(stockChecks.companyId, params.companyId)];

    if (params.status) {
      conditions.push(eq(stockChecks.status, params.status));
    }

    if (params.warehouseId) {
      conditions.push(eq(stockChecks.warehouseId, params.warehouseId));
    }

    if (params.dateFrom) {
      conditions.push(sql`${stockChecks.checkDate} >= ${params.dateFrom.toISOString().slice(0, 10)}`);
    }

    if (params.dateTo) {
      conditions.push(sql`${stockChecks.checkDate} <= ${params.dateTo.toISOString().slice(0, 10)}`);
    }

    if (params.search) {
      const pattern = `%${params.search}%`;
      conditions.push(
        or(
          ilike(stockChecks.checkNo, pattern),
          ilike(warehouses.name, pattern),
          ilike(warehouses.warehouseCode, pattern),
          ilike(users.fullName, pattern)
        )!
      );
    }

    return conditions;
  }

  public async acquireScopedLock(scope: string, companyId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).execute(sql`select pg_advisory_xact_lock(hashtext(${`${scope}:${companyId}`}))`);
  }

  public async findLatestCheckNo(companyId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select({ checkNo: stockChecks.checkNo })
      .from(stockChecks)
      .where(eq(stockChecks.companyId, companyId))
      .orderBy(desc(stockChecks.checkNo))
      .limit(1);

    return row?.checkNo ?? null;
  }

  public async findWarehouseById(companyId: string, warehouseId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(warehouses)
      .where(and(eq(warehouses.companyId, companyId), eq(warehouses.id, warehouseId), isNull(warehouses.deletedAt)))
      .limit(1);

    return row ?? null;
  }

  public async listProductsByIds(companyId: string, productIds: string[], executor?: DbExecutor) {
    if (!productIds.length) {
      return [];
    }

    return this
      .getExecutor(executor)
      .select({
        product: products,
        unitDecimalAllowed: productUnits.decimalAllowed
      })
      .from(products)
      .leftJoin(productUnits, eq(products.unitId, productUnits.id))
      .where(and(eq(products.companyId, companyId), inArray(products.id, productIds), isNull(products.deletedAt)));
  }

  public async listBatchesByIds(companyId: string, batchIds: string[], executor?: DbExecutor) {
    if (!batchIds.length) {
      return [];
    }

    return this
      .getExecutor(executor)
      .select()
      .from(productBatches)
      .where(and(eq(productBatches.companyId, companyId), inArray(productBatches.id, batchIds), isNull(productBatches.deletedAt)));
  }

  public async listSystemQuantities(companyId: string, warehouseId: string, productIds: string[], executor?: DbExecutor) {
    if (!productIds.length) {
      return [];
    }

    return this
      .getExecutor(executor)
      .select({
        productId: stockBalances.productId,
        batchId: stockBalances.batchId,
        systemQty: sql<string>`coalesce(sum(${stockBalances.availableQuantity}), 0)`
      })
      .from(stockBalances)
      .where(
        and(
          eq(stockBalances.companyId, companyId),
          eq(stockBalances.warehouseId, warehouseId),
          inArray(stockBalances.productId, productIds)
        )
      )
      .groupBy(stockBalances.productId, stockBalances.batchId);
  }

  public async createStockCheck(data: typeof stockChecks.$inferInsert, executor?: DbExecutor) {
    const [row] = await this.getExecutor(executor).insert(stockChecks).values(data).returning();
    return row ?? null;
  }

  public async updateStockCheck(
    companyId: string,
    stockCheckId: string,
    data: Partial<typeof stockChecks.$inferInsert>,
    executor?: DbExecutor
  ) {
    const [row] = await this
      .getExecutor(executor)
      .update(stockChecks)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(and(eq(stockChecks.companyId, companyId), eq(stockChecks.id, stockCheckId)))
      .returning();

    return row ?? null;
  }

  public async insertItems(data: Array<typeof stockCheckItems.$inferInsert>, executor?: DbExecutor) {
    if (!data.length) {
      return [];
    }

    return this.getExecutor(executor).insert(stockCheckItems).values(data).returning();
  }

  public async deleteItems(stockCheckId: string, executor?: DbExecutor) {
    await this.getExecutor(executor).delete(stockCheckItems).where(eq(stockCheckItems.stockCheckId, stockCheckId));
  }

  public async findById(companyId: string, stockCheckId: string, executor?: DbExecutor) {
    const [row] = await this
      .getExecutor(executor)
      .select()
      .from(stockChecks)
      .where(and(eq(stockChecks.companyId, companyId), eq(stockChecks.id, stockCheckId)))
      .limit(1);

    return row ?? null;
  }

  public async listItems(stockCheckId: string, executor?: DbExecutor) {
    return this
      .getExecutor(executor)
      .select({
        item: stockCheckItems,
        productName: products.name,
        productCode: products.productCode,
        sku: products.sku,
        batchNumber: productBatches.batchNumber,
        expiryDate: productBatches.expiryDate
      })
      .from(stockCheckItems)
      .innerJoin(products, eq(stockCheckItems.productId, products.id))
      .leftJoin(productBatches, eq(stockCheckItems.batchId, productBatches.id))
      .where(eq(stockCheckItems.stockCheckId, stockCheckId))
      .orderBy(asc(products.name), asc(products.productCode), asc(productBatches.batchNumber));
  }

  public async getDetail(companyId: string, stockCheckId: string, executor?: DbExecutor) {
    const approvedUsers = this.approvedUsers;
    const [check] = await this
      .getExecutor(executor)
      .select({
        check: stockChecks,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        checkedByName: users.fullName,
        approvedByName: approvedUsers.fullName
      })
      .from(stockChecks)
      .innerJoin(warehouses, eq(stockChecks.warehouseId, warehouses.id))
      .leftJoin(users, eq(stockChecks.checkedByUserId, users.id))
      .leftJoin(approvedUsers, eq(stockChecks.approvedByUserId, approvedUsers.id))
      .where(and(eq(stockChecks.companyId, companyId), eq(stockChecks.id, stockCheckId)))
      .limit(1);

    if (!check) {
      return null;
    }

    const items = await this.listItems(stockCheckId, executor);
    return {
      ...check,
      items
    };
  }

  public async list(params: ListStockChecksParams) {
    const approvedUsers = this.approvedUsers;
    const conditions = this.buildListConditions(params);
    const whereClause = and(...conditions);
    const rows = await db
      .select({
        check: stockChecks,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.warehouseCode,
        checkedByName: users.fullName,
        approvedByName: approvedUsers.fullName
      })
      .from(stockChecks)
      .innerJoin(warehouses, eq(stockChecks.warehouseId, warehouses.id))
      .leftJoin(users, eq(stockChecks.checkedByUserId, users.id))
      .leftJoin(approvedUsers, eq(stockChecks.approvedByUserId, approvedUsers.id))
      .where(whereClause)
      .orderBy(desc(stockChecks.checkDate), desc(stockChecks.createdAt))
      .limit(params.limit)
      .offset((params.page - 1) * params.limit);

    const [totalRow] = await db
      .select({ value: count() })
      .from(stockChecks)
      .innerJoin(warehouses, eq(stockChecks.warehouseId, warehouses.id))
      .leftJoin(users, eq(stockChecks.checkedByUserId, users.id))
      .where(whereClause);

    return {
      rows,
      total: totalRow?.value ?? 0
    };
  }

  public async getStockCheckSettings(companyId: string) {
    const [row] = await db
      .select({ settingValue: appSettings.settingValue })
      .from(appSettings)
      .where(and(eq(appSettings.companyId, companyId), eq(appSettings.settingKey, "stock_check_settings")))
      .limit(1);

    return row?.settingValue ?? null;
  }
}

export const stockCheckRepository = new StockCheckRepository();
