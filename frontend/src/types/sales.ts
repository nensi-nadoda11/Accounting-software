export type InvoiceStatus = "draft" | "posted" | "cancelled" | "returned" | "partially_returned";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "overdue";
export type SalesPaymentMode = "cash" | "bank" | "upi" | "card" | "cheque";
export type InvoiceType = "gst_invoice" | "pos";
export type SalesPriceTaxType = "inclusive" | "exclusive";
export type SalesExportFormat = "csv" | "xlsx" | "pdf";
export type SalesReturnSettlementStatus = "pending" | "partial" | "settled";

export interface SalesCustomerRef {
  id: string;
  customerCode: string | null;
  name: string;
  mobile: string | null;
  email: string | null;
  gstNumber: string | null;
}

export interface SalesWarehouseRef {
  id: string;
  name: string | null;
  warehouseCode: string | null;
}

export interface SalesProductRef {
  id: string;
  productCode: string;
  productType: "goods" | "service";
  stockTrackingEnabled: boolean;
}

export interface SalesBatchRef {
  id: string;
  batchNumber: string | null;
}

export interface SalesInvoiceItem {
  id: string;
  lineNumber: number;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  hsnSacSnapshot: string | null;
  unitSnapshot: string | null;
  quantity: string;
  saleRate: string;
  mrp: string;
  priceTaxType: SalesPriceTaxType;
  discountPercent: string;
  discountAmount: string;
  taxableAmount: string;
  gstRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  cessRate: string;
  cessAmount: string;
  lineTotal: string;
  returnedQuantity: string;
  remarks: string | null;
  warehouse: SalesWarehouseRef | null;
  batch: SalesBatchRef | null;
  product: SalesProductRef;
}

