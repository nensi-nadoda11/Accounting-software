import { db } from "../../db";
import { productCategories, productUnits, products } from "../../db/schema";
import { auditLogService } from "../audit-logs/audit-log.service";
import { AppError } from "../../utils/app-error";
import { getPagination } from "../../utils/pagination";
import { buildReportFile } from "../reports/reports.export";
import type { ReportExportDataset } from "../reports/reports.types";
import { productsRepository } from "./products.repository";
import type {
  BarcodeRequestInput,
  CreateCategoryInput,
  CreateProductInput,
  CreateUnitInput,
  ExportProductsQuery,
  ListCategoriesQuery,
  ListProductsQuery,
  ListUnitsQuery,
  ProductLookupQuery,
  ProductPriceHistoryQuery,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateUnitInput
} from "./products.validator";
import type {
  ProductActor,
  ProductExportPayload,
  ProductPricePreview,
  ProductRequestContext,
  ProductType
} from "./products.types";
import { buildPricePreview, calculateMargin, calculateMarkup, compareDecimals, multiplyScaled, normalizeMoney, normalizeQuantity, normalizeRate } from "./products.utils";

type ProductRecord = typeof products.$inferSelect;
type ProductCategoryRecord = typeof productCategories.$inferSelect;
type ProductUnitRecord = typeof productUnits.$inferSelect;

type ResolvedProductState = {
  name: string;
  productType: ProductType;
  sku: string | null;
  barcode: string | null;
  categoryId: string;
  unitId: string;
  brand: string | null;
  description: string | null;
  hsnSacCode: string | null;
  taxType: "taxable" | "exempt" | "nil_rated" | "non_gst";
  gstRate: string;
  cessRate: string;
  priceTaxType: "inclusive" | "exclusive";
  purchasePrice: string;
  salePrice: string;
  mrp: string;
  wholesalePrice: string;
  minimumSalePrice: string;
  defaultDiscount: string;
  stockTrackingEnabled: boolean;
  openingStockQuantity: string;
  openingStockRate: string;
  minimumStockLevel: string;
  reorderLevel: string;
  maximumStockLevel: string;
  batchTrackingEnabled: boolean;
  expiryTrackingEnabled: boolean;
  serialTrackingEnabled: boolean;
  negativeStockAllowed: boolean;
  status: "active" | "inactive";
};

type ProductStateInput = {
  name?: string | undefined;
  productType?: ProductType | undefined;
  sku?: string | null | undefined;
  barcode?: string | null | undefined;
  categoryId?: string | undefined;
  unitId?: string | undefined;
  brand?: string | null | undefined;
  description?: string | null | undefined;
  hsnSacCode?: string | null | undefined;
  taxType?: "taxable" | "exempt" | "nil_rated" | "non_gst" | undefined;
  priceTaxType?: "inclusive" | "exclusive" | undefined;
  stockTrackingEnabled?: boolean | undefined;
  batchTrackingEnabled?: boolean | undefined;
  expiryTrackingEnabled?: boolean | undefined;
  serialTrackingEnabled?: boolean | undefined;
  negativeStockAllowed?: boolean | undefined;
  status?: "active" | "inactive" | undefined;
  purchasePrice?: number | undefined;
  salePrice?: number | undefined;
  mrp?: number | undefined;
  wholesalePrice?: number | undefined;
  minimumSalePrice?: number | undefined;
  defaultDiscount?: number | undefined;
  openingStockQuantity?: number | undefined;
  openingStockRate?: number | undefined;
  minimumStockLevel?: number | undefined;
  reorderLevel?: number | undefined;
  maximumStockLevel?: number | undefined;
  gstRate?: number | undefined;
  cessRate?: number | undefined;
  purchasePriceText?: string | undefined;
  salePriceText?: string | undefined;
  mrpText?: string | undefined;
  wholesalePriceText?: string | undefined;
  minimumSalePriceText?: string | undefined;
  defaultDiscountText?: string | undefined;
  openingStockQuantityText?: string | undefined;
  openingStockRateText?: string | undefined;
  minimumStockLevelText?: string | undefined;
  reorderLevelText?: string | undefined;
  maximumStockLevelText?: string | undefined;
  gstRateText?: string | undefined;
  cessRateText?: string | undefined;
};

type PriceSnapshot = {
  taxType: string;
  gstRate: string;
  cessRate: string;
  priceTaxType: string;
  purchasePrice: string;
  salePrice: string;
  mrp: string;
  wholesalePrice: string;
  minimumSalePrice: string;
  defaultDiscount: string;
  marginPercentage: string;
  markupPercentage: string;
};

const pickDefined = <T extends Record<string, unknown>>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;

class ProductsService {
  private mapCategory(category: ProductCategoryRecord) {
    return {
      id: category.id,
      companyId: category.companyId,
      categoryCode: category.categoryCode,
      name: category.name,
      parentId: category.parentId,
      description: category.description,
      status: category.status,
      createdBy: category.createdBy,
      updatedBy: category.updatedBy,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      deletedAt: category.deletedAt
    };
  }

  private mapUnit(unit: ProductUnitRecord) {
    return {
      id: unit.id,
      companyId: unit.companyId,
      name: unit.name,
      symbol: unit.symbol,
      decimalAllowed: unit.decimalAllowed,
      baseUnitId: unit.baseUnitId,
      conversionRate: unit.conversionRate ? normalizeRate(unit.conversionRate, 4) : null,
      status: unit.status,
      createdBy: unit.createdBy,
      updatedBy: unit.updatedBy,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
      deletedAt: unit.deletedAt
    };
  }

  private buildPriceSnapshot(product: Pick<
    ProductRecord,
    | "taxType"
    | "gstRate"
    | "cessRate"
    | "priceTaxType"
    | "purchasePrice"
    | "salePrice"
    | "mrp"
    | "wholesalePrice"
    | "minimumSalePrice"
    | "defaultDiscount"
    | "marginPercentage"
    | "markupPercentage"
  >): PriceSnapshot {
    return {
      taxType: product.taxType,
      gstRate: normalizeRate(product.gstRate),
      cessRate: normalizeRate(product.cessRate),
      priceTaxType: product.priceTaxType,
      purchasePrice: normalizeMoney(product.purchasePrice),
      salePrice: normalizeMoney(product.salePrice),
      mrp: normalizeMoney(product.mrp),
      wholesalePrice: normalizeMoney(product.wholesalePrice),
      minimumSalePrice: normalizeMoney(product.minimumSalePrice),
      defaultDiscount: normalizeRate(product.defaultDiscount),
      marginPercentage: normalizeRate(product.marginPercentage),
      markupPercentage: normalizeRate(product.markupPercentage)
    };
  }

