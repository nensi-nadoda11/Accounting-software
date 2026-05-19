import type {
  notificationChannelEnum,
  notificationFrequencyEnum,
  notificationLogStatusEnum,
  notificationPriorityEnum,
  notificationTypeEnum,
  scheduledNotificationStatusEnum
} from "../../db/schema";

export const NOTIFICATION_TYPES = [
  "payment_due",
  "supplier_due",
  "low_stock",
  "expiry",
  "invoice",
  "payroll",
  "gst",
  "system",
  "warning"
] as const;

export const NOTIFICATION_PRIORITIES = ["info", "success", "warning", "critical"] as const;

export const NOTIFICATION_CHANNELS = ["in_app", "email", "whatsapp", "sms"] as const;

export const NOTIFICATION_FREQUENCIES = ["instant", "daily", "weekly"] as const;

export const NOTIFICATION_LOG_STATUSES = ["pending", "sent", "failed", "skipped"] as const;

export const SCHEDULED_NOTIFICATION_STATUSES = ["pending", "sent", "failed", "cancelled"] as const;

export const NOTIFICATION_TABS = [
  "all",
  "unread",
  "payment",
  "inventory",
  "gst",
  "payroll",
  "templates",
  "preferences",
  "logs"
] as const;

export const SCHEDULER_JOB_KEYS = [
  "due_reminders",
  "low_stock_check",
  "expiry_check",
  "invoice_reminders",
  "gst_reminders",
  "payroll_reminders"
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationFrequency = (typeof NOTIFICATION_FREQUENCIES)[number];
export type NotificationLogStatus = (typeof NOTIFICATION_LOG_STATUSES)[number];
export type ScheduledNotificationStatus = (typeof SCHEDULED_NOTIFICATION_STATUSES)[number];
export type SchedulerJobKey = (typeof SCHEDULER_JOB_KEYS)[number];

export type NotificationActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
  permissions: Set<string> | undefined;
};

export type NotificationRequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type NotificationPreferenceFlags = {
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
};

export type DeliveryStatus = typeof notificationLogStatusEnum.enumValues[number];
export type DeliveryChannel = typeof notificationChannelEnum.enumValues[number];
export type DeliveryType = typeof notificationTypeEnum.enumValues[number];
export type DeliveryPriority = typeof notificationPriorityEnum.enumValues[number];
export type DeliveryFrequency = typeof notificationFrequencyEnum.enumValues[number];
export type DeliveryScheduleStatus = typeof scheduledNotificationStatusEnum.enumValues[number];

export type NotificationTemplateDefinition = {
  templateKey: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  variables: string[];
  isSystem: boolean;
  isActive: boolean;
};

export type NotificationDispatchInput = {
  companyId: string;
  userId?: string | null;
  recipient?: string | null;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  channel: NotificationChannel;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

export type SchedulerResult = {
  job: SchedulerJobKey;
  companies: number;
  scheduled: number;
  sent: number;
  skipped: number;
  failed: number;
};
