import type {
  CustomerLedgerTransactionType,
  CustomerMutableStatus,
  CustomerSortBy,
  CustomerStatus,
  CustomerType,
  SortOrder,
  TaxType,
} from "../../types/customer";

export const CUSTOMER_STATUS_OPTIONS: Array<{ value: CustomerStatus | ""; label: string }> = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "deleted", label: "Deleted" },
];

export const CUSTOMER_MUTABLE_STATUS_OPTIONS: Array<{ value: CustomerMutableStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const CUSTOMER_TYPE_OPTIONS: Array<{ value: CustomerType | ""; label: string }> = [
  { value: "", label: "All Types" },
  { value: "individual", label: "Individual" },
  { value: "business", label: "Business" },
];

export const FORM_CUSTOMER_TYPE_OPTIONS: Array<{ value: CustomerType; label: string }> = [
  { value: "individual", label: "Individual" },
  { value: "business", label: "Business" },
];

export const TAX_TYPE_OPTIONS: Array<{ value: TaxType | ""; label: string }> = [
  { value: "", label: "All Tax Types" },
  { value: "registered", label: "Registered" },
  { value: "unregistered", label: "Unregistered" },
  { value: "composition", label: "Composition" },
];

export const FORM_TAX_TYPE_OPTIONS: Array<{ value: TaxType; label: string }> = [
  { value: "registered", label: "Registered" },
  { value: "unregistered", label: "Unregistered" },
  { value: "composition", label: "Composition" },
];

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
} as const;

export const SORT_BY_OPTIONS: Array<{ value: CustomerSortBy; label: string }> = [
  { value: "createdAt", label: "Created Date" },
  { value: "name", label: "Name" },
  { value: "outstandingAmount", label: "Outstanding" },
  { value: "customerCode", label: "Customer Code" },
];

export const SORT_ORDER_OPTIONS: Array<{ value: SortOrder; label: string }> = [
  { value: "desc", label: "Newest First" },
  { value: "asc", label: "Oldest First" },
];

export const LEDGER_TRANSACTION_OPTIONS: Array<{ value: CustomerLedgerTransactionType | ""; label: string }> = [
  { value: "", label: "All Types" },
  { value: "opening_balance", label: "Opening Balance" },
  { value: "sale", label: "Sale" },
  { value: "sales_return", label: "Sales Return" },
  { value: "payment", label: "Payment" },
  { value: "debit_adjustment", label: "Debit Adjustment" },
  { value: "credit_adjustment", label: "Credit Adjustment" },
];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  deleted: "Deleted",
};

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: "Individual",
  business: "Business",
};

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  registered: "Registered",
  unregistered: "Unregistered",
  composition: "Composition",
};

export const LEDGER_TRANSACTION_LABELS: Record<CustomerLedgerTransactionType, string> = {
  opening_balance: "Opening Balance",
  sale: "Sale",
  sales_return: "Sales Return",
  payment: "Payment",
  debit_adjustment: "Debit Adjustment",
  credit_adjustment: "Credit Adjustment",
};
