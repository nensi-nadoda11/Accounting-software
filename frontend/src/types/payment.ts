export type PaymentType = "customer_receive" | "supplier_pay";
export type PartyType = "customer" | "supplier";
export type PaymentMode = "cash" | "bank" | "upi" | "card" | "cheque" | "neft" | "rtgs" | "imps" | "other";
export type PaymentStatus = "draft" | "completed" | "cancelled" | "bounced" | "reversed";
export type PaymentAllocationType = "sales_invoice" | "purchase_invoice" | "advance_adjustment";
export type PaymentReceiptType = "customer_receipt" | "supplier_voucher";
export type PaymentReminderReferenceType = "sales_invoice" | "purchase_invoice" | "advance" | "manual";
export type PaymentReminderChannel = "in_app" | "email" | "whatsapp";
export type PaymentReminderStatus = "pending" | "sent" | "failed" | "cancelled";
export type ChequeStatus = "received" | "issued" | "deposited" | "cleared" | "bounced" | "cancelled";
export type PaymentAllocationStatus = "unallocated" | "advance" | "fully_allocated" | "partially_allocated";
export type PaymentAgingBucket = "current" | "1-30" | "31-60" | "61-90" | "91-180" | "181+";
export type PaymentExportFormat = "csv" | "xlsx" | "pdf";

export interface PaymentPartySummary {
  id: string;
  name: string | null;
  code: string | null;
  mobile?: string | null;
  email?: string | null;
}

export interface PaymentBankSummary {
  id: string;
  bankName: string;
  accountNumber: string;
  upiId: string | null;
}

export interface PaymentAllocation {
  id: string;
  allocationType: PaymentAllocationType;
  referenceId: string | null;
  referenceNumber: string | null;
  allocatedAmount: string;
  allocationDate: string | null;
}

export interface PaymentReceiptData {
  receiptNumber: string;
  receiptType: PaymentReceiptType;
  payment: {
    id: string;
    paymentNumber: string;
    paymentDate: string;
    paymentType: PaymentType;
    paymentMode: PaymentMode;
    amount: string;
    allocatedAmount: string;
    unallocatedAmount: string;
    referenceNumber: string | null;
    notes: string | null;
  };
  party: {
    id: string;
    code: string;
    name: string;
    email?: string | null;
    mobile?: string | null;
    partyType: PartyType;
  };
  bankAccount: PaymentBankSummary | null;
  allocations: PaymentAllocation[];
  generatedAt: string;
}

export interface PaymentReceipt {
  id: string;
  receiptNumber: string;
  receiptType: PaymentReceiptType;
  generatedAt: string;
  pdfUrl: string | null;
  receiptData?: PaymentReceiptData;
}

export interface ChequeTransaction {
  id: string;
  chequeNumber: string;
  chequeDate: string;
  bankName: string;
  status: ChequeStatus;
  statusDate: string;
  remarks: string | null;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  receiptNumber: string | null;
  paymentType: PaymentType;
  partyType: PartyType;
  partyId: string;
  paymentDate: string;
  amount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
  paymentMode: PaymentMode;
  referenceNumber: string | null;
  status: PaymentStatus;
  isAdvance: boolean;
  chequeNumber: string | null;
  chequeDate: string | null;
  chequeBankName: string | null;
  chequeStatus: ChequeStatus | null;
  notes: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  receiptGeneratedAt: string | null;
  accountingEventCreated: boolean;
  paymentAllocationStatus: PaymentAllocationStatus;
  party: PaymentPartySummary | null;
  bankAccount?: PaymentBankSummary | null;
  allocations?: PaymentAllocation[];
  receipt?: PaymentReceipt | null;
  chequeTransactions?: ChequeTransaction[];
}

export interface PaymentListSummary {
  amount: string;
  allocatedAmount: string;
  unallocatedAmount: string;
}

