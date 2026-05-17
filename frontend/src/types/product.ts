export type ProductStatus = "active" | "inactive" | "deleted";
export type ProductMutableStatus = Exclude<ProductStatus, "deleted">;
export type ProductCategoryStatus = "active" | "inactive" | "deleted";
export type ProductUnitStatus = "active" | "inactive" | "deleted";
export type ProductType = "goods" | "service";
export type TaxType = "taxable" | "exempt" | "nil_rated" | "non_gst";
export type PriceTaxType = "inclusive" | "exclusive";
export type ProductSortBy = "name" | "salePrice" | "purchasePrice" | "createdAt" | "productCode";
export type SortOrder = "asc" | "desc";
export type ProductExportFormat = "csv" | "xlsx" | "pdf";
export type ProductPriceHistoryChangeType =
  | "purchase_price"
  | "sale_price"
  | "mrp"
  | "wholesale_price"
  | "minimum_sale_price"
  | "gst_rate"
  | "discount"
  | "pricing";

export interface ProductCategory {
  id: string;
  companyId: string;
  categoryCode: string;
  name: string;
  parentId: string | null;
  description: string | null;
  status: ProductCategoryStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProductUnit {
  id: string;
  companyId: string;
  name: string;
  symbol: string;
  decimalAllowed: boolean;
  baseUnitId: string | null;
  conversionRate: string | null;
  status: ProductUnitStatus;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProductPricePreview {
  baseSalePrice: string;
  gstAmount: string;
  cessAmount: string;
  finalSalePrice: string;
  marginAmount: string;
  marginPercentage: string;
  markupPercentage: string;
}

export interface ProductCategoryRef {
  id: string;
  name: string | null;
}

export interface ProductUnitRef {
  id: string;
  name: string | null;
  symbol: string | null;
}

export interface Product {
  id: string;
  companyId: string;
  productCode: string;
  productType: ProductType;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: ProductCategoryRef;
  unit: ProductUnitRef;
  brand: string | null;
  description: string | null;
  hsnSacCode: string | null;
  taxType: TaxType;
  gstRate: string;
  cessRate: string;
  priceTaxType: PriceTaxType;
  purchasePrice: string;
  salePrice: string;
  mrp: string;
  wholesalePrice: string;
  minimumSalePrice: string;
  defaultDiscount: string;
  marginPercentage: string;
  markupPercentage: string;
  stockTrackingEnabled: boolean;
  openingStockQuantity: string;
  openingStockRate: string;
  openingStockValue: string;
  minimumStockLevel: string;
  reorderLevel: string;
  maximumStockLevel: string;
  batchTrackingEnabled: boolean;
  expiryTrackingEnabled: boolean;
  serialTrackingEnabled: boolean;
  negativeStockAllowed: boolean;
  status: ProductStatus;
  pricePreview: ProductPricePreview;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ProductListItem {
  id: string;
  productCode: string;
  productType: ProductType;
  name: string;
  sku: string | null;
  barcode: string | null;
  category: ProductCategoryRef;
  unit: ProductUnitRef;
  brand: string | null;
  hsnSacCode: string | null;
  taxType: TaxType;
  gstRate: string;
  cessRate: string;
  priceTaxType: PriceTaxType;
  purchasePrice: string;
  salePrice: string;
  mrp: string;
  wholesalePrice: string;
  minimumSalePrice: string;
  defaultDiscount: string;
  marginPercentage: string;
  markupPercentage: string;
  stockTrackingEnabled: boolean;
  openingStockQuantity: string;
  minimumStockLevel: string;
  reorderLevel: string;
  maximumStockLevel: string;
  status: ProductStatus;
  pricePreview: ProductPricePreview;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFormInput {
  productType: ProductType;
  name: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string;
  unitId: string;
  brand: string | null;
  description: string | null;
  hsnSacCode: string | null;
  taxType: TaxType;
  gstRate: number;
  cessRate: number;
  priceTaxType: PriceTaxType;
  purchasePrice: number;
  salePrice: number;
  mrp: number;
  wholesalePrice: number;
  minimumSalePrice: number;
  defaultDiscount: number;
  stockTrackingEnabled: boolean;
  openingStockQuantity: number;
  openingStockRate: number;
  minimumStockLevel: number;
  reorderLevel: number;
  maximumStockLevel: number;
  batchTrackingEnabled: boolean;
  expiryTrackingEnabled: boolean;
  serialTrackingEnabled: boolean;
  negativeStockAllowed: boolean;
  status: ProductMutableStatus;
}

export type ProductCreatePayload = ProductFormInput;
export type ProductUpdatePayload = ProductFormInput;

export interface ProductListQuery {
  page: number;
  limit: number;
  search?: string;
  productType?: ProductType;
  categoryId?: string;
  unitId?: string;
  gstRate?: number;
  status?: ProductStatus;
  stockTrackingEnabled?: boolean;
  lowStock?: boolean;
  taxType?: TaxType;
  sortBy?: ProductSortBy;
  sortOrder?: SortOrder;
}

export interface ProductListResponse {
  items: ProductListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductDetailResponse {
  product: Product;
}

export interface ProductLookupItem {
  id: string;
  name: string;
  productCode: string;
  sku: string | null;
  barcode: string | null;
  salePrice: string;
  purchasePrice: string;
  gstRate: string;
  unit: {
    name: string | null;
    symbol: string | null;
  };
  type: ProductType;
  stockTrackingEnabled: boolean;
}

export interface ProductLookupResponse extends Array<ProductLookupItem> {}

export interface ProductPriceHistorySnapshot {
  taxType: TaxType;
  gstRate: string;
  cessRate: string;
  priceTaxType: PriceTaxType;
  purchasePrice: string;
  salePrice: string;
  mrp: string;
  wholesalePrice: string;
  minimumSalePrice: string;
  defaultDiscount: string;
  marginPercentage: string;
  markupPercentage: string;
}

export interface ProductPriceHistory {
  id: string;
  changeType: ProductPriceHistoryChangeType;
  oldValue: string | null;
  newValue: string | null;
  oldSnapshot: ProductPriceHistorySnapshot | null;
  newSnapshot: ProductPriceHistorySnapshot | null;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
}

export interface ProductPriceHistoryResponse {
  items: ProductPriceHistory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductStockSummary {
  productId: string;
  stockTrackingEnabled: boolean;
  openingStockQuantity: string;
  openingStockRate: string;
  openingStockValue: string;
  availableQuantity: string;
  reservedQuantity: string;
  incomingQuantity: string;
  minimumStockLevel: string;
  reorderLevel: string;
  maximumStockLevel: string;
  batchTrackingEnabled: boolean;
  expiryTrackingEnabled: boolean;
  serialTrackingEnabled: boolean;
  negativeStockAllowed: boolean;
  inventoryModuleReady: boolean;
}

export interface ProductCategoryListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: ProductCategoryStatus;
  parentId?: string;
}

export interface ProductCategoryListResponse {
  items: ProductCategory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductCategoryFormInput {
  name: string;
  parentId: string | null;
  description: string | null;
  status: Exclude<ProductCategoryStatus, "deleted">;
}

export interface ProductUnitListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: ProductUnitStatus;
  decimalAllowed?: boolean;
}

export interface ProductUnitListResponse {
  items: ProductUnit[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductUnitFormInput {
  name: string;
  symbol: string;
  decimalAllowed: boolean;
  baseUnitId: string | null;
  conversionRate: number | null;
  status: Exclude<ProductUnitStatus, "deleted">;
}

export interface DownloadFileResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}
