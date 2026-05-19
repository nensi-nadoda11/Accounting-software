import type { ReactNode } from "react";

import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import type { DashboardInventorySnapshot as DashboardInventorySnapshotValue } from "../../../types/dashboard";

export const DashboardInventorySnapshot = ({ snapshot }: { snapshot: DashboardInventorySnapshotValue }) => (
  <Card>
    <CardHeader title="Inventory Snapshot" />
    <CardContent className="grid grid-cols-2 gap-3 p-4">
      <Metric label="Products" value={snapshot.totalProducts} />
      <Metric label="Tracked" value={snapshot.trackedProducts} />
      <Metric label="Low Stock" value={snapshot.lowStockCount} />
      <Metric label="Expiring" value={snapshot.expiringCount} />
      <Metric label="Stock Qty" value={Number(snapshot.totalStockQuantity).toFixed(2)} />
      <Metric label="Stock Value" value={<AmountText value={snapshot.stockValue} className="text-sm" tone="default" />} />
    </CardContent>
  </Card>
);

const Metric = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-2xl bg-slate-50 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
  </div>
);