export interface SalesPayment {
  id: string;
  paymentDate: string;
  amount: string;
  paymentMode: SalesPaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface SalesReturnItem {
  id: string;
  salesInvoiceItemId: string;
  productId: string;
  productName: string;
  productCode: string;
  quantity: string;
  returnRate: string;
  taxableAmount: string;
  gstRate: string;
  gstAmount: string;
  lineTotal: string;
}

export interface SalesReturnRefund {
  id: string;
  refundDate: string;
  amount: string;
  paymentMode: SalesPaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface SalesReturn {
  id: string;
  returnNumber: string;
  salesInvoiceId: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName?: string | null;
  returnDate: string;
  grandTotal: string;
  adjustedAmount: string;
  refundedAmount: string;
  remainingRefundAmount: string;
  settlementStatus: SalesReturnSettlementStatus;
  gstTotal: string;
  subtotal: string;
  roundOffAmount: string;
  warehouse: SalesWarehouseRef | null;
  reason: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items?: SalesReturnItem[];
  refunds?: SalesReturnRefund[];
}

export interface SalesSendLog {
  id: string;
  channel: "email" | "whatsapp";
  sentTo: string;
  status: "pending" | "sent" | "failed";
  errorMessage: string | null;
  sentAt?: string | null;
  createdBy?: string | null;
  createdAt?: string;
}

export interface SalesTotals {
  subtotal: string;
  itemDiscountTotal: string;
  invoiceDiscountTotal: string;
  deliveryCharges: string;
  packingCharges: string;
  otherCharges: string;
  taxableAmount: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  cessTotal: string;
  gstTotal: string;
  roundOffAmount: string;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  paymentStatus: PaymentStatus;
}

export interface SalesInvoice extends SalesTotals {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  invoiceDate: string;
  dueDate: string | null;
  placeOfSupply: string;
  isWalkIn: boolean;
  walkInName: string | null;
  walkInMobile: string | null;
  customerNameSnapshot: string;
  customerGstSnapshot: string | null;
  customerPanSnapshot: string | null;
  billingAddressSnapshot: Record<string, string | null> | null;
  shippingAddressSnapshot: Record<string, string | null> | null;
  priceTaxType: SalesPriceTaxType;
  invoiceStatus: InvoiceStatus;
  paymentMode: SalesPaymentMode | null;
  paymentReference: string | null;
  bankAccountId: string | null;
  notes: string | null;
  termsConditions: string | null;
  accountingEventCreated: boolean;
  postedAt: string | null;
  cancelledAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse: SalesWarehouseRef;
  customer: SalesCustomerRef | null;
  items?: SalesInvoiceItem[];
  payments?: SalesPayment[];
  returns?: SalesReturn[];
  sendLogs?: SalesSendLog[];
}

export interface SalesInvoiceListItem {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  invoiceDate: string;
  customerId: string | null;
  customerName: string;
  walkInName: string | null;
  warehouse: SalesWarehouseRef;
  invoiceStatus: InvoiceStatus;
  paymentStatus: PaymentStatus;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  createdAt: string;
}

export interface SalesListQuery {
  page: number;
  limit: number;
  search?: string;
  invoiceStatus?: InvoiceStatus | "";
  paymentStatus?: PaymentStatus | "";
  customerId?: string;
  warehouseId?: string;
  invoiceType?: InvoiceType | "";
  dateFrom?: string;
  dateTo?: string;
}

export interface SalesReturnsListQuery {
  page: number;
  limit: number;
  search?: string;
  customerId?: string;
  salesInvoiceId?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SalesPaymentsQuery {
  page: number;
  limit: number;
}

export interface SalesInvoiceItemInput {
  productId: string;
  warehouseId: string | null;
  batchId: string | null;
  quantity: number;
  saleRate: number;
  mrp: number;
  priceTaxType: SalesPriceTaxType;
  discountPercent: number;
  discountAmount: number;
  gstRate: number;
  cessRate: number;
  remarks: string | null;
}

export interface SalesFormInput {
  invoiceType: InvoiceType;
  invoiceStatus: "draft" | "posted";
  invoiceDate: string;
  dueDate: string | null;
  customerId: string | null;
  isWalkIn: boolean;
  walkInName: string | null;
  walkInMobile: string | null;
  placeOfSupply: string | null;
  warehouseId: string;
  priceTaxType: SalesPriceTaxType;
  items: SalesInvoiceItemInput[];
  invoiceDiscountTotal: number;
  deliveryCharges: number;
  packingCharges: number;
  otherCharges: number;
  paidAmount: number;
  paymentMode: SalesPaymentMode | null;
  paymentReference: string | null;
  bankAccountId: string | null;
  notes: string | null;
  termsConditions: string | null;
}

export interface SalesPaymentInput {
  paymentDate: string;
  amount: number;
  paymentMode: SalesPaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
}

export interface SalesReturnInputItem {
  salesInvoiceItemId: string;
  quantity: number;
  remarks: string | null;
}

export interface SalesReturnInput {
  salesInvoiceId: string;
  returnDate: string;
  warehouseId?: string | null;
  refundAmountPaid: number;
  refundPaymentMode: SalesPaymentMode | null;
  refundBankAccountId: string | null;
  refundReferenceNumber: string | null;
  refundNotes: string | null;
  reason: string;
  notes: string | null;
  items: SalesReturnInputItem[];
}

export interface SalesReturnRefundInput {
  refundDate: string;
  amount: number;
  paymentMode: SalesPaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
}

export interface SalesListResponse {
  items: SalesInvoiceListItem[];
  summary: {
    grandTotal: string;
    paidAmount: string;
    dueAmount: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SalesDetailResponse {
  invoice: SalesInvoice;
  warnings?: string[];
}

export interface SalesPaymentsResponse {
  items: SalesPayment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SalesPaymentMutationResponse {
  payment: SalesPayment;
  invoice: {
    id: string;
    paidAmount: string;
    dueAmount: string;
    paymentStatus: PaymentStatus;
  };
}

export interface SalesReturnsResponse {
  items: SalesReturn[];
  summary: {
    grandTotal: string;
    refundedAmount: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SalesReturnDetailResponse {
  salesReturn: SalesReturn;
}

export interface SalesBarcodeLookupItem {
  id: string;
  productCode: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  productType: "goods" | "service";
  salePrice: string;
  mrp: string;
  minimumSalePrice: string;
  priceTaxType: SalesPriceTaxType;
  gstRate: string;
  cessRate: string;
  stockTrackingEnabled: boolean;
  totalStock: string;
}

export interface SalesBarcodeLookupResponse {
  items: SalesBarcodeLookupItem[];
}

export interface SalesPdfResponse {
  pdfAvailable: boolean;
  invoice: SalesInvoice;
}
