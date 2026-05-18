export const PURCHASE_STATUSES = ["draft", "posted", "cancelled", "returned"] as const;
export const PURCHASE_PAYMENT_STATUSES = ["unpaid", "partial", "paid", "overdue"] as const;
export const PURCHASE_PAYMENT_MODES = ["cash", "bank", "upi", "card", "cheque"] as const;
export const PURCHASE_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const PURCHASE_PRICE_TAX_TYPES = ["inclusive", "exclusive"] as const;

export type PurchaseActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type PurchaseRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type PurchaseExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export type PurchasePaymentStatus = (typeof PURCHASE_PAYMENT_STATUSES)[number];
export type PurchasePaymentMode = (typeof PURCHASE_PAYMENT_MODES)[number];
export type PurchasePriceTaxType = (typeof PURCHASE_PRICE_TAX_TYPES)[number];