  private buildProductPreview(product: Pick<
    ProductRecord,
    "salePrice" | "purchasePrice" | "gstRate" | "cessRate" | "taxType" | "priceTaxType"
  >): ProductPricePreview {
    return buildPricePreview({
      salePrice: normalizeMoney(product.salePrice),
      purchasePrice: normalizeMoney(product.purchasePrice),
      gstRate: normalizeRate(product.gstRate),
      cessRate: normalizeRate(product.cessRate),
      taxType: product.taxType,
      priceTaxType: product.priceTaxType
    });
  }

  private mapProduct(
    row: {
      product: ProductRecord;
      categoryName: string | null;
      unitName: string | null;
      unitSymbol: string | null;
    }
  ) {
    const preview = this.buildProductPreview(row.product);

    return {
      id: row.product.id,
      companyId: row.product.companyId,
      productCode: row.product.productCode,
      productType: row.product.productType,
      name: row.product.name,
      sku: row.product.sku,
      barcode: row.product.barcode,
      category: {
        id: row.product.categoryId,
        name: row.categoryName
      },
      unit: {
        id: row.product.unitId,
        name: row.unitName,
        symbol: row.unitSymbol
      },
      brand: row.product.brand,
      description: row.product.description,
      hsnSacCode: row.product.hsnSacCode,
      taxType: row.product.taxType,
      gstRate: normalizeRate(row.product.gstRate),
      cessRate: normalizeRate(row.product.cessRate),
      priceTaxType: row.product.priceTaxType,
      purchasePrice: normalizeMoney(row.product.purchasePrice),
      salePrice: normalizeMoney(row.product.salePrice),
      mrp: normalizeMoney(row.product.mrp),
      wholesalePrice: normalizeMoney(row.product.wholesalePrice),
      minimumSalePrice: normalizeMoney(row.product.minimumSalePrice),
      defaultDiscount: normalizeRate(row.product.defaultDiscount),
      marginPercentage: normalizeRate(row.product.marginPercentage),
      markupPercentage: normalizeRate(row.product.markupPercentage),
      stockTrackingEnabled: row.product.stockTrackingEnabled,
      openingStockQuantity: normalizeQuantity(row.product.openingStockQuantity),
      openingStockRate: normalizeMoney(row.product.openingStockRate),
      openingStockValue: normalizeMoney(row.product.openingStockValue),
      minimumStockLevel: normalizeQuantity(row.product.minimumStockLevel),
      reorderLevel: normalizeQuantity(row.product.reorderLevel),
      maximumStockLevel: normalizeQuantity(row.product.maximumStockLevel),
      batchTrackingEnabled: row.product.batchTrackingEnabled,
      expiryTrackingEnabled: row.product.expiryTrackingEnabled,
      serialTrackingEnabled: row.product.serialTrackingEnabled,
      negativeStockAllowed: row.product.negativeStockAllowed,
      status: row.product.status,
      pricePreview: preview,
      createdBy: row.product.createdBy,
      updatedBy: row.product.updatedBy,
      createdAt: row.product.createdAt,
      updatedAt: row.product.updatedAt,
      deletedAt: row.product.deletedAt
    };
  }

  private getDefaultProductState(): ResolvedProductState {
    return {
      name: "",
      productType: "goods",
      sku: null,
      barcode: null,
      categoryId: "",
      unitId: "",
      brand: null,
      description: null,
      hsnSacCode: null,
      taxType: "taxable",
      gstRate: "0.00",
      cessRate: "0.00",
      priceTaxType: "exclusive",
      purchasePrice: "0.00",
      salePrice: "0.00",
      mrp: "0.00",
      wholesalePrice: "0.00",
      minimumSalePrice: "0.00",
      defaultDiscount: "0.00",
      stockTrackingEnabled: false,
      openingStockQuantity: "0.000",
      openingStockRate: "0.00",
      minimumStockLevel: "0.000",
      reorderLevel: "0.000",
      maximumStockLevel: "0.000",
      batchTrackingEnabled: false,
      expiryTrackingEnabled: false,
      serialTrackingEnabled: false,
      negativeStockAllowed: false,
      status: "active"
    };
  }

  private buildStateFromProduct(product: ProductRecord): ResolvedProductState {
    return {
      name: product.name,
      productType: product.productType,
      sku: product.sku,
      barcode: product.barcode,
      categoryId: product.categoryId,
      unitId: product.unitId,
      brand: product.brand,
      description: product.description,
      hsnSacCode: product.hsnSacCode,
      taxType: product.taxType,
      gstRate: normalizeRate(product.gstRate),
      cessRate: normalizeRate(product.cessRate),
      priceTaxType: product.priceTaxType,
      purchasePrice: normalizeMoney(product.purchasePrice),
      salePrice: normalizeMoney(product.salePrice),
      mrp: normalizeMoney(product.mrp),
      wholesalePrice: normalizeMoney(product.wholesalePrice),
      minimumSalePrice: normalizeMoney(product.minimumSalePrice),
      defaultDiscount: normalizeRate(product.defaultDiscount),
      stockTrackingEnabled: product.stockTrackingEnabled,
      openingStockQuantity: normalizeQuantity(product.openingStockQuantity),
      openingStockRate: normalizeMoney(product.openingStockRate),
      minimumStockLevel: normalizeQuantity(product.minimumStockLevel),
      reorderLevel: normalizeQuantity(product.reorderLevel),
      maximumStockLevel: normalizeQuantity(product.maximumStockLevel),
      batchTrackingEnabled: product.batchTrackingEnabled,
      expiryTrackingEnabled: product.expiryTrackingEnabled,
      serialTrackingEnabled: product.serialTrackingEnabled,
      negativeStockAllowed: product.negativeStockAllowed,
      status: product.status === "deleted" ? "inactive" : product.status
    };
  }

