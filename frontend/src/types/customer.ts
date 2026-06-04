export type CustomerStatus = "active" | "inactive" | "deleted";
export type CustomerMutableStatus = Exclude<CustomerStatus, "deleted">;
export type CustomerType = "individual" | "business";
export type TaxType = "registered" | "unregistered" | "composition";
export type CustomerSortBy = "name" | "createdAt" | "outstandingAmount" | "customerCode";
export type SortOrder = "asc" | "desc";
export type CustomerExportFormat = "csv" | "xlsx" | "pdf";
export type CustomerLedgerTransactionType =
  | "opening_balance"
  | "sale"
  | "sales_return"
  | "sales_return_refund"
  | "payment"
  | "debit_adjustment"
  | "credit_adjustment";

export interface Customer {
  id: string;
  companyId: string;
  customerCode: string;
  name: string;
  customerType: CustomerType;
  businessName: string | null;
  contactPerson: string | null;
  mobile: string;
  alternateMobile: string | null;
  email: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  taxType: TaxType;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPincode: string | null;
  billingCountry: string;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  shippingCountry: string;
  sameAsBilling: boolean;
  creditLimit: string;
  creditDays: number;
  defaultDiscount: string;
  status: CustomerStatus;
  isBlacklisted: boolean;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CustomerFormInput {
  name: string;
  customerType: CustomerType;
  businessName: string | null;
  contactPerson: string | null;
  mobile: string;
  alternateMobile: string | null;
  email: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  taxType: TaxType;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPincode: string | null;
  billingCountry: string;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  shippingCountry: string;
  sameAsBilling: boolean;
  creditLimit: number;
  creditDays: number;
  defaultDiscount: number;
  status: CustomerMutableStatus;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  notes: string | null;
}

export type CustomerCreatePayload = Omit<CustomerFormInput, "isBlacklisted" | "blacklistReason">;
export type CustomerUpdatePayload = Omit<CustomerFormInput, "status" | "isBlacklisted" | "blacklistReason">;

export interface CustomerListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: CustomerStatus;
  customerType?: CustomerType;
  taxType?: TaxType;
  hasOutstanding?: boolean;
  isBlacklisted?: boolean;
  sortBy?: CustomerSortBy;
  sortOrder?: SortOrder;
}

export interface CustomerListItem {
  id: string;
  customerCode: string;
  name: string;
  customerType: CustomerType;
  businessName: string | null;
  mobile: string;
  email: string | null;
  gstNumber: string | null;
  taxType: TaxType;
  status: CustomerStatus;
  isBlacklisted: boolean;
  creditLimit: string;
  createdAt: string;
  updatedAt: string;
  outstandingAmount: string;
}

export interface CustomerListResponse {
  items: CustomerListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerOutstandingSummary {
  openingBalance: string;
  totalSales: string;
  totalReturns: string;
  totalPayments: string;
  outstandingAmount: string;
  overdueAmount: string;
  creditLimit: string;
  creditUsedPercentage: string;
  remainingCreditLimit: string;
  isCreditLimitExceeded: boolean;
}

export interface CustomerDetailResponse {
  customer: Customer;
  outstandingSummary: CustomerOutstandingSummary;
}

export interface CustomerLedgerQuery {
  page: number;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
  transactionType?: CustomerLedgerTransactionType;
}

export interface CustomerLedgerRow {
  date: string;
  createdAt: string;
  transactionType: string;
  referenceNo: string | null;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  paymentMode: string | null;
  remarks: string | null;
}

export interface CustomerLedgerResponse {
  items: CustomerLedgerRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerPaymentsQuery {
  page: number;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface CustomerPaymentRow {
  id: string;
  date: string;
  amount: string;
  paymentMode: string | null;
  referenceNo: string | null;
  linkedInvoice: string | null;
  receiptNo: string | null;
  status: string | null;
  notes: string | null;
  remarks: string | null;
}

export interface CustomerPaymentsResponse {
  items: CustomerPaymentRow[];
  totals: {
    totalPayments: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerStatusUpdateInput {
  status: CustomerMutableStatus;
}

export interface CustomerBlacklistUpdateInput {
  isBlacklisted: boolean;
  reason?: string | null;
}

export interface DownloadFileResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}
