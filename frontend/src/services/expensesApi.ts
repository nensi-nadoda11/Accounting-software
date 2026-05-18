import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  CancelExpenseInput,
  CategoryWiseExpenseReportResponse,
  CreateExpenseCategoryInput,
  ExpenseAttachmentUploadResponse,
  ExpenseCategoryFiltersQuery,
  ExpenseCategoryListResponse,
  ExpenseDetailResponse,
  ExpenseDownloadResult,
  ExpenseFiltersQuery,
  ExpenseFormInput,
  ExpenseListResponse,
  ExpenseReportFiltersQuery,
  ExpenseStatus,
  GstExpenseReportResponse,
  MonthlyExpenseReportResponse,
  PaymentModeExpenseReportResponse,
  RecurringExpenseFiltersQuery,
  RecurringExpenseFormInput,
  RecurringExpenseListResponse,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
  UpdateRecurringExpenseInput,
} from "../types/expense";

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
): Promise<ExpenseDownloadResult> => {
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

export const expensesApi = {
  list: async (query: ExpenseFiltersQuery) =>
    (
      await client.get<ApiResponse<ExpenseListResponse>>("/expenses", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          categoryId: query.categoryId || undefined,
          paymentMode: query.paymentMode || undefined,
          status: query.status || undefined,
          gstApplicable: query.gstApplicable,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          recurringExpenseId: query.recurringExpenseId || undefined,
        },
      })
    ).data,

  create: async (payload: ExpenseFormInput) =>
    (await client.post<ApiResponse<ExpenseDetailResponse>>("/expenses", payload)).data,

  get: async (expenseId: string) =>
    (await client.get<ApiResponse<ExpenseDetailResponse>>(`/expenses/${expenseId}`)).data,

  update: async (expenseId: string, payload: UpdateExpenseInput) =>
    (await client.patch<ApiResponse<ExpenseDetailResponse>>(`/expenses/${expenseId}`, payload)).data,

  post: async (expenseId: string) =>
    (await client.post<ApiResponse<ExpenseDetailResponse>>(`/expenses/${expenseId}/post`, {})).data,

  cancel: async (expenseId: string, payload: CancelExpenseInput) =>
    (await client.post<ApiResponse<ExpenseDetailResponse>>(`/expenses/${expenseId}/cancel`, payload)).data,

  remove: async (expenseId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/expenses/${expenseId}`)).data,

  exportList: async (query: ExpenseFiltersQuery) =>
    extractDownload(
      client.get("/expenses/export", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          categoryId: query.categoryId || undefined,
          paymentMode: query.paymentMode || undefined,
          status: query.status || undefined,
          gstApplicable: query.gstApplicable,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          recurringExpenseId: query.recurringExpenseId || undefined,
          format: "csv",
        },
        responseType: "blob",
      }),
      "expenses.csv",
    ),

  listCategories: async (query: ExpenseCategoryFiltersQuery) =>
    (
      await client.get<ApiResponse<ExpenseCategoryListResponse>>("/expenses/categories", {
        params: {
          search: query.search || undefined,
          status: query.status || undefined,
          parentId: query.parentId || undefined,
        },
      })
    ).data,

  createCategory: async (payload: CreateExpenseCategoryInput) =>
    (await client.post<ApiResponse<{ category: unknown }>>("/expenses/categories", payload)).data,

  updateCategory: async (categoryId: string, payload: UpdateExpenseCategoryInput) =>
    (await client.patch<ApiResponse<{ category: unknown }>>(`/expenses/categories/${categoryId}`, payload)).data,

  removeCategory: async (categoryId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/expenses/categories/${categoryId}`)).data,

  uploadAttachments: async (
    expenseId: string,
    files: File[],
    onProgress?: (progress: number) => void,
  ) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    return (
      await client.post<ApiResponse<ExpenseAttachmentUploadResponse>>(`/expenses/${expenseId}/attachments`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (event) => {
          if (!event.total || !onProgress) {
            return;
          }

          onProgress(Math.round((event.loaded / event.total) * 100));
        },
      })
    ).data;
  },

  removeAttachment: async (expenseId: string, attachmentId: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/expenses/${expenseId}/attachments/${attachmentId}`)).data,

  listRecurring: async (query: RecurringExpenseFiltersQuery) =>
    (
      await client.get<ApiResponse<RecurringExpenseListResponse>>("/expenses/recurring", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          status: query.status || undefined,
          frequency: query.frequency || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  createRecurring: async (payload: RecurringExpenseFormInput) =>
    (await client.post<ApiResponse<{ recurringExpense: unknown }>>("/expenses/recurring", payload)).data,

  updateRecurring: async (recurringExpenseId: string, payload: UpdateRecurringExpenseInput) =>
    (await client.patch<ApiResponse<{ recurringExpense: unknown }>>(`/expenses/recurring/${recurringExpenseId}`, payload)).data,

  runRecurring: async (recurringExpenseId: string) =>
    (await client.post<ApiResponse<{ recurringExpense: unknown; expense: ExpenseDetailResponse }>>(`/expenses/recurring/${recurringExpenseId}/run`, {})).data,

  runDueRecurring: async () =>
    (await client.post<ApiResponse<{ total: number; executed: Array<{ recurringExpenseId: string; expenseId: string }> }>>("/expenses/recurring/run-due", {}))
      .data,

  getCategoryWiseReport: async (query: ExpenseReportFiltersQuery) =>
    (
      await client.get<ApiResponse<CategoryWiseExpenseReportResponse>>("/expenses/reports/category-wise", {
        params: {
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          categoryId: query.categoryId || undefined,
          paymentMode: query.paymentMode || undefined,
          includeDrafts: query.includeDrafts,
        },
      })
    ).data,

  getMonthlyReport: async (query: ExpenseReportFiltersQuery) =>
    (
      await client.get<ApiResponse<MonthlyExpenseReportResponse>>("/expenses/reports/monthly", {
        params: {
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          categoryId: query.categoryId || undefined,
          paymentMode: query.paymentMode || undefined,
          includeDrafts: query.includeDrafts,
        },
      })
    ).data,

  getPaymentModeReport: async (query: ExpenseReportFiltersQuery) =>
    (
      await client.get<ApiResponse<PaymentModeExpenseReportResponse>>("/expenses/reports/payment-mode", {
        params: {
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          categoryId: query.categoryId || undefined,
          paymentMode: query.paymentMode || undefined,
          includeDrafts: query.includeDrafts,
        },
      })
    ).data,

  getGstReport: async (query: ExpenseReportFiltersQuery) =>
    (
      await client.get<ApiResponse<GstExpenseReportResponse>>("/expenses/reports/gst", {
        params: {
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          categoryId: query.categoryId || undefined,
          paymentMode: query.paymentMode || undefined,
          includeDrafts: query.includeDrafts,
        },
      })
    ).data,
};

export const isDraftExpenseStatus = (status: ExpenseStatus) => status === "draft";
