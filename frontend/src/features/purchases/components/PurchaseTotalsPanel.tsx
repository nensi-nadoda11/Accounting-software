import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { AmountText } from "../../../components/ui/AmountText";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { PurchasePreviewTotals } from "../purchaseUtils";
import { PURCHASE_PAYMENT_STATUS_LABELS } from "../purchaseOptions";

const rows = [
  { key: "subtotal", label: "Subtotal" },
  { key: "itemDiscountTotal", label: "Item Discount" },
  { key: "invoiceDiscountTotal", label: "Invoice Discount" },
  { key: "additionalCharges", label: "Additional Charges" },
  { key: "freightCharges", label: "Freight" },
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

export const PurchaseTotalsPanel = ({
  totals,
}: {
  totals: PurchasePreviewTotals;
}) => (
  <Card className="lg:sticky lg:top-6">
    <CardHeader
      title="Totals"
      action={<StatusBadge status={totals.paymentStatus} label={PURCHASE_PAYMENT_STATUS_LABELS[totals.paymentStatus]} />}
    />
    <CardContent className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.key}
          className={`flex items-center justify-between text-sm ${row.key === "grandTotal" ? "border-t border-slate-200 pt-3 font-semibold" : "text-slate-600"}`}
        >
          <span>{row.label}</span>
          <AmountText
            value={totals[row.key]}
            tone={row.key === "dueAmount" ? "danger" : row.key === "grandTotal" ? "default" : "default"}
            className={row.key === "grandTotal" ? "text-base" : ""}
          />
        </div>
      ))}
    </CardContent>
  </Card>
);
