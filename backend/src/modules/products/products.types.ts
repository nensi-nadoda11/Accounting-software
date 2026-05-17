export const PRODUCT_TYPES = ["goods", "service"] as const;
export const PRODUCT_TAX_TYPES = ["taxable", "exempt", "nil_rated", "non_gst"] as const;
export const PRODUCT_PRICE_TAX_TYPES = ["inclusive", "exclusive"] as const;
export const PRODUCT_STATUSES = ["active", "inactive", "deleted"] as const;
export const PRODUCT_MUTABLE_STATUSES = ["active", "inactive"] as const;
export const PRODUCT_CATEGORY_STATUSES = ["active", "inactive", "deleted"] as const;
export const PRODUCT_CATEGORY_MUTABLE_STATUSES = ["active", "inactive"] as const;
export const PRODUCT_UNIT_STATUSES = ["active", "inactive", "deleted"] as const;
export const PRODUCT_UNIT_MUTABLE_STATUSES = ["active", "inactive"] as const;
export const PRODUCT_PRICE_HISTORY_CHANGE_TYPES = [
  "purchase_price",
  "sale_price",
  "mrp",
  "wholesale_price",
  "minimum_sale_price",
  "gst_rate",
  "discount",
  "pricing"
] as const;
export const PRODUCT_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const PRODUCT_SORT_FIELDS = ["name", "salePrice", "purchasePrice", "createdAt", "productCode"] as const;
export const GST_RATE_OPTIONS = [0, 0.25, 3, 5, 12, 18, 28] as const;

export type ProductActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type ProductRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type ProductExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export type ProductPricePreview = {
  baseSalePrice: string;
  gstAmount: string;
  cessAmount: string;
  finalSalePrice: string;
  marginAmount: string;
  marginPercentage: string;
  markupPercentage: string;
};

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export type ProductMutableStatus = (typeof PRODUCT_MUTABLE_STATUSES)[number];
export type ProductCategoryStatus = (typeof PRODUCT_CATEGORY_STATUSES)[number];
export type ProductUnitStatus = (typeof PRODUCT_UNIT_STATUSES)[number];
export type ProductType = (typeof PRODUCT_TYPES)[number];
export type ProductTaxType = (typeof PRODUCT_TAX_TYPES)[number];
export type ProductPriceTaxType = (typeof PRODUCT_PRICE_TAX_TYPES)[number];