  private resolveProductState(input: ProductStateInput, baseState: ResolvedProductState): ResolvedProductState {
    const nextState = {
      ...baseState,
      ...pickDefined({
        name: input.name,
        productType: input.productType,
        sku: input.sku,
        barcode: input.barcode,
        categoryId: input.categoryId,
        unitId: input.unitId,
        brand: input.brand,
        description: input.description,
        hsnSacCode: input.hsnSacCode,
        taxType: input.taxType,
        gstRate:
          input.gstRate !== undefined
            ? normalizeRate(input.gstRate)
            : input.gstRateText !== undefined
              ? input.gstRateText
              : undefined,
        cessRate:
          input.cessRate !== undefined
            ? normalizeRate(input.cessRate)
            : input.cessRateText !== undefined
              ? input.cessRateText
              : undefined,
        priceTaxType: input.priceTaxType,
        purchasePrice:
          input.purchasePrice !== undefined
            ? normalizeMoney(input.purchasePrice)
            : input.purchasePriceText !== undefined
              ? input.purchasePriceText
              : undefined,
        salePrice:
          input.salePrice !== undefined
            ? normalizeMoney(input.salePrice)
            : input.salePriceText !== undefined
              ? input.salePriceText
              : undefined,
        mrp:
          input.mrp !== undefined ? normalizeMoney(input.mrp) : input.mrpText !== undefined ? input.mrpText : undefined,
        wholesalePrice:
          input.wholesalePrice !== undefined
            ? normalizeMoney(input.wholesalePrice)
            : input.wholesalePriceText !== undefined
              ? input.wholesalePriceText
              : undefined,
        minimumSalePrice:
          input.minimumSalePrice !== undefined
            ? normalizeMoney(input.minimumSalePrice)
            : input.minimumSalePriceText !== undefined
              ? input.minimumSalePriceText
              : undefined,
        defaultDiscount:
          input.defaultDiscount !== undefined
            ? normalizeRate(input.defaultDiscount)
            : input.defaultDiscountText !== undefined
              ? input.defaultDiscountText
              : undefined,
        stockTrackingEnabled: input.stockTrackingEnabled,
        openingStockQuantity:
          input.openingStockQuantity !== undefined
            ? normalizeQuantity(input.openingStockQuantity)
            : input.openingStockQuantityText !== undefined
              ? input.openingStockQuantityText
              : undefined,
        openingStockRate:
          input.openingStockRate !== undefined
            ? normalizeMoney(input.openingStockRate)
            : input.openingStockRateText !== undefined
              ? input.openingStockRateText
              : undefined,
        minimumStockLevel:
          input.minimumStockLevel !== undefined
            ? normalizeQuantity(input.minimumStockLevel)
            : input.minimumStockLevelText !== undefined
              ? input.minimumStockLevelText
              : undefined,
        reorderLevel:
          input.reorderLevel !== undefined
            ? normalizeQuantity(input.reorderLevel)
            : input.reorderLevelText !== undefined
              ? input.reorderLevelText
              : undefined,
        maximumStockLevel:
          input.maximumStockLevel !== undefined
            ? normalizeQuantity(input.maximumStockLevel)
            : input.maximumStockLevelText !== undefined
              ? input.maximumStockLevelText
              : undefined,
        batchTrackingEnabled: input.batchTrackingEnabled,
        expiryTrackingEnabled: input.expiryTrackingEnabled,
        serialTrackingEnabled: input.serialTrackingEnabled,
        negativeStockAllowed: input.negativeStockAllowed,
        status: input.status
      })
    } as ResolvedProductState;

    if (nextState.taxType !== "taxable") {
      nextState.gstRate = "0.00";
      nextState.cessRate = "0.00";
    }

    if (nextState.expiryTrackingEnabled) {
      nextState.batchTrackingEnabled = true;
    }

    if (nextState.productType === "service") {
      nextState.stockTrackingEnabled = false;
      nextState.openingStockQuantity = "0.000";
      nextState.openingStockRate = "0.00";
      nextState.minimumStockLevel = "0.000";
      nextState.reorderLevel = "0.000";
      nextState.maximumStockLevel = "0.000";
      nextState.batchTrackingEnabled = false;
      nextState.expiryTrackingEnabled = false;
      nextState.serialTrackingEnabled = false;
      nextState.negativeStockAllowed = false;
    }

    return nextState;
  }

  private assertProductState(
    state: ResolvedProductState,
    taxSettings: { gstEnabled: boolean; hsnSacEnabled: boolean } | null
  ) {
    if (state.name.trim().length < 2) {
      throw new AppError("Product name must be at least 2 characters long", 400);
    }

    if (!/[\p{L}\p{N}]/u.test(state.name)) {
      throw new AppError("Product name must contain letters or numbers", 400);
    }

    if ((taxSettings?.gstEnabled || taxSettings?.hsnSacEnabled) && !state.hsnSacCode) {
      throw new AppError("HSN/SAC code is required when company GST is enabled", 400);
    }

    if (state.hsnSacCode && !/^\d{4,8}$/.test(state.hsnSacCode)) {
      throw new AppError("HSN/SAC code must be 4 to 8 digits", 400);
    }

    if (compareDecimals(state.salePrice, state.minimumSalePrice, 2) < 0) {
      throw new AppError("Sale price must be greater than or equal to minimum sale price", 400);
    }

    if (compareDecimals(state.mrp, state.salePrice, 2) < 0) {
      throw new AppError("MRP must be greater than or equal to sale price", 400);
    }

    if (compareDecimals(state.reorderLevel, state.minimumStockLevel, 3) < 0) {
      throw new AppError("Reorder level must be greater than or equal to minimum stock level", 400);
    }

    if (
      compareDecimals(state.maximumStockLevel, "0", 3) > 0 &&
      compareDecimals(state.maximumStockLevel, state.reorderLevel, 3) < 0
    ) {
      throw new AppError("Maximum stock level must be greater than or equal to reorder level", 400);
    }
  }

  private buildNextCategoryCode(previousCode: string | null) {
    const lastSequence = previousCode ? Number(previousCode.replace("CAT-", "")) : 0;
    return `CAT-${String((Number.isFinite(lastSequence) ? lastSequence : 0) + 1).padStart(6, "0")}`;
  }

  private buildNextProductCode(previousCode: string | null, productType: ProductType) {
    const prefix = productType === "goods" ? "PROD" : "SERV";
    const lastSequence = previousCode ? Number(previousCode.replace(`${prefix}-`, "")) : 0;
    return `${prefix}-${String((Number.isFinite(lastSequence) ? lastSequence : 0) + 1).padStart(6, "0")}`;
  }

  private buildGeneratedBarcode(previousBarcode: string | null) {
    const baseSequence = previousBarcode ? Number(previousBarcode) : 100000000000;
    const nextSequence = Number.isFinite(baseSequence) ? baseSequence + 1 : 100000000001;
    return String(nextSequence).padStart(12, "0").slice(-12);
  }

  private determineChangeType(previous: PriceSnapshot, next: PriceSnapshot) {
    const changedFields = Object.keys(next).filter(
      (key) => previous[key as keyof PriceSnapshot] !== next[key as keyof PriceSnapshot]
    );

    if (changedFields.length === 1) {
      const [field] = changedFields;
      const mapping: Record<string, typeof import("./products.types").PRODUCT_PRICE_HISTORY_CHANGE_TYPES[number]> = {
        purchasePrice: "purchase_price",
        salePrice: "sale_price",
        mrp: "mrp",
        wholesalePrice: "wholesale_price",
        minimumSalePrice: "minimum_sale_price",
        gstRate: "gst_rate",
        defaultDiscount: "discount"
      };

      if (field && mapping[field]) {
        return mapping[field];
      }
    }

    if (
      changedFields.includes("gstRate") ||
      changedFields.includes("cessRate") ||
      changedFields.includes("taxType") ||
      changedFields.includes("priceTaxType")
    ) {
      return "gst_rate";
    }

    if (changedFields.includes("defaultDiscount")) {
      return "discount";
    }

    return "pricing";
  }

  private async assertCategoryUsable(companyId: string, categoryId: string) {
    const category = await productsRepository.findCategoryById(companyId, categoryId);
    if (!category || category.status !== "active") {
      throw new AppError("Selected category was not found or is inactive", 400);
    }

    return category;
  }

