export const PAYMENT_TYPES = ["customer_receive", "supplier_pay"] as const;
export const PAYMENT_PARTY_TYPES = ["customer", "supplier"] as const;
export const PAYMENT_MODES = ["cash", "bank", "upi", "card", "cheque", "neft", "rtgs", "imps", "other"] as const;
export const PAYMENT_STATUSES = ["draft", "completed", "cancelled", "bounced", "reversed"] as const;
export const PAYMENT_ALLOCATION_TYPES = ["sales_invoice", "purchase_invoice", "advance_adjustment"] as const;
export const PAYMENT_RECEIPT_TYPES = ["customer_receipt", "supplier_voucher"] as const;
export const PAYMENT_REMINDER_REFERENCE_TYPES = ["sales_invoice", "purchase_invoice", "advance", "manual"] as const;
export const PAYMENT_REMINDER_CHANNELS = ["in_app", "email", "whatsapp"] as const;
export const PAYMENT_REMINDER_STATUSES = ["pending", "sent", "failed", "cancelled"] as const;
export const CHEQUE_STATUSES = ["received", "issued", "deposited", "cleared", "bounced", "cancelled"] as const;
export const PAYMENT_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const PAYMENT_AGING_BUCKETS = ["current", "1-30", "31-60", "61-90", "91-180", "181+"] as const;

export type PaymentActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type PaymentRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type PaymentExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export type PaymentType = (typeof PAYMENT_TYPES)[number];
export type PaymentPartyType = (typeof PAYMENT_PARTY_TYPES)[number];
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentAllocationType = (typeof PAYMENT_ALLOCATION_TYPES)[number];
export type PaymentReceiptType = (typeof PAYMENT_RECEIPT_TYPES)[number];
export type PaymentReminderReferenceType = (typeof PAYMENT_REMINDER_REFERENCE_TYPES)[number];
export type PaymentReminderChannel = (typeof PAYMENT_REMINDER_CHANNELS)[number];
export type PaymentReminderStatus = (typeof PAYMENT_REMINDER_STATUSES)[number];
export type ChequeStatus = (typeof CHEQUE_STATUSES)[number];
export type PaymentAgingBucket = (typeof PAYMENT_AGING_BUCKETS)[number];
