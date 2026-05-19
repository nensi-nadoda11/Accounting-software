import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarClock,
  FileText,
  Package,
  Receipt,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import type { NotificationChannel, NotificationPriority, NotificationType } from "../../types/notification";

export const NOTIFICATIONS_UPDATED_EVENT = "notifications-updated";

export const notificationTypeLabels: Record<NotificationType, string> = {
  payment_due: "Payment Due",
  supplier_due: "Supplier Due",
  low_stock: "Low Stock",
  expiry: "Expiry",
  invoice: "Invoice",
  payroll: "Payroll",
  gst: "GST",
  system: "System",
  warning: "Warning",
};

export const notificationChannelLabels: Record<NotificationChannel, string> = {
  in_app: "In-App",
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

export const notificationPriorityLabels: Record<NotificationPriority, string> = {
  info: "Info",
  success: "Success",
  warning: "Warning",
  critical: "Critical",
};

export const notificationTypeIcons: Record<NotificationType, LucideIcon> = {
  payment_due: Wallet,
  supplier_due: Truck,
  low_stock: Package,
  expiry: CalendarClock,
  invoice: FileText,
  payroll: Users,
  gst: Receipt,
  system: Bell,
  warning: Bell,
};

export const notificationTypeOptions = Object.entries(notificationTypeLabels).map(([value, label]) => ({
  value: value as NotificationType,
  label,
}));

export const notificationPriorityOptions = Object.entries(notificationPriorityLabels).map(([value, label]) => ({
  value: value as NotificationPriority,
  label,
}));

export const notificationChannelOptions = Object.entries(notificationChannelLabels).map(([value, label]) => ({
  value: value as NotificationChannel,
  label,
}));

export const formatNotificationDateTime = (value: string | null) => {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};
