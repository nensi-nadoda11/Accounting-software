import { AmountText } from "../../../components/ui/AmountText";
import { Card } from "../../../components/ui/Card";
import type { GstSummary } from "../../../types/gst";
import { getSummaryAdjustmentTotal } from "../gstUtils";

export const GstSummaryCards = ({ summary }: { summary: GstSummary }) => {
  const cards = [
    { label: "Taxable Sales", value: summary.taxableSales },
    { label: "Output GST", value: summary.outputGst },
    { label: "Taxable Purchases", value: summary.taxablePurchases },
    { label: "Input GST", value: summary.inputGst },
    { label: "Expense Input GST", value: summary.expenseInputGst },
    { label: "Sales Return GST", value: summary.returns.salesReturnGst },
    { label: "Purchase Return GST", value: summary.returns.purchaseReturnGst },
    { label: "Adjustments", value: getSummaryAdjustmentTotal(summary) },
    { label: "Net GST Payable", value: summary.netGstPayable },
    { label: "Net GST Credit", value: summary.netGstCredit },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="rounded-xl border-slate-200">
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
            <AmountText value={card.value} className="mt-2 block text-base font-semibold text-slate-900" tone="default" />
          </div>
        </Card>
      ))}
    </div>
  );
};