  private async assertUnitUsable(companyId: string, unitId: string) {
    const unit = await productsRepository.findUnitById(companyId, unitId);
    if (!unit || unit.status !== "active") {
      throw new AppError("Selected unit was not found or is inactive", 400);
    }

    return unit;
  }

  private async assertUniqueProductFields(
    companyId: string,
    state: Pick<ResolvedProductState, "sku" | "barcode">,
    excludeId?: string,
    executor?: Parameters<Parameters<typeof db.transaction>[0]>[0]
  ) {
    const [skuOwner, barcodeOwner] = await Promise.all([
      state.sku ? productsRepository.findProductBySku(companyId, state.sku, excludeId, executor) : Promise.resolve(null),
      state.barcode
        ? productsRepository.findProductByBarcode(companyId, state.barcode, excludeId, executor)
        : Promise.resolve(null)
    ]);

    if (skuOwner) {
      throw new AppError("A product with this SKU already exists", 409);
    }

    if (barcodeOwner) {
      throw new AppError("A product with this barcode already exists", 409);
    }
  }

  private async assertCategoryParent(companyId: string, categoryId: string | null, currentCategoryId?: string) {
    if (!categoryId) {
      return;
    }

    if (currentCategoryId && currentCategoryId === categoryId) {
      throw new AppError("Category cannot be its own parent", 400);
    }

    const parent = await productsRepository.findCategoryById(companyId, categoryId);
    if (!parent) {
      throw new AppError("Parent category not found", 400);
    }

    const visited = new Set<string>(currentCategoryId ? [currentCategoryId] : []);
    let currentParentId = parent.parentId;

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        throw new AppError("Circular category hierarchy is not allowed", 400);
      }

