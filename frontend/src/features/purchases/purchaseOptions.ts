import type {
  PaymentStatus,
  PurchasePaymentMode,
  PurchasePriceTaxType,
  PurchaseStatus,
} from "../../types/purchase";

export const PURCHASE_STATUS_OPTIONS: Array<{ value: PurchaseStatus | ""; label: string }> = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
];

export const PURCHASE_PAYMENT_STATUS_OPTIONS: Array<{ value: PaymentStatus | ""; label: string }> = [
  { value: "", label: "All Payments" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export const PURCHASE_FORM_STATUS_OPTIONS: Array<{ value: "draft" | "posted"; label: string }> = [
  { value: "draft", label: "Save Draft" },
  { value: "posted", label: "Save & Post" },
];

export const PURCHASE_PAYMENT_MODE_OPTIONS: Array<{ value: PurchasePaymentMode; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
];

export const PURCHASE_PRICE_TAX_TYPE_OPTIONS: Array<{ value: PurchasePriceTaxType; label: string }> = [
  { value: "exclusive", label: "Exclusive" },
  { value: "inclusive", label: "Inclusive" },
];

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const PURCHASE_PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
};

export const PURCHASE_PAYMENT_MODE_LABELS: Record<PurchasePaymentMode, string> = {
  cash: "Cash",
  bank: "Bank",
  upi: "UPI",
  card: "Card",
  cheque: "Cheque",
};
