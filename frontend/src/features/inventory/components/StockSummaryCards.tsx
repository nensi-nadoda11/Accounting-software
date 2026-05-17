import { AlertTriangle, ArchiveX, Boxes, Clock3, IndianRupee } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent } from "../../../components/ui/Card";
import type { StockSummary } from "../../../types/inventory";

const SummaryCardSkeleton = () => (
  <Card>
    <CardContent className="animate-pulse space-y-3 py-4">
      <div className="h-4 w-24 rounded bg-slate-100" />
      <div className="h-7 w-20 rounded bg-slate-100" />
    </CardContent>
  </Card>
);

export const StockSummaryCards = ({
  summary,
  loading,
}: {
  summary: StockSummary | null;
  loading?: boolean;
}) => {
  if (loading && !summary) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SummaryCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const items = [
    { label: "Stock Value", value: <AmountText value={summary?.totalStockValue ?? 0} />, icon: IndianRupee },
    { label: "Low Stock", value: summary?.lowStockCount ?? 0, icon: AlertTriangle },
    { label: "Out of Stock", value: summary?.outOfStockCount ?? 0, icon: ArchiveX },
    { label: "Expiring Soon", value: summary?.expiringSoonCount ?? 0, icon: Clock3 },
    { label: "Expired Stock", value: summary?.expiredStockCount ?? 0, icon: Boxes },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-start justify-between py-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
              <div className="text-2xl font-semibold text-slate-900">{item.value}</div>
            </div>
            <span className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
              <item.icon className="size-5" />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
