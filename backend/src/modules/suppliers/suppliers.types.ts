export const SUPPLIER_TYPES = [
  "individual",
  "business",
  "manufacturer",
  "distributor",
  "wholesaler"
] as const;
export const SUPPLIER_TAX_TYPES = ["registered", "unregistered", "composition"] as const;
export const SUPPLIER_OPENING_BALANCE_TYPES = ["debit", "credit", "none"] as const;
export const SUPPLIER_STATUSES = ["active", "inactive", "blocked", "deleted"] as const;
export const SUPPLIER_MUTABLE_STATUSES = ["active", "inactive", "blocked"] as const;
export const SUPPLIER_EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export const SUPPLIER_LEDGER_TRANSACTION_TYPES = [
  "opening_balance",
  "purchase",
  "purchase_return",
  "payment",
  "debit_adjustment",
  "credit_adjustment"
] as const;

export type SupplierActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type SupplierRequestContext = {
  ipAddress: string;
  userAgent: string;
};

export type SupplierExportPayload = {
  fileName: string;
  contentType: string;
  content: Buffer;
};