      visited.add(currentParentId);
      const nextParent = await productsRepository.findCategoryById(companyId, currentParentId, true);
      currentParentId = nextParent?.parentId ?? null;
    }
  }

  private async assertUnitBase(companyId: string, baseUnitId: string | null, currentUnitId?: string) {
    if (!baseUnitId) {
      return;
    }

    if (currentUnitId && currentUnitId === baseUnitId) {
      throw new AppError("Unit cannot reference itself as a base unit", 400);
    }

    const baseUnit = await productsRepository.findUnitById(companyId, baseUnitId);
    if (!baseUnit || baseUnit.status !== "active") {
      throw new AppError("Base unit was not found or is inactive", 400);
    }
  }

  private getProductOrThrow = async (companyId: string, productId: string, includeDeleted = false) => {
    const row = await productsRepository.findProductById(companyId, productId, includeDeleted);
    if (!row) {
      throw new AppError("Product not found", 404);
    }

    return row;
  };

  private getCategoryOrThrow = async (companyId: string, categoryId: string, includeDeleted = false) => {
    const row = await productsRepository.findCategoryById(companyId, categoryId, includeDeleted);
    if (!row) {
      throw new AppError("Category not found", 404);
    }

    return row;
  };

  private getUnitOrThrow = async (companyId: string, unitId: string, includeDeleted = false) => {
    const row = await productsRepository.findUnitById(companyId, unitId, includeDeleted);
    if (!row) {
      throw new AppError("Unit not found", 404);
    }

    return row;
  };

  public async listProducts(actor: Pick<ProductActor, "companyId">, query: ListProductsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const params: {
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
    } = {
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    };

    if (query.search !== undefined && query.search !== null) params.search = query.search;
    if (query.productType !== undefined) params.productType = query.productType;
    if (query.categoryId !== undefined) params.categoryId = query.categoryId;
    if (query.unitId !== undefined) params.unitId = query.unitId;
    if (query.gstRate !== undefined) params.gstRate = query.gstRate;
    if (query.status !== undefined) params.status = query.status;
    if (query.stockTrackingEnabled !== undefined) params.stockTrackingEnabled = query.stockTrackingEnabled;
    if (query.lowStock !== undefined) params.lowStock = query.lowStock;
    if (query.taxType !== undefined) params.taxType = query.taxType;

    const result = await productsRepository.listProducts(params);

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        productCode: row.productCode,
        productType: row.productType,
        name: row.name,
        sku: row.sku,
        barcode: row.barcode,
        category: {
          id: row.categoryId,
          name: row.categoryName
        },
        unit: {
          id: row.unitId,
          name: row.unitName,
          symbol: row.unitSymbol
        },
        brand: row.brand,
        hsnSacCode: row.hsnSacCode,
        taxType: row.taxType,
        gstRate: normalizeRate(row.gstRate),
        cessRate: normalizeRate(row.cessRate),
        priceTaxType: row.priceTaxType,
        purchasePrice: normalizeMoney(row.purchasePrice),
        salePrice: normalizeMoney(row.salePrice),
        mrp: normalizeMoney(row.mrp),
        wholesalePrice: normalizeMoney(row.wholesalePrice),
        minimumSalePrice: normalizeMoney(row.minimumSalePrice),
        defaultDiscount: normalizeRate(row.defaultDiscount),
        marginPercentage: normalizeRate(row.marginPercentage),
        markupPercentage: normalizeRate(row.markupPercentage),
        stockTrackingEnabled: row.stockTrackingEnabled,
        openingStockQuantity: normalizeQuantity(row.openingStockQuantity),
        minimumStockLevel: normalizeQuantity(row.minimumStockLevel),
        reorderLevel: normalizeQuantity(row.reorderLevel),
        maximumStockLevel: normalizeQuantity(row.maximumStockLevel),
        status: row.status,
        pricePreview: buildPricePreview({
          salePrice: normalizeMoney(row.salePrice),
          purchasePrice: normalizeMoney(row.purchasePrice),
          gstRate: normalizeRate(row.gstRate),
          cessRate: normalizeRate(row.cessRate),
          taxType: row.taxType,
          priceTaxType: row.priceTaxType
        }),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createProduct(actor: ProductActor, input: CreateProductInput, context: ProductRequestContext) {
    const taxSettings = await productsRepository.findCompanyTaxSettings(actor.companyId);
    const state = this.resolveProductState(input, this.getDefaultProductState());
    this.assertProductState(state, taxSettings);
    await Promise.all([
      this.assertCategoryUsable(actor.companyId, state.categoryId),
      this.assertUnitUsable(actor.companyId, state.unitId)
    ]);

    let createdProduct: ProductRecord | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        createdProduct = await db.transaction(async (transaction) => {
          const prefix = state.productType === "goods" ? "PROD" : "SERV";
          await productsRepository.acquireScopedLock(`product-code:${prefix}`, actor.companyId, transaction);
          const productCode = this.buildNextProductCode(
            await productsRepository.findLatestProductCode(actor.companyId, prefix, transaction),
            state.productType
          );
          const autoSku = state.sku ?? productCode;
          const resolvedSku =
            (await productsRepository.findProductBySku(actor.companyId, autoSku, undefined, transaction))
              ? `${productCode}-SKU`
              : autoSku;
          const preview = buildPricePreview({
            salePrice: state.salePrice,
            purchasePrice: state.purchasePrice,
            gstRate: state.gstRate,
            cessRate: state.cessRate,
            taxType: state.taxType,
            priceTaxType: state.priceTaxType
          });
          const openingStockValue =
            state.productType === "goods"
              ? multiplyScaled(state.openingStockQuantity, 3, state.openingStockRate, 2, 2)
              : "0.00";

          await this.assertUniqueProductFields(
            actor.companyId,
            {
              sku: resolvedSku,
              barcode: state.barcode
            },
            undefined,
            transaction
          );

          const margin = calculateMargin(preview.baseSalePrice, state.purchasePrice);
          const markupPercentage = calculateMarkup(state.purchasePrice, preview.baseSalePrice);
          const created = await productsRepository.createProduct(
            {
              companyId: actor.companyId,
              productCode,
              productType: state.productType,
              name: state.name,
              sku: resolvedSku,
              barcode: state.barcode,
              categoryId: state.categoryId,
              unitId: state.unitId,
              brand: state.brand,
              description: state.description,
              hsnSacCode: state.hsnSacCode,
              taxType: state.taxType,
              gstRate: state.gstRate,
              cessRate: state.cessRate,
              priceTaxType: state.priceTaxType,
              purchasePrice: state.purchasePrice,
              salePrice: state.salePrice,
              mrp: state.mrp,
              wholesalePrice: state.wholesalePrice,
              minimumSalePrice: state.minimumSalePrice,
              defaultDiscount: state.defaultDiscount,
              marginPercentage: margin.marginPercentage,
              markupPercentage,
              stockTrackingEnabled: state.stockTrackingEnabled,
              openingStockQuantity: state.openingStockQuantity,
              openingStockRate: state.openingStockRate,
              openingStockValue,
              minimumStockLevel: state.minimumStockLevel,
              reorderLevel: state.reorderLevel,
              maximumStockLevel: state.maximumStockLevel,
              batchTrackingEnabled: state.batchTrackingEnabled,
              expiryTrackingEnabled: state.expiryTrackingEnabled,
              serialTrackingEnabled: state.serialTrackingEnabled,
              negativeStockAllowed: state.negativeStockAllowed,
              status: state.status,
              createdBy: actor.id,
              updatedBy: actor.id
            },
            transaction
          );

          if (!created) {
            throw new AppError("Failed to create product", 500);
          }

          await productsRepository.createPriceHistory(
            {
              companyId: actor.companyId,
              productId: created.id,
              changeType: "pricing",
              oldValue: null,
              newValue: state.salePrice,
              oldSnapshot: {},
              newSnapshot: this.buildPriceSnapshot(created),
              changedBy: actor.id
            },
            transaction
          );

          return created;
        });

        break;
      } catch (error) {
        const databaseError = error as { code?: string; constraint?: string };
        if (
          attempt < 2 &&
          databaseError?.code === "23505" &&
          databaseError.constraint === "products_company_product_code_unique_idx"
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!createdProduct) {
      throw new AppError("Failed to create product", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "product_created",
      entityType: "product",
      entityId: createdProduct.id,
      metadata: {
        productCode: createdProduct.productCode,
        productType: createdProduct.productType,
        stockTrackingEnabled: createdProduct.stockTrackingEnabled
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    const createdRow = await this.getProductOrThrow(actor.companyId, createdProduct.id);
    return {
      product: this.mapProduct(createdRow)
    };
  }

  public async getProduct(actor: Pick<ProductActor, "companyId">, productId: string) {
    const row = await this.getProductOrThrow(actor.companyId, productId);
    return {
      product: this.mapProduct(row)
    };
  }

  public async updateProduct(
    actor: ProductActor,
    productId: string,
    input: UpdateProductInput,
    context: ProductRequestContext
  ) {
    const existing = await this.getProductOrThrow(actor.companyId, productId, true);
    if (existing.product.deletedAt || existing.product.status === "deleted") {
      throw new AppError("Deleted products cannot be updated", 400);
    }

    const taxSettings = await productsRepository.findCompanyTaxSettings(actor.companyId);
    const previousState = this.buildStateFromProduct(existing.product);
    const nextState = this.resolveProductState(input, previousState);
    this.assertProductState(nextState, taxSettings);
    await Promise.all([
      this.assertCategoryUsable(actor.companyId, nextState.categoryId),
      this.assertUnitUsable(actor.companyId, nextState.unitId)
    ]);

    const previousSnapshot = this.buildPriceSnapshot(existing.product);
    const preview = buildPricePreview({
      salePrice: nextState.salePrice,
      purchasePrice: nextState.purchasePrice,
      gstRate: nextState.gstRate,
      cessRate: nextState.cessRate,
      taxType: nextState.taxType,
      priceTaxType: nextState.priceTaxType
    });
    const margin = calculateMargin(preview.baseSalePrice, nextState.purchasePrice);
    const markupPercentage = calculateMarkup(nextState.purchasePrice, preview.baseSalePrice);
    const openingStockValue =
      nextState.productType === "goods"
        ? multiplyScaled(nextState.openingStockQuantity, 3, nextState.openingStockRate, 2, 2)
        : "0.00";

    const updatedProduct = await db.transaction(async (transaction) => {
      await this.assertUniqueProductFields(
        actor.companyId,
        {
          sku: nextState.sku,
          barcode: nextState.barcode
        },
        productId,
        transaction
      );

      const updated = await productsRepository.updateProduct(
        actor.companyId,
        productId,
        {
          name: nextState.name,
          productType: nextState.productType,
          sku: nextState.sku ?? existing.product.sku,
          barcode: nextState.barcode,
          categoryId: nextState.categoryId,
          unitId: nextState.unitId,
          brand: nextState.brand,
          description: nextState.description,
          hsnSacCode: nextState.hsnSacCode,
          taxType: nextState.taxType,
          gstRate: nextState.gstRate,
          cessRate: nextState.cessRate,
          priceTaxType: nextState.priceTaxType,
          purchasePrice: nextState.purchasePrice,
          salePrice: nextState.salePrice,
          mrp: nextState.mrp,
          wholesalePrice: nextState.wholesalePrice,
          minimumSalePrice: nextState.minimumSalePrice,
          defaultDiscount: nextState.defaultDiscount,
          marginPercentage: margin.marginPercentage,
          markupPercentage,
          stockTrackingEnabled: nextState.stockTrackingEnabled,
          openingStockQuantity: nextState.openingStockQuantity,
          openingStockRate: nextState.openingStockRate,
          openingStockValue,
          minimumStockLevel: nextState.minimumStockLevel,
          reorderLevel: nextState.reorderLevel,
          maximumStockLevel: nextState.maximumStockLevel,
          batchTrackingEnabled: nextState.batchTrackingEnabled,
          expiryTrackingEnabled: nextState.expiryTrackingEnabled,
          serialTrackingEnabled: nextState.serialTrackingEnabled,
          negativeStockAllowed: nextState.negativeStockAllowed,
          status: nextState.status,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to update product", 500);
      }

      const nextSnapshot = this.buildPriceSnapshot(updated);
      const priceChanged = Object.keys(nextSnapshot).some(
        (key) => previousSnapshot[key as keyof PriceSnapshot] !== nextSnapshot[key as keyof PriceSnapshot]
      );

      if (priceChanged) {
        await productsRepository.createPriceHistory(
          {
            companyId: actor.companyId,
            productId: updated.id,
            changeType: this.determineChangeType(previousSnapshot, nextSnapshot),
            oldValue: previousSnapshot.salePrice,
            newValue: nextSnapshot.salePrice,
            oldSnapshot: previousSnapshot,
            newSnapshot: nextSnapshot,
            changedBy: actor.id
          },
          transaction
        );
      }

      return {
        updated,
        priceChanged,
        nextSnapshot
      };
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "product_updated",
      entityType: "product",
      entityId: updatedProduct.updated.id,
      metadata: {
        fields: Object.keys(input)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    if (updatedProduct.priceChanged) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "product_price_changed",
        entityType: "product",
        entityId: updatedProduct.updated.id,
        metadata: {
          snapshot: updatedProduct.nextSnapshot
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    if (
      previousSnapshot.gstRate !== updatedProduct.nextSnapshot.gstRate ||
      previousSnapshot.cessRate !== updatedProduct.nextSnapshot.cessRate ||
      previousSnapshot.taxType !== updatedProduct.nextSnapshot.taxType ||
      previousSnapshot.priceTaxType !== updatedProduct.nextSnapshot.priceTaxType
    ) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "product_gst_changed",
        entityType: "product",
        entityId: updatedProduct.updated.id,
        metadata: {
          previous: previousSnapshot,
          current: updatedProduct.nextSnapshot
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    const stockFieldsChanged = [
      "stockTrackingEnabled",
      "openingStockQuantity",
      "openingStockRate",
      "minimumStockLevel",
      "reorderLevel",
      "maximumStockLevel",
      "batchTrackingEnabled",
      "expiryTrackingEnabled",
      "serialTrackingEnabled",
      "negativeStockAllowed"
    ].some((field) => field in input);

    if (stockFieldsChanged) {
      await auditLogService.log({
        companyId: actor.companyId,
        userId: actor.id,
        action: "product_stock_settings_changed",
        entityType: "product",
        entityId: updatedProduct.updated.id,
        metadata: {
          stockTrackingEnabled: updatedProduct.updated.stockTrackingEnabled
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }

    const row = await this.getProductOrThrow(actor.companyId, updatedProduct.updated.id);
    return {
      product: this.mapProduct(row)
    };
  }

  public async deleteProduct(actor: ProductActor, productId: string, context: ProductRequestContext) {
    const existing = await this.getProductOrThrow(actor.companyId, productId, true);
    if (existing.product.deletedAt || existing.product.status === "deleted") {
      throw new AppError("Product is already deleted", 400);
    }

    const hasLinkedTransactions = await productsRepository.hasLinkedTransactions(actor.companyId, productId);
    const deleted = await productsRepository.softDeleteProduct(actor.companyId, productId, actor.id);
    if (!deleted) {
      throw new AppError("Failed to delete product", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "product_deleted",
      entityType: "product",
      entityId: deleted.id,
      metadata: {
        productCode: deleted.productCode,
        hadLinkedTransactions: hasLinkedTransactions
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async lookupProducts(actor: Pick<ProductActor, "companyId">, query: ProductLookupQuery) {
    const rows = await productsRepository.lookupProducts(actor.companyId, query.search ?? undefined, query.limit);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      productCode: row.productCode,
      sku: row.sku,
      barcode: row.barcode,
      salePrice: normalizeMoney(row.salePrice),
      purchasePrice: normalizeMoney(row.purchasePrice),
      gstRate: normalizeRate(row.gstRate),
      unit: {
        name: row.unitName,
        symbol: row.unitSymbol
      },
      type: row.productType,
      stockTrackingEnabled: row.stockTrackingEnabled
    }));
  }

  public async exportProducts(
    actor: ProductActor,
    query: ExportProductsQuery,
    context: ProductRequestContext
  ): Promise<ProductExportPayload> {
    const params: {
      companyId: string;
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
    } = {
      companyId: actor.companyId,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder
    };

    if (query.search !== undefined && query.search !== null) params.search = query.search;
    if (query.productType !== undefined) params.productType = query.productType;
    if (query.categoryId !== undefined) params.categoryId = query.categoryId;
    if (query.unitId !== undefined) params.unitId = query.unitId;
    if (query.gstRate !== undefined) params.gstRate = query.gstRate;
    if (query.status !== undefined) params.status = query.status;
    if (query.stockTrackingEnabled !== undefined) params.stockTrackingEnabled = query.stockTrackingEnabled;
    if (query.lowStock !== undefined) params.lowStock = query.lowStock;
    if (query.taxType !== undefined) params.taxType = query.taxType;

    const rows = await productsRepository.listProductsForExport(params);

    const dataset: ReportExportDataset = {
      title: "Products",
      columns: [
        { key: "productCode", label: "Product Code" },
        { key: "productType", label: "Type" },
        { key: "name", label: "Name" },
        { key: "sku", label: "SKU" },
        { key: "barcode", label: "Barcode" },
        { key: "category", label: "Category" },
        { key: "unit", label: "Unit" },
        { key: "brand", label: "Brand" },
        { key: "hsnSacCode", label: "HSN/SAC" },
        { key: "taxType", label: "Tax Type" },
        { key: "gstRate", label: "GST Rate", type: "number" },
        { key: "cessRate", label: "Cess Rate", type: "number" },
        { key: "priceTaxType", label: "Price Tax Type" },
        { key: "purchasePrice", label: "Purchase Price", type: "number" },
        { key: "salePrice", label: "Sale Price", type: "number" },
        { key: "finalSalePrice", label: "Final Sale Price", type: "number" },
        { key: "mrp", label: "MRP", type: "number" },
        { key: "wholesalePrice", label: "Wholesale Price", type: "number" },
        { key: "minimumSalePrice", label: "Minimum Sale Price", type: "number" },
        { key: "defaultDiscount", label: "Default Discount", type: "number" },
        { key: "openingStockQuantity", label: "Opening Stock Qty", type: "number" },
        { key: "openingStockValue", label: "Opening Stock Value", type: "number" },
        { key: "status", label: "Status" }
      ],
      rows: rows.map((row) => {
        const preview = this.buildProductPreview(row.product);

        return {
          productCode: row.product.productCode,
          productType: row.product.productType,
          name: row.product.name,
          sku: row.product.sku,
          barcode: row.product.barcode ?? "",
          category: row.categoryName ?? "",
          unit: row.unitSymbol ?? row.unitName ?? "",
          brand: row.product.brand ?? "",
          hsnSacCode: row.product.hsnSacCode ?? "",
          taxType: row.product.taxType,
          gstRate: normalizeRate(row.product.gstRate),
          cessRate: normalizeRate(row.product.cessRate),
          priceTaxType: row.product.priceTaxType,
          purchasePrice: normalizeMoney(row.product.purchasePrice),
          salePrice: normalizeMoney(row.product.salePrice),
          finalSalePrice: preview.finalSalePrice,
          mrp: normalizeMoney(row.product.mrp),
          wholesalePrice: normalizeMoney(row.product.wholesalePrice),
          minimumSalePrice: normalizeMoney(row.product.minimumSalePrice),
          defaultDiscount: normalizeRate(row.product.defaultDiscount),
          openingStockQuantity: normalizeQuantity(row.product.openingStockQuantity),
          openingStockValue: normalizeMoney(row.product.openingStockValue),
          status: row.product.status
        };
      })
    };
    const file = buildReportFile(dataset, query.format, `products-${new Date().toISOString().slice(0, 10)}`);

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "product_exported",
      entityType: "product",
      metadata: {
        format: query.format,
        rowCount: rows.length
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return file;
  }

  public async getPriceHistory(
    actor: Pick<ProductActor, "companyId">,
    productId: string,
    query: ProductPriceHistoryQuery
  ) {
    await this.getProductOrThrow(actor.companyId, productId);
    const pagination = getPagination(query.page, query.limit);
    const result = await productsRepository.listPriceHistory(actor.companyId, productId, pagination.page, pagination.limit);

    return {
      items: result.rows.map((row) => ({
        id: row.id,
        changeType: row.changeType,
        oldValue: row.oldValue ? normalizeMoney(row.oldValue) : null,
        newValue: row.newValue ? normalizeMoney(row.newValue) : null,
        oldSnapshot: row.oldSnapshot,
        newSnapshot: row.newSnapshot,
        reason: row.reason,
        changedBy: row.changedBy,
        createdAt: row.createdAt
      })),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async getStockSummary(actor: Pick<ProductActor, "companyId">, productId: string) {
    const row = await this.getProductOrThrow(actor.companyId, productId);
    const product = row.product;

    return {
      productId: product.id,
      stockTrackingEnabled: product.stockTrackingEnabled,
      openingStockQuantity: normalizeQuantity(product.openingStockQuantity),
      openingStockRate: normalizeMoney(product.openingStockRate),
      openingStockValue: normalizeMoney(product.openingStockValue),
      availableQuantity: normalizeQuantity(product.openingStockQuantity),
      reservedQuantity: "0.000",
      incomingQuantity: "0.000",
      minimumStockLevel: normalizeQuantity(product.minimumStockLevel),
      reorderLevel: normalizeQuantity(product.reorderLevel),
      maximumStockLevel: normalizeQuantity(product.maximumStockLevel),
      batchTrackingEnabled: product.batchTrackingEnabled,
      expiryTrackingEnabled: product.expiryTrackingEnabled,
      serialTrackingEnabled: product.serialTrackingEnabled,
      negativeStockAllowed: product.negativeStockAllowed,
      inventoryModuleReady: false
    };
  }

  public async generateBarcode(
    actor: ProductActor,
    productId: string,
    input: BarcodeRequestInput,
    context: ProductRequestContext
  ) {
    const existing = await this.getProductOrThrow(actor.companyId, productId, true);
    if (existing.product.deletedAt || existing.product.status === "deleted") {
      throw new AppError("Deleted products cannot be updated", 400);
    }

    if (existing.product.barcode && !input.replaceExisting) {
      return {
        product: this.mapProduct(existing)
      };
    }

    const updatedProduct = await db.transaction(async (transaction) => {
      await productsRepository.acquireScopedLock("product-barcode", actor.companyId, transaction);
      let barcode = this.buildGeneratedBarcode(
        await productsRepository.findLatestGeneratedBarcode(actor.companyId, transaction)
      );

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const owner = await productsRepository.findProductByBarcode(actor.companyId, barcode, productId, transaction);
        if (!owner) {
          break;
        }

        barcode = this.buildGeneratedBarcode(barcode);
      }

      const updated = await productsRepository.updateProduct(
        actor.companyId,
        productId,
        {
          barcode,
          updatedBy: actor.id
        },
        transaction
      );

      if (!updated) {
        throw new AppError("Failed to generate barcode", 500);
      }

      return updated;
    });

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "product_barcode_generated",
      entityType: "product",
      entityId: updatedProduct.id,
      metadata: {
        barcode: updatedProduct.barcode,
        replacedExisting: Boolean(existing.product.barcode)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    const row = await this.getProductOrThrow(actor.companyId, updatedProduct.id);
    return {
      product: this.mapProduct(row)
    };
  }

  public async listCategories(actor: Pick<ProductActor, "companyId">, query: ListCategoriesQuery) {
    const pagination = getPagination(query.page, query.limit);
    const params: {
      companyId: string;
      page: number;
      limit: number;
      search?: string;
      status?: "active" | "inactive" | "deleted";
      parentId?: string;
    } = {
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit,
    };

    if (query.search !== undefined && query.search !== null) params.search = query.search;
    if (query.status !== undefined) params.status = query.status;
    if (query.parentId !== undefined) params.parentId = query.parentId;

    const result = await productsRepository.listCategories(params);

    return {
      items: result.rows.map((row) => this.mapCategory(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createCategory(actor: ProductActor, input: CreateCategoryInput, context: ProductRequestContext) {
    await this.assertCategoryParent(actor.companyId, input.parentId ?? null);

    let createdCategory: ProductCategoryRecord | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        createdCategory = await db.transaction(async (transaction) => {
          const duplicate = await productsRepository.findCategoryByName(actor.companyId, input.name, undefined, transaction);
          if (duplicate) {
            throw new AppError("A category with this name already exists", 409);
          }

          await productsRepository.acquireScopedLock("category-code", actor.companyId, transaction);
          const categoryCode = this.buildNextCategoryCode(
            await productsRepository.findLatestCategoryCode(actor.companyId, transaction)
          );
          const created = await productsRepository.createCategory(
            {
              companyId: actor.companyId,
              categoryCode,
              name: input.name,
              parentId: input.parentId ?? null,
              description: input.description ?? null,
              status: input.status,
              createdBy: actor.id,
              updatedBy: actor.id
            },
            transaction
          );

          if (!created) {
            throw new AppError("Failed to create category", 500);
          }

          return created;
        });
        break;
      } catch (error) {
        const databaseError = error as { code?: string; constraint?: string };
        if (
          attempt < 2 &&
          databaseError?.code === "23505" &&
          databaseError.constraint === "product_categories_company_category_code_unique_idx"
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!createdCategory) {
      throw new AppError("Failed to create category", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "category_created",
      entityType: "product_category",
      entityId: createdCategory.id,
      metadata: {
        categoryCode: createdCategory.categoryCode,
        name: createdCategory.name
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      category: this.mapCategory(createdCategory)
    };
  }

  public async updateCategory(
    actor: ProductActor,
    categoryId: string,
    input: UpdateCategoryInput,
    context: ProductRequestContext
  ) {
    const existing = await this.getCategoryOrThrow(actor.companyId, categoryId, true);
    if (existing.deletedAt || existing.status === "deleted") {
      throw new AppError("Deleted categories cannot be updated", 400);
    }

    await this.assertCategoryParent(actor.companyId, input.parentId ?? existing.parentId, categoryId);

    if (input.name && input.name !== existing.name) {
      const duplicate = await productsRepository.findCategoryByName(actor.companyId, input.name, categoryId);
      if (duplicate) {
        throw new AppError("A category with this name already exists", 409);
      }
    }

    const updated = await productsRepository.updateCategory(actor.companyId, categoryId, {
      name: input.name ?? existing.name,
      parentId: input.parentId === undefined ? existing.parentId : input.parentId,
      description: input.description === undefined ? existing.description : input.description,
      status: input.status ?? existing.status,
      updatedBy: actor.id
    });

    if (!updated) {
      throw new AppError("Failed to update category", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "category_updated",
      entityType: "product_category",
      entityId: updated.id,
      metadata: {
        fields: Object.keys(input)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      category: this.mapCategory(updated)
    };
  }

  public async deleteCategory(actor: ProductActor, categoryId: string, context: ProductRequestContext) {
    const existing = await this.getCategoryOrThrow(actor.companyId, categoryId, true);
    if (existing.deletedAt || existing.status === "deleted") {
      throw new AppError("Category is already deleted", 400);
    }

    const activeProducts = await productsRepository.countActiveProductsByCategory(actor.companyId, categoryId);
    if (activeProducts > 0) {
      throw new AppError("Category cannot be deleted while active products are linked to it", 409);
    }

    const deleted = await productsRepository.softDeleteCategory(actor.companyId, categoryId, actor.id);
    if (!deleted) {
      throw new AppError("Failed to delete category", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "category_deleted",
      entityType: "product_category",
      entityId: deleted.id,
      metadata: {
        categoryCode: deleted.categoryCode
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }

  public async listUnits(actor: Pick<ProductActor, "companyId">, query: ListUnitsQuery) {
    const pagination = getPagination(query.page, query.limit);
    const params: {
      companyId: string;
      page: number;
      limit: number;
      search?: string;
      status?: "active" | "inactive" | "deleted";
      decimalAllowed?: boolean;
    } = {
      companyId: actor.companyId,
      page: pagination.page,
      limit: pagination.limit
    };

    if (query.search !== undefined && query.search !== null) params.search = query.search;
    if (query.status !== undefined) params.status = query.status;
    if (query.decimalAllowed !== undefined) params.decimalAllowed = query.decimalAllowed;

    const result = await productsRepository.listUnits(params);

    return {
      items: result.rows.map((row) => this.mapUnit(row)),
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit) || 1
      }
    };
  }

  public async createUnit(actor: ProductActor, input: CreateUnitInput, context: ProductRequestContext) {
    await this.assertUnitBase(actor.companyId, input.baseUnitId ?? null);
    const duplicate = await productsRepository.findUnitBySymbol(actor.companyId, input.symbol);
    if (duplicate) {
      throw new AppError("A unit with this symbol already exists", 409);
    }

    const created = await productsRepository.createUnit({
      companyId: actor.companyId,
      name: input.name,
      symbol: input.symbol,
      decimalAllowed: input.decimalAllowed,
      baseUnitId: input.baseUnitId ?? null,
      conversionRate: input.conversionRate === null || input.conversionRate === undefined ? null : normalizeRate(input.conversionRate, 4),
      status: input.status,
      createdBy: actor.id,
      updatedBy: actor.id
    });

    if (!created) {
      throw new AppError("Failed to create unit", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "unit_created",
      entityType: "product_unit",
      entityId: created.id,
      metadata: {
        symbol: created.symbol,
        name: created.name
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      unit: this.mapUnit(created)
    };
  }

  public async updateUnit(
    actor: ProductActor,
    unitId: string,
    input: UpdateUnitInput,
    context: ProductRequestContext
  ) {
    const existing = await this.getUnitOrThrow(actor.companyId, unitId, true);
    if (existing.deletedAt || existing.status === "deleted") {
      throw new AppError("Deleted units cannot be updated", 400);
    }

    await this.assertUnitBase(actor.companyId, input.baseUnitId ?? existing.baseUnitId, unitId);

    const nextSymbol = input.symbol ?? existing.symbol;
    if (nextSymbol !== existing.symbol) {
      const duplicate = await productsRepository.findUnitBySymbol(actor.companyId, nextSymbol, unitId);
      if (duplicate) {
        throw new AppError("A unit with this symbol already exists", 409);
      }
    }

    const updated = await productsRepository.updateUnit(actor.companyId, unitId, {
      name: input.name ?? existing.name,
      symbol: nextSymbol,
      decimalAllowed: input.decimalAllowed ?? existing.decimalAllowed,
      baseUnitId: input.baseUnitId === undefined ? existing.baseUnitId : input.baseUnitId,
      conversionRate:
        input.conversionRate === undefined
          ? existing.conversionRate
          : input.conversionRate === null
            ? null
            : normalizeRate(input.conversionRate, 4),
      status: input.status ?? existing.status,
      updatedBy: actor.id
    });

    if (!updated) {
      throw new AppError("Failed to update unit", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "unit_updated",
      entityType: "product_unit",
      entityId: updated.id,
      metadata: {
        fields: Object.keys(input)
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    return {
      unit: this.mapUnit(updated)
    };
  }

  public async deleteUnit(actor: ProductActor, unitId: string, context: ProductRequestContext) {
    const existing = await this.getUnitOrThrow(actor.companyId, unitId, true);
    if (existing.deletedAt || existing.status === "deleted") {
      throw new AppError("Unit is already deleted", 400);
    }

    const activeProducts = await productsRepository.countActiveProductsByUnit(actor.companyId, unitId);
    if (activeProducts > 0) {
      throw new AppError("Unit cannot be deleted while active products are linked to it", 409);
    }

    const deleted = await productsRepository.softDeleteUnit(actor.companyId, unitId, actor.id);
    if (!deleted) {
      throw new AppError("Failed to delete unit", 500);
    }

    await auditLogService.log({
      companyId: actor.companyId,
      userId: actor.id,
      action: "unit_deleted",
      entityType: "product_unit",
      entityId: deleted.id,
      metadata: {
        symbol: deleted.symbol
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
  }
}

export const productsService = new ProductsService();
