import type {
  PriceTaxType,
  ProductCategoryStatus,
  ProductMutableStatus,
  ProductPriceHistoryChangeType,
  ProductSortBy,
  ProductStatus,
  ProductType,
  ProductUnitStatus,
  SortOrder,
  TaxType,
} from "../../types/product";

export const GST_RATE_OPTIONS = [0, 0.25, 3, 5, 12, 18, 28] as const;

export const PRODUCT_TYPE_OPTIONS: Array<{ value: ProductType | ""; label: string }> = [
  { value: "", label: "All Types" },
  { value: "goods", label: "Goods" },
  { value: "service", label: "Service" },
];

export const FORM_PRODUCT_TYPE_OPTIONS: Array<{ value: ProductType; label: string }> = PRODUCT_TYPE_OPTIONS.filter(
  (option): option is { value: ProductType; label: string } => option.value !== "",
);

export const PRODUCT_STATUS_OPTIONS: Array<{ value: ProductStatus | ""; label: string }> = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "deleted", label: "Deleted" },
];

export const PRODUCT_MUTABLE_STATUS_OPTIONS: Array<{ value: ProductMutableStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const TAX_TYPE_OPTIONS: Array<{ value: TaxType | ""; label: string }> = [
  { value: "", label: "All Tax Types" },
  { value: "taxable", label: "Taxable" },
  { value: "exempt", label: "Exempt" },
  { value: "nil_rated", label: "Nil Rated" },
  { value: "non_gst", label: "Non GST" },
];

export const FORM_TAX_TYPE_OPTIONS: Array<{ value: TaxType; label: string }> = TAX_TYPE_OPTIONS.filter(
  (option): option is { value: TaxType; label: string } => option.value !== "",
);

export const PRICE_TAX_TYPE_OPTIONS: Array<{ value: PriceTaxType; label: string }> = [
  { value: "exclusive", label: "Exclusive" },
  { value: "inclusive", label: "Inclusive" },
];

export const BOOLEAN_FILTER_OPTIONS = {
  stockTracking: [
    { value: "", label: "All Stock Tracking" },
    { value: "true", label: "Tracking On" },
    { value: "false", label: "Tracking Off" },
  ],
  lowStock: [
    { value: "", label: "All Stock Level" },
    { value: "true", label: "Low Stock" },
    { value: "false", label: "Normal Stock" },
  ],
  decimalAllowed: [
    { value: "", label: "All Decimal" },
    { value: "true", label: "Decimals Allowed" },
    { value: "false", label: "Whole Numbers" },
  ],
} as const;

export const SORT_BY_OPTIONS: Array<{ value: ProductSortBy; label: string }> = [
  { value: "createdAt", label: "Created Date" },
  { value: "name", label: "Name" },
  { value: "productCode", label: "Product Code" },
  { value: "salePrice", label: "Sale Price" },
  { value: "purchasePrice", label: "Purchase Price" },
];

export const SORT_ORDER_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: "desc", label: "Newest First" },
  { value: "asc", label: "Oldest First" },
];

export const CATEGORY_STATUS_OPTIONS: Array<{ value: ProductCategoryStatus | ""; label: string }> = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "deleted", label: "Deleted" },
];

export const FORM_CATEGORY_STATUS_OPTIONS: Array<{ value: Exclude<ProductCategoryStatus, "deleted">; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const UNIT_STATUS_OPTIONS: Array<{ value: ProductUnitStatus | ""; label: string }> = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "deleted", label: "Deleted" },
];

export const FORM_UNIT_STATUS_OPTIONS: Array<{ value: Exclude<ProductUnitStatus, "deleted">; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  goods: "Goods",
  service: "Service",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  deleted: "Deleted",
};

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  taxable: "Taxable",
  exempt: "Exempt",
  nil_rated: "Nil Rated",
  non_gst: "Non GST",
};

export const PRICE_TAX_TYPE_LABELS: Record<PriceTaxType, string> = {
  exclusive: "Exclusive",
  inclusive: "Inclusive",
};

export const PRODUCT_PRICE_HISTORY_CHANGE_TYPE_LABELS: Record<ProductPriceHistoryChangeType, string> = {
  purchase_price: "Purchase Price",
  sale_price: "Sale Price",
  mrp: "MRP",
  wholesale_price: "Wholesale Price",
  minimum_sale_price: "Minimum Sale Price",
  gst_rate: "GST Rate",
  discount: "Discount",
  pricing: "Pricing",
};
