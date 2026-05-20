import type { AxiosResponse } from "axios";

import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  CancelPaymentInput,
  CompletePaymentInput,
  DownloadFileResult,
  DueTrackingQuery,
  DueTrackingResponse,
  PartyDueItemsResponse,
  PartyType,
  PaymentAllocationsResponse,
  PaymentDetailResponse,
  PaymentFormInput,
  PaymentListQuery,
  PaymentListResponse,
  PaymentReminderQuery,
  PaymentRemindersResponse,
  PaymentExportFormat,
  SendReceiptInput,
  SendReminderInput,
  UpdateChequeStatusInput,
  UpdatePaymentInput,
  UpdateReminderStatusInput,
} from "../types/payment";

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

export const paymentsApi = {
  list: async (query: PaymentListQuery) =>
    (
      await client.get<ApiResponse<PaymentListResponse>>("/payments", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          partyType: query.partyType || undefined,
          paymentType: query.paymentType || undefined,
          partyId: query.partyId || undefined,
          paymentMode: query.paymentMode || undefined,
          status: query.status || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          isAdvance: query.isAdvance,
        },
      })
    ).data,

  create: async (payload: PaymentFormInput) =>
    (await client.post<ApiResponse<PaymentDetailResponse>>("/payments", payload)).data,

  get: async (paymentId: string) =>
    (await client.get<ApiResponse<PaymentDetailResponse>>(`/payments/${paymentId}`)).data,

  update: async (paymentId: string, payload: UpdatePaymentInput) =>
    (await client.patch<ApiResponse<PaymentDetailResponse>>(`/payments/${paymentId}`, payload)).data,

  complete: async (paymentId: string, payload: CompletePaymentInput) =>
    (await client.post<ApiResponse<PaymentDetailResponse>>(`/payments/${paymentId}/complete`, payload)).data,

  cancel: async (paymentId: string, payload: CancelPaymentInput) =>
    (await client.post<ApiResponse<PaymentDetailResponse>>(`/payments/${paymentId}/cancel`, payload)).data,

  exportList: async (query: PaymentListQuery & { format?: PaymentExportFormat }) =>
    extractDownload(
      client.get("/payments/export", {
        params: {
          page: query.page,
          limit: query.limit,
          search: query.search || undefined,
          partyType: query.partyType || undefined,
          paymentType: query.paymentType || undefined,
          partyId: query.partyId || undefined,
          paymentMode: query.paymentMode || undefined,
          status: query.status || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          isAdvance: query.isAdvance,
          format: query.format ?? "csv",
        },
        responseType: "blob",
      }),
      "payments.csv",
    ),

  listAllocations: async (paymentId: string) =>
    (await client.get<ApiResponse<PaymentAllocationsResponse>>(`/payments/${paymentId}/allocations`)).data,

  saveAllocations: async (paymentId: string, payload: CompletePaymentInput) =>
    (await client.post<ApiResponse<PaymentDetailResponse>>(`/payments/${paymentId}/allocations`, payload)).data,

  replaceAllocations: async (paymentId: string, payload: CompletePaymentInput) =>
    (await client.patch<ApiResponse<PaymentDetailResponse>>(`/payments/${paymentId}/allocations`, payload)).data,

  getCustomerDues: async (query: DueTrackingQuery) =>
    (
      await client.get<ApiResponse<DueTrackingResponse>>("/payments/customer-dues", {
        params: {
          page: query.page,
          limit: query.limit,
          partyId: query.partyId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          overdueOnly: query.overdueOnly,
          agingBucket: query.agingBucket || undefined,
        },
      })
    ).data,

  getSupplierDues: async (query: DueTrackingQuery) =>
    (
      await client.get<ApiResponse<DueTrackingResponse>>("/payments/supplier-dues", {
        params: {
          page: query.page,
          limit: query.limit,
          partyId: query.partyId || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
          overdueOnly: query.overdueOnly,
          agingBucket: query.agingBucket || undefined,
        },
      })
    ).data,

  getPartyDueItems: async (partyType: PartyType, partyId: string) =>
    (await client.get<ApiResponse<PartyDueItemsResponse>>(`/payments/party/${partyType}/${partyId}/due-items`)).data,

  getReceipt: async (paymentId: string) =>
    (await client.get<ApiResponse<{ receipt: PaymentDetailResponse["payment"]["receipt"] & { receiptData: unknown } }>>(`/payments/${paymentId}/receipt`))
      .data,

  getReceiptPdfFile: async (paymentId: string) =>
    extractDownload(
      client.get(`/payments/${paymentId}/receipt/pdf`, {
        responseType: "blob",
      }),
      `payment-receipt-${paymentId}.pdf`,
    ),

  sendReceipt: async (paymentId: string, payload: SendReceiptInput) =>
    (await client.post<ApiResponse<{ sentTo: string; status: "sent" | "failed"; errorMessage: string | null }>>(`/payments/${paymentId}/send-receipt`, payload))
      .data,

  listReminders: async (query: PaymentReminderQuery) =>
    (
      await client.get<ApiResponse<PaymentRemindersResponse>>("/payments/reminders", {
        params: {
          page: query.page,
          limit: query.limit,
          partyType: query.partyType || undefined,
          partyId: query.partyId || undefined,
          status: query.status || undefined,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  sendReminder: async (payload: SendReminderInput) =>
    (await client.post<ApiResponse<{ reminder: { id: string; status: string; channel: string; errorMessage: string | null; sentAt: string | null }; whatsappUrl?: string }>>("/payments/reminders/send", payload)).data,

  updateReminderStatus: async (reminderId: string, payload: UpdateReminderStatusInput) =>
    (await client.patch<ApiResponse<{ reminder: { id: string; status: string; errorMessage: string | null; sentAt: string | null } }>>(`/payments/reminders/${reminderId}/status`, payload)).data,

  updateChequeStatus: async (paymentId: string, payload: UpdateChequeStatusInput) =>
    (await client.patch<ApiResponse<PaymentDetailResponse>>(`/payments/${paymentId}/cheque-status`, payload)).data,
};
