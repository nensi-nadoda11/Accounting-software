import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import type { ProductPricePreview } from "../../../types/product";
import { formatInr } from "../productUtils";

export const TaxPreviewCard = ({ preview }: { preview: ProductPricePreview }) => (
  <Card>
    <CardHeader title="Tax Preview" />
    <CardContent className="grid gap-3 sm:grid-cols-2">
      {[
        { label: "Base Price", value: formatInr(preview.baseSalePrice) },
        { label: "GST Amount", value: formatInr(preview.gstAmount) },
        { label: "Cess Amount", value: formatInr(preview.cessAmount) },
        { label: "Final Price", value: formatInr(preview.finalSalePrice) },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
        </div>
      ))}
    </CardContent>
  </Card>
);
