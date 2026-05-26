import { Card, CardContent } from "../../../components/ui/Card";
import { AmountText } from "./AmountText";

export const ReportSummaryCards = ({
  items,
}: {
  items: Array<{ label: string; value: string | number | null | undefined; tone?: "default" | "success" | "danger" | "warning" }>;
}) => (
  <div className={`grid gap-3 sm:grid-cols-2 ${items.length >= 5 ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
    {items.map((item) => (
      <Card key={item.label}>
        <CardContent className="min-w-0 space-y-2 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
          <AmountText value={item.value} tone={item.tone} className="text-lg" />
        </CardContent>
      </Card>
    ))}
  </div>
);
