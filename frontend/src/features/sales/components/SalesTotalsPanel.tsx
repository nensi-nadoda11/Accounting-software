import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { SALES_PAYMENT_STATUS_LABELS } from "../salesOptions";
import type { SalesPreviewTotals } from "../salesUtils";

const defaultRows = [
  { key: "subtotal", label: "Subtotal" },
  { key: "itemDiscountTotal", label: "Item Discount" },
  { key: "invoiceDiscountTotal", label: "Invoice Discount" },
  { key: "deliveryCharges", label: "Delivery" },
  { key: "packingCharges", label: "Packing" },
  { key: "otherCharges", label: "Other Charges" },
  { key: "taxableAmount", label: "Taxable" },
  { key: "cgstTotal", label: "CGST" },
  { key: "sgstTotal", label: "SGST" },
  { key: "igstTotal", label: "IGST" },
  { key: "cessTotal", label: "Cess" },
  { key: "gstTotal", label: "GST Total" },
  { key: "roundOffAmount", label: "Round Off" },
  { key: "grandTotal", label: "Grand Total" },
  { key: "paidAmount", label: "Paid" },
  { key: "dueAmount", label: "Due" },
] as const;

type SalesTotalsRowKey = (typeof defaultRows)[number]["key"];
type SalesTotalsRow = {
  key: SalesTotalsRowKey;
  label: string;
  emphasis?: boolean;
  tone?: "default" | "success" | "danger" | "warning";
};

export const SalesTotalsPanel = ({
  totals,
  sticky = true,
  title = "Totals",
  rows = defaultRows,
  showStatus = true,
}: {
  totals: SalesPreviewTotals;
  sticky?: boolean;
  title?: string;
  rows?: readonly SalesTotalsRow[];
  showStatus?: boolean;
}) => (
  <Card className={sticky ? "lg:sticky lg:top-6" : undefined}>
    <CardHeader
      title={title}
      action={
        showStatus ? <StatusBadge status={totals.paymentStatus} label={SALES_PAYMENT_STATUS_LABELS[totals.paymentStatus]} /> : undefined
      }
    />
    <CardContent className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.key}
          className={`flex items-center justify-between text-sm ${
            row.emphasis || row.key === "grandTotal"
              ? "border-t border-slate-200 pt-3 font-semibold text-slate-900"
              : "text-slate-600"
          }`}
        >
          <span>{row.label}</span>
          <AmountText
            value={totals[row.key]}
            tone={row.tone ?? (row.key === "dueAmount" ? "danger" : "default")}
            className={row.emphasis || row.key === "grandTotal" ? "text-base" : ""}
          />
        </div>
      ))}
    </CardContent>
  </Card>
);
