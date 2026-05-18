import type {
  InvoiceStatus,
  InvoiceType,
  PaymentStatus,
  SalesPaymentMode,
  SalesPriceTaxType,
} from "../../types/sales";

export const SALES_STATUS_OPTIONS: Array<{ value: InvoiceStatus | ""; label: string }> = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
  { value: "partially_returned", label: "Partially Returned" },
];

export const SALES_PAYMENT_STATUS_OPTIONS: Array<{ value: PaymentStatus | ""; label: string }> = [
  { value: "", label: "All Payments" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export const SALES_INVOICE_TYPE_OPTIONS: Array<{ value: InvoiceType | ""; label: string }> = [
  { value: "", label: "All Types" },
  { value: "gst_invoice", label: "GST Invoice" },
  { value: "pos", label: "POS" },
];

export const SALES_PAYMENT_MODE_OPTIONS: Array<{ value: SalesPaymentMode; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
];

export const SALES_PRICE_TAX_TYPE_OPTIONS: Array<{ value: SalesPriceTaxType; label: string }> = [
  { value: "exclusive", label: "Exclusive" },
  { value: "inclusive", label: "Inclusive" },
];

export const SALES_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  cancelled: "Cancelled",
  returned: "Returned",
  partially_returned: "Partially Returned",
};

export const SALES_PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
};

export const SALES_PAYMENT_MODE_LABELS: Record<SalesPaymentMode, string> = {
  cash: "Cash",
  bank: "Bank",
  upi: "UPI",
  card: "Card",
  cheque: "Cheque",
};

export const SALES_INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  gst_invoice: "GST Invoice",
  pos: "POS",
};
