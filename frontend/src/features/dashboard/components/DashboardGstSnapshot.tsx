import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import type { DashboardGstSnapshot as DashboardGstSnapshotValue } from "../../../types/dashboard";

export const DashboardGstSnapshot = ({ snapshot }: { snapshot: DashboardGstSnapshotValue }) => (
  <Card>
    <CardHeader title="GST Snapshot" />
    <CardContent className="grid grid-cols-2 gap-3 p-4">
      <Metric label="Taxable Sales" value={snapshot.taxableSales} />
      <Metric label="Output GST" value={snapshot.outputGst} />
      <Metric label="ITC Used" value={snapshot.inputGst} />
      <Metric label="Net Payable" value={snapshot.netGstPayable} />
      <Metric label="Unclaimed ITC" value={snapshot.unclaimedItc} />
    </CardContent>
  </Card>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-slate-50 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <AmountText value={value} className="mt-2 block text-sm" tone="default" />
  </div>
);
