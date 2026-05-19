import type { ReactNode } from "react";

import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import type { DashboardPayrollSnapshot as DashboardPayrollSnapshotValue } from "../../../types/dashboard";

export const DashboardPayrollSnapshot = ({ snapshot }: { snapshot: DashboardPayrollSnapshotValue }) => (
  <Card>
    <CardHeader title="Payroll Snapshot" />
    <CardContent className="grid grid-cols-2 gap-3 p-4">
      <Metric label="Active Employees" value={snapshot.activeEmployees} />
      <Metric label="Unpaid Employees" value={snapshot.unpaidEmployees} />
      <Metric label="Payroll Cost" value={<AmountText value={snapshot.payrollCost} className="text-sm" tone="default" />} />
      <Metric label="Pending Salary" value={<AmountText value={snapshot.pendingSalary} className="text-sm" tone="default" />} />
    </CardContent>
  </Card>
);

const Metric = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-2xl bg-slate-50 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
  </div>
);
