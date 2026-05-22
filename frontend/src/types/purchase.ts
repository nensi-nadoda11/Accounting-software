export type PurchaseStatus = "draft" | "posted" | "cancelled" | "returned";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "overdue";
export type PurchasePaymentMode = "cash" | "bank" | "upi" | "card" | "cheque";
export type PurchasePriceTaxType = "inclusive" | "exclusive";
export type PurchaseExportFormat = "csv" | "xlsx" | "pdf";
export type PurchaseReturnSettlementStatus = "pending" | "partial" | "settled";

export interface PurchasePartyRef {
  id: string;
  name: string;
  supplierCode?: string | null;
  gstNumber?: string | null;
  gstState?: string | null;
  mobile?: string | null;
}

export interface PurchaseWarehouseRef {
  id: string;
  name: string | null;
  warehouseCode: string | null;
}

export interface PurchaseProductRef {
  id: string;
  productCode: string;
  productType: "goods" | "service";
  stockTrackingEnabled: boolean;
}

export interface PurchaseBatchRef {
  id: string;
  batchNumber: string | null;
}

export interface PurchaseInvoiceItem {
  id: string;
  lineNumber: number;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  hsnSacSnapshot: string | null;
  unitSnapshot: string | null;
  quantity: string;
  freeQuantity: string;
  purchaseRate: string;
  priceTaxType: PurchasePriceTaxType;
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
  manufacturingDate: string | null;
  expiryDate: string | null;
  remarks: string | null;
  warehouse: PurchaseWarehouseRef | null;
  batch: PurchaseBatchRef | null;
  product: PurchaseProductRef;
}

export interface PurchasePayment {
  id: string;
  paymentDate: string;
  amount: string;
  paymentMode: PurchasePaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface PurchaseReturnItem {
  id: string;
  purchaseInvoiceItemId: string;
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

export interface PurchaseReturnRefund {
  id: string;
  refundDate: string;
  amount: string;
  paymentMode: PurchasePaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  purchaseInvoiceId: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName: string;
  supplierCode: string | null;
  returnDate: string;
  grandTotal: string;
  adjustedAmount: string;
  refundedAmount: string;
  remainingRefundAmount: string;
  settlementStatus: PurchaseReturnSettlementStatus;
  gstTotal: string;
  subtotal: string;
  roundOffAmount: string;
  warehouse: PurchaseWarehouseRef | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseReturnItem[];
  refunds?: PurchaseReturnRefund[];
}

export interface PurchaseTotals {
  subtotal: string;
  itemDiscountTotal: string;
  invoiceDiscountTotal: string;
  additionalCharges: string;
  freightCharges: string;
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

export interface PurchaseInvoice extends PurchaseTotals {
  id: string;
  purchaseNumber: string;
  supplierInvoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string | null;
  purchaseStatus: PurchaseStatus;
  paymentMode: PurchasePaymentMode | null;
  paymentReference: string | null;
  bankAccountId: string | null;
  notes: string | null;
  termsConditions: string | null;
  attachmentUrl: string | null;
  accountingEventCreated: boolean;
  postedAt: string | null;
  cancelledAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: PurchasePartyRef;
  warehouse: PurchaseWarehouseRef | null;
  items?: PurchaseInvoiceItem[];
  payments?: PurchasePayment[];
  returns?: PurchaseReturn[];
}

export interface PurchaseInvoiceListItem {
  id: string;
  purchaseNumber: string;
  supplierInvoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string | null;
  purchaseStatus: PurchaseStatus;
  paymentStatus: PaymentStatus;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  supplier: {
    id: string;
    name: string;
    supplierCode: string | null;
  };
  warehouse: PurchaseWarehouseRef | null;
  createdAt: string;
}

export interface PurchaseListQuery {
  page: number;
  limit: number;
  search?: string;
  purchaseStatus?: PurchaseStatus | "";
  paymentStatus?: PaymentStatus | "";
  supplierId?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PurchaseReturnsListQuery {
  page: number;
  limit: number;
  search?: string;
  supplierId?: string;
  purchaseInvoiceId?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PurchasePaymentsQuery {
  page: number;
  limit: number;
}

export interface PurchaseFormItemInput {
  productId: string;
  warehouseId: string | null;
  batchId: string | null;
  batchNumber: string | null;
  quantity: number;
  freeQuantity: number;
  purchaseRate: number;
  priceTaxType: PurchasePriceTaxType;
  discountPercent: number;
  discountAmount: number;
  gstRate: number;
  cessRate: number;
  manufacturingDate: string | null;
  expiryDate: string | null;
  remarks: string | null;
}

export interface PurchaseFormInput {
  supplierId: string;
  supplierInvoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string | null;
  warehouseId: string | null;
  purchaseStatus: "draft" | "posted";
  items: PurchaseFormItemInput[];
  invoiceDiscountTotal: number;
  additionalCharges: number;
  freightCharges: number;
  paidAmount: number;
  paymentMode: PurchasePaymentMode | null;
  paymentReference: string | null;
  bankAccountId: string | null;
  notes: string | null;
  termsConditions: string | null;
  attachmentUrl?: string | null;
}

export interface PurchasePaymentInput {
  paymentDate: string;
  amount: number;
  paymentMode: PurchasePaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
}

export interface PurchaseReturnInputItem {
  purchaseInvoiceItemId: string;
  quantity: number;
  remarks: string | null;
}

export interface PurchaseReturnInput {
  purchaseInvoiceId: string;
  returnDate: string;
  warehouseId: string | null;
  refundAmountReceived: number;
  refundPaymentMode: PurchasePaymentMode | null;
  refundBankAccountId: string | null;
  refundReferenceNumber: string | null;
  refundNotes: string | null;
  notes: string;
  items: PurchaseReturnInputItem[];
}

export interface PurchaseReturnRefundInput {
  refundDate: string;
  amount: number;
  paymentMode: PurchasePaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
}

export interface PurchaseListResponse {
  items: PurchaseInvoiceListItem[];
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

export interface PurchaseDetailResponse {
  invoice: PurchaseInvoice;
}

export interface PurchasePaymentsResponse {
  items: PurchasePayment[];
  totals: {
    totalAmount: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PurchasePaymentMutationResponse {
  payment: PurchasePayment;
  invoice: {
    id: string;
    paidAmount: string;
    dueAmount: string;
    paymentStatus: PaymentStatus;
  };
}

export interface PurchaseReturnsResponse {
  items: PurchaseReturn[];
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

export interface PurchaseReturnDetailResponse {
  purchaseReturn: PurchaseReturn;
}
