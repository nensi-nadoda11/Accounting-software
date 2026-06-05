import { Card, CardContent } from "../../../components/ui/Card";
import type { StockCheckSummary as Summary } from "../../../types/stockCheck";

export const StockCheckSummary = ({ summary }: { summary: Summary }) => (
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {[
      { label: "Total Items", value: summary.totalItems, className: "text-slate-900" },
      { label: "Matched", value: summary.matchedItems, className: "text-emerald-700" },
      { label: "Short", value: summary.shortItems, className: "text-rose-700" },
      { label: "Excess", value: summary.excessItems, className: "text-amber-700" },
    ].map((item) => (
      <Card key={item.label}>
        <CardContent className="py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className={`mt-1 text-2xl font-semibold ${item.className}`}>{item.value}</p>
        </CardContent>
      </Card>
    ))}
  </div>
);
