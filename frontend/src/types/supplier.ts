export type SupplierStatus = "active" | "inactive" | "blocked" | "deleted";
export type SupplierMutableStatus = Exclude<SupplierStatus, "deleted">;
export type SupplierType = "individual" | "business" | "manufacturer" | "distributor" | "wholesaler";
export type TaxType = "registered" | "unregistered" | "composition";
export type SupplierOpeningBalanceType = "debit" | "credit" | "none";
export type SupplierSortBy = "name" | "createdAt" | "outstandingPayable" | "supplierCode";
export type SortOrder = "asc" | "desc";
export type SupplierExportFormat = "csv" | "xlsx" | "pdf";
export type SupplierLedgerTransactionType =
  | "opening_balance"
  | "purchase"
  | "purchase_return"
  | "payment"
  | "debit_adjustment"
  | "credit_adjustment";

export interface Supplier {
  id: string;
  companyId: string;
  supplierCode: string;
  name: string;
  supplierType: SupplierType;
  businessName: string | null;
  contactPerson: string | null;
  mobile: string;
  alternateMobile: string | null;
  email: string | null;
  website: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  tanNumber: string | null;
  taxType: TaxType;
  gstState: string | null;
  reverseChargeApplicable: boolean;
  msmeRegistered: boolean;
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
  openingBalanceAmount: string;
  openingBalanceType: SupplierOpeningBalanceType;
  creditLimit: string;
  creditDays: number;
  paymentTerms: string | null;
  defaultGstRate: string;
  defaultDiscount: string;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankBranch: string | null;
  upiId: string | null;
  status: SupplierStatus;
  isBlacklisted: boolean;
  isPreferred: boolean;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SupplierFormInput {
  name: string;
  supplierType: SupplierType;
  businessName: string | null;
  contactPerson: string | null;
  mobile: string;
  alternateMobile: string | null;
  email: string | null;
  website: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  tanNumber: string | null;
  taxType: TaxType;
  gstState: string | null;
  reverseChargeApplicable: boolean;
  msmeRegistered: boolean;
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
  openingBalanceAmount: number;
  openingBalanceType: SupplierOpeningBalanceType;
  creditLimit: number;
  creditDays: number;
  paymentTerms: string | null;
  defaultGstRate: number;
  defaultDiscount: number;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankBranch: string | null;
  upiId: string | null;
  status: SupplierMutableStatus;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  isPreferred: boolean;
  notes: string | null;
}

export type SupplierCreatePayload = Omit<SupplierFormInput, "isBlacklisted" | "blacklistReason">;
export type SupplierUpdatePayload = Omit<SupplierFormInput, "status" | "isBlacklisted" | "blacklistReason" | "isPreferred">;

export interface SupplierListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: SupplierStatus;
  supplierType?: SupplierType;
  taxType?: TaxType;
  hasOutstanding?: boolean;
  isBlacklisted?: boolean;
  isPreferred?: boolean;
  sortBy?: SupplierSortBy;
  sortOrder?: SortOrder;
}

export interface SupplierOutstandingSummary {
  openingBalance: string;
  totalPurchases: string;
  totalPurchaseReturns: string;
  totalPaymentsMade: string;
  outstandingPayable: string;
  overduePayable: string;
  creditLimit: string;
  creditDays: number;
  dueInvoicesCount: number;
  isCreditLimitExceeded: boolean;
  remainingCreditLimit: string;
}

export interface SupplierListItem {
  id: string;
  supplierCode: string;
  name: string;
  supplierType: SupplierType;
  businessName: string | null;
  mobile: string;
  email: string | null;
  gstNumber: string | null;
  taxType: TaxType;
  status: SupplierStatus;
  isBlacklisted: boolean;
  isPreferred: boolean;
  createdAt: string;
  updatedAt: string;
  creditDays: number;
  outstandingSummary: SupplierOutstandingSummary;
}

export interface SupplierListResponse {
  items: SupplierListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SupplierDetailResponse {
  supplier: Supplier;
  outstandingSummary: SupplierOutstandingSummary;
}

export interface SupplierLedgerQuery {
  page: number;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
  transactionType?: SupplierLedgerTransactionType;
}

export interface SupplierLedgerRow {
  date: string;
  transactionType: string;
  referenceNo: string | null;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  paymentMode: string | null;
  remarks: string | null;
}

export interface SupplierLedgerResponse {
  items: SupplierLedgerRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SupplierPurchasesQuery {
  page: number;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

export interface SupplierPurchaseRow {
  id: string;
  date: string;
  purchaseInvoiceNo?: string | null;
  referenceNo?: string | null;
  itemsCount?: number | null;
  gst?: string | null;
  gstAmount?: string | null;
  totalAmount?: string | null;
  grossAmount?: string | null;
  paidAmount?: string | null;
  dueAmount?: string | null;
  status?: string | null;
  remarks?: string | null;
  returnAmount?: string | null;
}

export interface SupplierPurchasesResponse {
  items: SupplierPurchaseRow[];
  totals: {
    totalPurchases: string;
    totalPurchaseReturns: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SupplierPaymentsQuery {
  page: number;
  limit: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface SupplierPaymentRow {
  id: string;
  date: string;
  amount: string;
  paymentMode?: string | null;
  referenceNo?: string | null;
  linkedPurchase?: string | null;
  linkedInvoice?: string | null;
  receiptNo?: string | null;
  status?: string | null;
  notes?: string | null;
  remarks?: string | null;
}

export interface SupplierPaymentsResponse {
  items: SupplierPaymentRow[];
  totals: {
    totalPaymentsMade: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SupplierStatusUpdateInput {
  status: SupplierMutableStatus;
}

export interface SupplierBlacklistUpdateInput {
  isBlacklisted: boolean;
  reason?: string | null;
}

export interface SupplierPreferredUpdateInput {
  isPreferred: boolean;
}

export interface DownloadFileResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}
