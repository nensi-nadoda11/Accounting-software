export const CUSTOMER_TYPES = ["individual", "business"] as const;
export const CUSTOMER_TAX_TYPES = ["registered", "unregistered", "composition"] as const;
export const CUSTOMER_OPENING_BALANCE_TYPES = ["debit", "credit", "none"] as const;
export const CUSTOMER_STATUSES = ["active", "inactive", "deleted"] as const;
export const CUSTOMER_MUTABLE_STATUSES = ["active", "inactive"] as const;
export const CUSTOMER_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const CUSTOMER_LEDGER_TRANSACTION_TYPES = [
  "opening_balance",
  "sale",
  "sales_return",
  "payment",
  "debit_adjustment",
  "credit_adjustment"
] as const;

export type CustomerActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type CustomerRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type CustomerExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};
