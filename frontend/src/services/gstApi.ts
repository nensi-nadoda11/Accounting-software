import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  GstAdjustment,
  GstAdjustmentInput,
  GstExportFormat,
  GstExportResult,
  GstFilters,
  GstListResponse,
  GstSummary,
  HsnSacSummaryRow,
  ItcRow,
  OutputTaxSummary,
  PurchaseGstRow,
  SalesGstRow,
  TaxSummaryRow,
} from "../types/gst";

const getFileNameFromDisposition = (contentDisposition: string | undefined, fallback: string) => {
  if (!contentDisposition) {
    return fallback;
  }

  const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
};

const extractDownload = async (
  request: Promise<AxiosResponse<Blob>>,
  fallbackFileName: string,
): Promise<GstExportResult> => {
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

const buildDateParams = (query: GstFilters) => ({
  dateFrom: query.dateFrom || undefined,
  dateTo: query.dateTo || undefined,
});

export const gstApi = {
  getSummary: async (query: GstFilters) =>
    (
      await client.get<ApiResponse<GstSummary>>("/gst/summary", {
        params: {
          ...buildDateParams(query),
          financialYearId: query.financialYearId || undefined,
        },
      })
    ).data,

  listSales: async (query: GstFilters) =>
    (
      await client.get<ApiResponse<GstListResponse<SalesGstRow>>>("/gst/sales", {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateParams(query),
          customerId: query.customerId || undefined,
          state: query.state || undefined,
          invoiceType: query.invoiceType || undefined,
          partyType: query.partyType || undefined,
          gstRate: query.gstRate,
        },
      })
    ).data,

  exportSales: async (query: GstFilters & { format?: GstExportFormat }) =>
    extractDownload(
      client.get("/gst/sales/export", {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateParams(query),
          customerId: query.customerId || undefined,
          state: query.state || undefined,
          invoiceType: query.invoiceType || undefined,
          partyType: query.partyType || undefined,
          gstRate: query.gstRate,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "gst-sales.csv",
    ),

  listPurchases: async (query: GstFilters) =>
    (
      await client.get<ApiResponse<GstListResponse<PurchaseGstRow>>>("/gst/purchases", {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateParams(query),
          supplierId: query.supplierId || undefined,
          state: query.state || undefined,
          gstRate: query.gstRate,
          eligibilityStatus: query.eligibilityStatus || undefined,
          claimStatus: query.claimStatus || undefined,
        },
      })
    ).data,

  exportPurchases: async (query: GstFilters & { format?: GstExportFormat }) =>
    extractDownload(
      client.get("/gst/purchases/export", {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateParams(query),
          supplierId: query.supplierId || undefined,
          state: query.state || undefined,
          gstRate: query.gstRate,
          eligibilityStatus: query.eligibilityStatus || undefined,
          claimStatus: query.claimStatus || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "gst-purchases.csv",
    ),

  listItc: async (query: GstFilters) =>
    (
      await client.get<ApiResponse<GstListResponse<ItcRow>>>("/gst/itc", {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateParams(query),
          sourceType: query.sourceType || undefined,
          eligibilityStatus: query.eligibilityStatus || undefined,
          claimStatus: query.claimStatus || undefined,
          supplier: query.supplier || undefined,
        },
      })
    ).data,

  exportItc: async (query: GstFilters & { format?: GstExportFormat }) =>
    extractDownload(
      client.get("/gst/itc/export", {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateParams(query),
          sourceType: query.sourceType || undefined,
          eligibilityStatus: query.eligibilityStatus || undefined,
          claimStatus: query.claimStatus || undefined,
          supplier: query.supplier || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "gst-itc.csv",
    ),

  updateItcStatus: async (
    id: string,
    payload: {
      eligibilityStatus?: string;
      claimStatus?: string;
      claimedAmount?: number;
      notes?: string | null;
    },
  ) =>
    (
      await client.patch<
        ApiResponse<{
          itcStatus: {
            id: string;
            sourceType: string;
            sourceId: string;
            sourceNumber: string | null;
            eligibilityStatus: string;
            claimStatus: string;
            claimedAmount: string;
            notes: string | null;
            updatedAt: string;
          };
        }>
      >(`/gst/itc/${id}/status`, payload)
    ).data,

  getOutputTax: async (query: GstFilters) =>
    (
      await client.get<ApiResponse<OutputTaxSummary>>("/gst/output-tax", {
        params: {
          ...buildDateParams(query),
          state: query.state || undefined,
          gstRate: query.gstRate,
        },
      })
    ).data,

  getHsnSummary: async (query: GstFilters) =>
    (
      await client.get<ApiResponse<{ items: HsnSacSummaryRow[] }>>("/gst/hsn-summary", {
        params: {
          ...buildDateParams(query),
          source: query.source || undefined,
        },
      })
    ).data,

  exportHsnSummary: async (query: GstFilters & { format?: GstExportFormat }) =>
    extractDownload(
      client.get("/gst/hsn-summary/export", {
        params: {
          ...buildDateParams(query),
          source: query.source || undefined,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "gst-hsn-summary.csv",
    ),

  getTaxSummary: async (query: GstFilters) =>
    (
      await client.get<ApiResponse<{ items: TaxSummaryRow[] }>>("/gst/tax-summary", {
        params: buildDateParams(query),
      })
    ).data,

  exportTaxSummary: async (query: GstFilters & { format?: GstExportFormat }) =>
    extractDownload(
      client.get("/gst/tax-summary/export", {
        params: {
          ...buildDateParams(query),
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "gst-tax-summary.csv",
    ),

  listAdjustments: async (query: GstFilters) =>
    (
      await client.get<ApiResponse<GstListResponse<GstAdjustment>>>("/gst/adjustments", {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateParams(query),
          adjustmentType: query.adjustmentType || undefined,
          taxComponent: query.taxComponent || undefined,
          status: query.status || undefined,
        },
      })
    ).data,

  createAdjustment: async (payload: GstAdjustmentInput) =>
    (await client.post<ApiResponse<{ adjustment: GstAdjustment }>>("/gst/adjustments", payload)).data,

  cancelAdjustment: async (id: string, payload: { cancellationReason: string }) =>
    (await client.post<ApiResponse<{ adjustment: Partial<GstAdjustment> }>>(`/gst/adjustments/${id}/cancel`, payload)).data,

  exportGstr1: async (query: GstFilters & { format?: GstExportFormat }) =>
    extractDownload(
      client.get("/gst/gstr-1/export", {
        params: {
          page: query.page,
          limit: query.limit,
          ...buildDateParams(query),
          customerId: query.customerId || undefined,
          state: query.state || undefined,
          invoiceType: query.invoiceType || undefined,
          partyType: query.partyType || undefined,
          gstRate: query.gstRate,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "gstr1.csv",
    ),

  exportGstr3b: async (query: GstFilters & { format?: GstExportFormat }) =>
    extractDownload(
      client.get("/gst/gstr-3b/export", {
        params: {
          ...buildDateParams(query),
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "gstr3b.csv",
    ),
};
