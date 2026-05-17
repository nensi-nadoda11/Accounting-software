import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  DownloadFileResult,
  ProductCategory,
  ProductCategoryFormInput,
  ProductCategoryListQuery,
  ProductCategoryListResponse,
  ProductDetailResponse,
  ProductExportFormat,
  ProductFormInput,
  ProductListQuery,
  ProductListResponse,
  ProductLookupItem,
  ProductPriceHistoryResponse,
  ProductStockSummary,
  ProductUnit,
  ProductUnitFormInput,
  ProductUnitListQuery,
  ProductUnitListResponse,
} from "../types/product";

const getFileNameFromDisposition = (contentDisposition: string | undefined, fallback: string) => {
  if (!contentDisposition) {
    return fallback;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const match = contentDisposition.match(/filename=\"?([^\"]+)\"?/i);
  return match?.[1] ?? fallback;
};

const extractDownload = async (
  request: Promise<AxiosResponse<Blob>>,
  fallbackFileName: string,
): Promise<DownloadFileResult> => {
  const response = await request;

  return {
    blob: response.data,
    fileName: getFileNameFromDisposition(response.headers["content-disposition"], fallbackFileName),
    contentType:
      typeof response.headers["content-type"] === "string"
        ? response.headers["content-type"]
        : "application/octet-stream",
  };
};

export const productsApi = {
  list: async (query: ProductListQuery) =>
    (
      await client.get<ApiResponse<ProductListResponse>>("/products", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          productType: query.productType || undefined,
          categoryId: query.categoryId || undefined,
          unitId: query.unitId || undefined,
          gstRate: query.gstRate,
          status: query.status || undefined,
          stockTrackingEnabled: query.stockTrackingEnabled,
          lowStock: query.lowStock,
          taxType: query.taxType || undefined,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        },
      })
    ).data,

  create: async (payload: ProductFormInput) =>
    (await client.post<ApiResponse<ProductDetailResponse>>("/products", payload)).data,

  get: async (productId: string) =>
    (await client.get<ApiResponse<ProductDetailResponse>>(`/products/${productId}`)).data,

  update: async (productId: string, payload: ProductFormInput) =>
    (await client.patch<ApiResponse<ProductDetailResponse>>(`/products/${productId}`, payload)).data,

  remove: async (productId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/products/${productId}`)).data,

  getPriceHistory: async (productId: string, page = 1, limit = 20) =>
    (
      await client.get<ApiResponse<ProductPriceHistoryResponse>>(`/products/${productId}/price-history`, {
        params: { page, limit },
      })
    ).data,

  getStockSummary: async (productId: string) =>
    (await client.get<ApiResponse<ProductStockSummary>>(`/products/${productId}/stock-summary`)).data,

  lookup: async (search?: string, limit = 20) =>
    (
      await client.get<ApiResponse<ProductLookupItem[]>>("/products/lookup", {
        params: {
          search: search || undefined,
          limit,
        },
      })
    ).data,

  exportList: async (query: ProductListQuery & { format?: ProductExportFormat }) =>
    extractDownload(
      client.get("/products/export", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          productType: query.productType || undefined,
          categoryId: query.categoryId || undefined,
          unitId: query.unitId || undefined,
          gstRate: query.gstRate,
          status: query.status || undefined,
          stockTrackingEnabled: query.stockTrackingEnabled,
          lowStock: query.lowStock,
          taxType: query.taxType || undefined,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "products.csv",
    ),

  generateBarcode: async (productId: string, replaceExisting = false) =>
    (
      await client.post<ApiResponse<ProductDetailResponse>>(`/products/${productId}/generate-barcode`, {
        replaceExisting,
      })
    ).data,
};

export const categoriesApi = {
  list: async (query: ProductCategoryListQuery) =>
    (
      await client.get<ApiResponse<ProductCategoryListResponse>>("/products/categories", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          parentId: query.parentId || undefined,
        },
      })
    ).data,

  create: async (payload: ProductCategoryFormInput) =>
    (await client.post<ApiResponse<{ category: ProductCategory }>>("/products/categories", payload)).data,

  update: async (categoryId: string, payload: ProductCategoryFormInput) =>
    (await client.patch<ApiResponse<{ category: ProductCategory }>>(`/products/categories/${categoryId}`, payload)).data,

  remove: async (categoryId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/products/categories/${categoryId}`)).data,
};

export const unitsApi = {
  list: async (query: ProductUnitListQuery) =>
    (
      await client.get<ApiResponse<ProductUnitListResponse>>("/products/units", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          decimalAllowed: query.decimalAllowed,
        },
      })
    ).data,

  create: async (payload: ProductUnitFormInput) =>
    (await client.post<ApiResponse<{ unit: ProductUnit }>>("/products/units", payload)).data,

  update: async (unitId: string, payload: ProductUnitFormInput) =>
    (await client.patch<ApiResponse<{ unit: ProductUnit }>>(`/products/units/${unitId}`, payload)).data,

  remove: async (unitId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/products/units/${unitId}`)).data,
};
