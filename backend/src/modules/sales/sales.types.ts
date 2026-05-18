export const SALES_INVOICE_TYPES = ["gst_invoice", "pos"] as const;
export const SALES_INVOICE_STATUSES = ["draft", "posted", "cancelled", "returned", "partially_returned"] as const;
export const SALES_PAYMENT_STATUSES = ["unpaid", "partial", "paid", "overdue"] as const;
export const SALES_PAYMENT_MODES = ["cash", "bank", "upi", "card", "cheque"] as const;
export const SALES_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const SALES_PRICE_TAX_TYPES = ["inclusive", "exclusive"] as const;
export const SALES_SEND_CHANNELS = ["email", "whatsapp"] as const;

export type SalesActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type SalesRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type SalesExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export type SalesInvoiceType = (typeof SALES_INVOICE_TYPES)[number];
export type SalesInvoiceStatus = (typeof SALES_INVOICE_STATUSES)[number];
export type SalesPaymentStatus = (typeof SALES_PAYMENT_STATUSES)[number];
export type SalesPaymentMode = (typeof SALES_PAYMENT_MODES)[number];
export type SalesPriceTaxType = (typeof SALES_PRICE_TAX_TYPES)[number];
export type SalesSendChannel = (typeof SALES_SEND_CHANNELS)[number];
