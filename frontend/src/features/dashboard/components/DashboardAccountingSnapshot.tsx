import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import type { DashboardAccountingSnapshot as DashboardAccountingSnapshotValue } from "../../../types/dashboard";

export const DashboardAccountingSnapshot = ({ snapshot }: { snapshot: DashboardAccountingSnapshotValue }) => (
  <Card>
    <CardHeader title="Accounting Snapshot" />
    <CardContent className="grid grid-cols-2 gap-3 p-4">
      <Metric label="Cash" value={snapshot.cashBalance} />
      <Metric label="Bank" value={snapshot.bankBalance} />
      <Metric label="Receivable" value={snapshot.receivable} />
      <Metric label="Payable" value={snapshot.payable} />
      <Metric label="Expense" value={snapshot.monthlyExpense} />
      <Metric label="Net Profit" value={snapshot.netProfit} />
    </CardContent>
  </Card>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-slate-50 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <AmountText value={value} className="mt-2 block text-sm" tone="default" />
  </div>
);
