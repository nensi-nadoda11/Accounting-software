export const NOTIFICATION_TYPES = [
  "payment_due",
  "supplier_due",
  "low_stock",
  "expiry",
  "invoice",
  "payroll",
  "gst",
  "system",
  "warning",
] as const;

export const NOTIFICATION_PRIORITIES = ["info", "success", "warning", "critical"] as const;

export const NOTIFICATION_CHANNELS = ["in_app", "email", "whatsapp", "sms"] as const;

export const NOTIFICATION_LOG_STATUSES = ["pending", "sent", "failed", "skipped"] as const;

export const NOTIFICATION_FREQUENCIES = ["instant", "daily", "weekly"] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationLogStatus = (typeof NOTIFICATION_LOG_STATUSES)[number];
export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCIES)[number];

export interface Notification {
  id: string;
  userId: string | null;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  channel: NotificationChannel;
  entityType: string | null;
  entityId: string | null;
  actionUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  paymentReminders: boolean;
  supplierReminders: boolean;
  lowStockAlerts: boolean;
  expiryAlerts: boolean;
  invoiceReminders: boolean;
  payrollAlerts: boolean;
  gstAlerts: boolean;
  frequency: NotificationFrequency;
}

export interface NotificationTemplate {
  id: string;
  templateKey: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  variables: string[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLog {
  id: string;
  notificationId: string | null;
  notificationTitle: string | null;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationLogStatus;
  errorMessage: string | null;
  sentAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface NotificationLogsResponse {
  items: NotificationLog[];
  pagination: NotificationListResponse["pagination"];
}

export interface NotificationTemplateListResponse {
  items: NotificationTemplate[];
}

export type NotificationListQuery = {
  page: number;
  limit: number;
  type?: NotificationType | "";
  priority?: NotificationPriority | "";
  channel?: NotificationChannel | "";
  unread?: boolean;
  dateFrom?: string;
  dateTo?: string;
};

export type NotificationLogsQuery = {
  page: number;
  limit: number;
  channel?: NotificationChannel | "";
  status?: NotificationLogStatus | "";
  dateFrom?: string;
  dateTo?: string;
};

export type NotificationTemplateQuery = {
  type?: NotificationType | "";
  channel?: NotificationChannel | "";
  isActive?: boolean;
};

export type NotificationPreferenceInput = Partial<Omit<NotificationPreference, "userId">> & {
  userId?: string;
};

export type NotificationTemplateInput = {
  templateKey: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject?: string | null;
  body: string;
  variables: string[];
  isActive: boolean;
};

export type NotificationTemplateUpdateInput = Partial<Omit<NotificationTemplateInput, "templateKey" | "type" | "channel">>;

export type ManualNotificationInput = {
  userId?: string | null;
  recipient?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  channel: NotificationChannel;
  actionUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

export type SchedulerJobResult = {
  job: string;
  companies: number;
  scheduled: number;
  sent: number;
  skipped: number;
  failed: number;
};
