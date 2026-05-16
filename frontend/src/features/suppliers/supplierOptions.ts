import type {
  SortOrder,
  SupplierLedgerTransactionType,
  SupplierMutableStatus,
  SupplierSortBy,
  SupplierStatus,
  SupplierType,
  TaxType,
} from "../../types/supplier";

export const SUPPLIER_STATUS_OPTIONS: Array<{ value: SupplierStatus | ""; label: string }> = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blocked", label: "Blocked" },
  { value: "deleted", label: "Deleted" },
];

export const SUPPLIER_MUTABLE_STATUS_OPTIONS: Array<{ value: SupplierMutableStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blocked", label: "Blocked" },
];

export const SUPPLIER_TYPE_OPTIONS: Array<{ value: SupplierType | ""; label: string }> = [
  { value: "", label: "All Types" },
  { value: "individual", label: "Individual" },
  { value: "business", label: "Business" },
  { value: "manufacturer", label: "Manufacturer" },
  { value: "distributor", label: "Distributor" },
  { value: "wholesaler", label: "Wholesaler" },
];

export const FORM_SUPPLIER_TYPE_OPTIONS: Array<{ value: SupplierType; label: string }> = SUPPLIER_TYPE_OPTIONS.filter(
  (option): option is { value: SupplierType; label: string } => option.value !== "",
);

export const SUPPLIER_TAX_TYPE_OPTIONS: Array<{ value: TaxType | ""; label: string }> = [
  { value: "", label: "All Tax Types" },
  { value: "registered", label: "Registered" },
  { value: "unregistered", label: "Unregistered" },
  { value: "composition", label: "Composition" },
];

export const FORM_SUPPLIER_TAX_TYPE_OPTIONS: Array<{ value: TaxType; label: string }> =
  SUPPLIER_TAX_TYPE_OPTIONS.filter((option): option is { value: TaxType; label: string } => option.value !== "");

export const BOOLEAN_FILTER_OPTIONS = {
  outstanding: [
    { value: "", label: "All Outstanding" },
    { value: "true", label: "Has Outstanding" },
    { value: "false", label: "No Outstanding" },
  ],
  blacklisted: [
    { value: "", label: "All Blacklist" },
    { value: "true", label: "Blacklisted" },
    { value: "false", label: "Not Blacklisted" },
  ],
  preferred: [
    { value: "", label: "All Preference" },
    { value: "true", label: "Preferred" },
    { value: "false", label: "Not Preferred" },
  ],
} as const;

export const SORT_BY_OPTIONS: Array<{ value: SupplierSortBy; label: string }> = [
  { value: "createdAt", label: "Created Date" },
  { value: "name", label: "Name" },
  { value: "outstandingPayable", label: "Outstanding Payable" },
  { value: "supplierCode", label: "Supplier Code" },
];

export const SORT_ORDER_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: "desc", label: "Newest First" },
  { value: "asc", label: "Oldest First" },
];

export const SUPPLIER_LEDGER_TRANSACTION_OPTIONS: Array<{ value: SupplierLedgerTransactionType | ""; label: string }> = [
  { value: "", label: "All Types" },
  { value: "opening_balance", label: "Opening Balance" },
  { value: "purchase", label: "Purchase" },
  { value: "purchase_return", label: "Purchase Return" },
  { value: "payment", label: "Payment" },
  { value: "debit_adjustment", label: "Debit Adjustment" },
  { value: "credit_adjustment", label: "Credit Adjustment" },
];

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  blocked: "Blocked",
  deleted: "Deleted",
};

export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  individual: "Individual",
  business: "Business",
  manufacturer: "Manufacturer",
  distributor: "Distributor",
  wholesaler: "Wholesaler",
};

export const SUPPLIER_TAX_TYPE_LABELS: Record<TaxType, string> = {
  registered: "Registered",
  unregistered: "Unregistered",
  composition: "Composition",
};

export const SUPPLIER_LEDGER_TRANSACTION_LABELS: Record<SupplierLedgerTransactionType, string> = {
  opening_balance: "Opening Balance",
  purchase: "Purchase",
  purchase_return: "Purchase Return",
  payment: "Payment",
  debit_adjustment: "Debit Adjustment",
  credit_adjustment: "Credit Adjustment",
};
