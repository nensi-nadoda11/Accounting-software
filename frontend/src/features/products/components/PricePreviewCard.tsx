import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import type { ProductPricePreview } from "../../../types/product";
import { formatInr, formatPercent } from "../productUtils";

export const PricePreviewCard = ({
  preview,
  openingStockValue,
}: {
  preview: ProductPricePreview;
  openingStockValue: string;
}) => (
  <Card>
    <CardHeader title="Price Preview" />
    <CardContent className="grid gap-3 sm:grid-cols-2">
      {[
        { label: "Margin %", value: formatPercent(preview.marginPercentage) },
        { label: "Margin Amount", value: formatInr(preview.marginAmount) },
        { label: "Markup %", value: formatPercent(preview.markupPercentage) },
        { label: "Opening Value", value: formatInr(openingStockValue) },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);