export interface PaymentListResponse {
  items: Payment[];
  summary: PaymentListSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaymentDetailResponse {
  payment: Payment;
}

export interface PaymentAllocationsResponse {
  items: PaymentAllocation[];
  totals: {
    allocatedAmount: string;
  };
}

export interface DueItem {
  referenceType: "sales_invoice" | "purchase_invoice";
  referenceId: string;
  referenceNumber: string;
  partyId: string;
  partyName: string | null;
  partyCode: string | null;
  invoiceDate: string;
  dueDate: string | null;
  grandTotal: string;
  paidAmount: string;
  dueAmount: string;
  agingBucket: PaymentAgingBucket;
}

export interface DueTrackingRow extends DueItem {
  advanceBalance: string;
}

export interface DueTrackingResponse {
  items: DueTrackingRow[];
  summary: {
    totalDue: string;
    aging: Record<PaymentAgingBucket, string>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PartyDueItemsResponse {
  items: DueItem[];
  advanceBalance: string;
  aging: Record<PaymentAgingBucket, string>;
}

export interface PaymentReminder {
  id: string;
  partyType: PartyType;
  partyId: string;
  partyName: string | null;
  referenceType: PaymentReminderReferenceType;
  referenceId: string | null;
  referenceNumber: string | null;
  dueDate: string;
  amountDue: string;
  channel: PaymentReminderChannel;
  status: PaymentReminderStatus;
  message: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRemindersResponse {
  items: PaymentReminder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaymentFormAllocationInput {
  allocationType: PaymentAllocationType;
  referenceId: string | null;
  referenceNumber: string | null;
  allocatedAmount: number;
  allocationDate: string | null;
}

export interface PaymentFormInput {
  paymentType: PaymentType;
  partyType: PartyType;
  partyId: string;
  paymentDate: string;
  amount: number;
  paymentMode: PaymentMode;
  bankAccountId: string | null;
  referenceNumber: string | null;
  notes: string | null;
  status: "draft" | "completed";
  isAdvance: boolean;
  chequeNumber: string | null;
  chequeDate: string | null;
  chequeBankName: string | null;
  chequeStatus: ChequeStatus | null;
  allocations: PaymentFormAllocationInput[];
}

export interface PaymentListQuery {
  page: number;
  limit: number;
  search?: string;
  partyType?: PartyType | "";
  paymentType?: PaymentType | "";
  partyId?: string;
  paymentMode?: PaymentMode | "";
  status?: PaymentStatus | "";
  dateFrom?: string;
  dateTo?: string;
  isAdvance?: boolean;
}

export interface DueTrackingQuery {
  page: number;
  limit: number;
  partyId?: string;
  dateFrom?: string;
  dateTo?: string;
  overdueOnly?: boolean;
  agingBucket?: PaymentAgingBucket;
}

export interface PaymentReminderQuery {
  page: number;
  limit: number;
  partyType?: PartyType | "";
  partyId?: string;
  status?: PaymentReminderStatus | "";
  dateFrom?: string;
  dateTo?: string;
}

export interface UpdatePaymentInput {
  paymentDate?: string;
  amount?: number;
  paymentMode?: PaymentMode;
  bankAccountId?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  chequeBankName?: string | null;
  chequeStatus?: ChequeStatus | null;
  allocations?: PaymentFormAllocationInput[];
}

export interface CompletePaymentInput {
  allocations?: PaymentFormAllocationInput[];
}

export interface CancelPaymentInput {
  reason: string;
}

export interface SendReceiptInput {
  email?: string | null;
  subject?: string | null;
  message?: string | null;
}

export interface SendReminderInput {
  partyType: PartyType;
  partyId: string;
  referenceType: PaymentReminderReferenceType;
  referenceId?: string | null;
  referenceNumber?: string | null;
  dueDate: string;
  amountDue: number;
  channel: PaymentReminderChannel;
  message?: string | null;
}

export interface UpdateReminderStatusInput {
  status: PaymentReminderStatus;
  errorMessage?: string | null;
}

export interface UpdateChequeStatusInput {
  chequeStatus: ChequeStatus;
  statusDate?: string;
  remarks?: string | null;
  reason?: string | null;
}

export interface PaymentPdfPayload {
  pdfAvailable: boolean;
  receipt: PaymentReceiptData;
}

export interface DownloadFileResult {
  blob: Blob;
  fileName: string;
  contentType: string;
}
