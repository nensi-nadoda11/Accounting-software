import type { PermissionKey } from "../../types/auth";
import type {
  ChequeStatus,
  PaymentAgingBucket,
  PaymentAllocationStatus,
  PaymentMode,
  PaymentReminderChannel,
  PaymentReminderStatus,
  PaymentStatus,
  PaymentType,
  PartyType,
} from "../../types/payment";
import type { PaymentManagementTab } from "./paymentTypes";

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  bank: "Bank",
  upi: "UPI",
  card: "Card",
  cheque: "Cheque",
  neft: "NEFT",
  rtgs: "RTGS",
  imps: "IMPS",
  other: "Other",
};

export const PAYMENT_MODE_OPTIONS = Object.entries(PAYMENT_MODE_LABELS).map(([value, label]) => ({
  value: value as PaymentMode,
  label,
}));

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  customer_receive: "Receive",
  supplier_pay: "Pay",
};

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
  customer: "Customer",
  supplier: "Supplier",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  draft: "Draft",
  completed: "Completed",
  cancelled: "Cancelled",
  bounced: "Bounced",
  reversed: "Reversed",
};

export const PAYMENT_ALLOCATION_STATUS_LABELS: Record<PaymentAllocationStatus, string> = {
  unallocated: "Unallocated",
  advance: "Advance",
  fully_allocated: "Allocated",
  partially_allocated: "Partial",
};

export const PAYMENT_REMINDER_CHANNEL_LABELS: Record<PaymentReminderChannel, string> = {
  in_app: "In-App",
  email: "Email",
  whatsapp: "WhatsApp",
};

export const PAYMENT_REMINDER_STATUS_LABELS: Record<PaymentReminderStatus, string> = {
  pending: "Pending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const CHEQUE_STATUS_LABELS: Record<ChequeStatus, string> = {
  received: "Received",
  issued: "Issued",
  deposited: "Deposited",
  cleared: "Cleared",
  bounced: "Bounced",
  cancelled: "Cancelled",
};

export const DUE_BUCKET_LABELS: Record<PaymentAgingBucket, string> = {
  current: "Current",
  "1-30": "1-30",
  "31-60": "31-60",
  "61-90": "61-90",
  "91-180": "91-180",
  "181+": "181+",
};

export const PAYMENT_TABS: Array<{
  id: PaymentManagementTab;
  label: string;
  permissions: PermissionKey[];
}> = [
  { id: "receive", label: "Receive Payment", permissions: ["payment.receive"] },
  { id: "pay", label: "Pay Supplier", permissions: ["payment.pay"] },
  { id: "list", label: "Payments List", permissions: ["payment.view"] },
  { id: "dues", label: "Due Tracking", permissions: ["payment.view"] },
  { id: "advances", label: "Advances", permissions: ["payment.view"] },
  { id: "reminders", label: "Reminders", permissions: ["payment.view", "payment.reminder.manage"] },
];

export const REMINDER_CHANNEL_OPTIONS = Object.entries(PAYMENT_REMINDER_CHANNEL_LABELS).map(([value, label]) => ({
  value: value as PaymentReminderChannel,
  label,
}));

export const REMINDER_STATUS_OPTIONS = Object.entries(PAYMENT_REMINDER_STATUS_LABELS).map(([value, label]) => ({
  value: value as PaymentReminderStatus,
  label,
}));

export const CHEQUE_STATUS_OPTIONS = Object.entries(CHEQUE_STATUS_LABELS).map(([value, label]) => ({
  value: value as ChequeStatus,
  label,
}));
