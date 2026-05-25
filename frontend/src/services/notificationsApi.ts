import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  ManualNotificationInput,
  Notification,
  NotificationListQuery,
  NotificationListResponse,
  NotificationPreference,
  NotificationPreferenceInput,
  NotificationTemplate,
  NotificationTemplateInput,
  NotificationTemplateListResponse,
  NotificationTemplateQuery,
  NotificationTemplateUpdateInput,
  SchedulerJobResult,
} from "../types/notification";

export const notificationsApi = {
  list: async (query: NotificationListQuery) =>
    (
      await client.get<ApiResponse<NotificationListResponse>>("/notifications", {
        params: {
          page: query.page,
          limit: query.limit,
          type: query.type || undefined,
          priority: query.priority || undefined,
          channel: query.channel || undefined,
          unread: query.unread,
          dateFrom: query.dateFrom || undefined,
          dateTo: query.dateTo || undefined,
        },
      })
    ).data,

  unreadCount: async () =>
    (await client.get<ApiResponse<{ count: number }>>("/notifications/unread-count")).data,

  listRecipients: async () =>
    (await client.get<ApiResponse<{ items: Array<{ id: string; fullName: string; email: string; mobileNumber: string | null }> }>>("/notifications/recipients")).data,

  markRead: async (notificationId: string) =>
    (await client.patch<ApiResponse<{ notification: Notification }>>(`/notifications/${notificationId}/read`, {})).data,

  markAllRead: async () =>
    (await client.patch<ApiResponse<{ updatedCount: number }>>("/notifications/read-all", {})).data,

  remove: async (notificationId: string) =>
    (await client.delete<ApiResponse<{ notification: Notification }>>(`/notifications/${notificationId}`)).data,

  getPreferences: async () =>
    (await client.get<ApiResponse<{ preference: NotificationPreference }>>("/notifications/preferences")).data,

  updatePreferences: async (payload: NotificationPreferenceInput) =>
    (await client.patch<ApiResponse<{ preference: NotificationPreference }>>("/notifications/preferences", payload)).data,

  listTemplates: async (query: NotificationTemplateQuery = {}) =>
    (
      await client.get<ApiResponse<NotificationTemplateListResponse>>("/notifications/templates", {
        params: {
          type: query.type || undefined,
          channel: query.channel || undefined,
          isActive: query.isActive,
        },
      })
    ).data,

  createTemplate: async (payload: NotificationTemplateInput) =>
    (await client.post<ApiResponse<{ template: NotificationTemplate }>>("/notifications/templates", payload)).data,

  updateTemplate: async (templateId: string, payload: NotificationTemplateUpdateInput) =>
    (await client.patch<ApiResponse<{ template: NotificationTemplate }>>(`/notifications/templates/${templateId}`, payload)).data,

  send: async (payload: ManualNotificationInput) =>
    (await client.post<ApiResponse<Record<string, unknown>>>("/notifications/send", payload)).data,

  runDueReminders: async () =>
    (await client.post<ApiResponse<SchedulerJobResult>>("/notifications/run-due-reminders", {})).data,

  runLowStockCheck: async () =>
    (await client.post<ApiResponse<SchedulerJobResult>>("/notifications/run-low-stock-check", {})).data,

  runExpiryCheck: async () =>
    (await client.post<ApiResponse<SchedulerJobResult>>("/notifications/run-expiry-check", {})).data,

  runInvoiceReminders: async () =>
    (await client.post<ApiResponse<SchedulerJobResult>>("/notifications/run-invoice-reminders", {})).data,

  runGstReminders: async () =>
    (await client.post<ApiResponse<SchedulerJobResult>>("/notifications/run-gst-reminders", {})).data,

  runPayrollReminders: async () =>
    (await client.post<ApiResponse<SchedulerJobResult>>("/notifications/run-payroll-reminders", {})).data,
};
