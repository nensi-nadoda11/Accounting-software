import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent } from "../../../components/ui/Card";
import type { ReactNode } from "react";
import type { CashVerificationStatus } from "../../../types/cashVerification";
import { StatusBadge } from "./StatusBadge";

const getDifferenceTone = (value: string | number) => {
  const numeric = Number(value);
  if (numeric < 0) {
    return "danger" as const;
  }
  if (numeric > 0) {
    return "warning" as const;
  }
  return "success" as const;
};

export const CashVerificationSummary = ({
  expectedCash,
  actualCash,
  differenceAmount,
  status,
}: {
  expectedCash: string | number;
  actualCash: string | number;
  differenceAmount: string | number;
  status: CashVerificationStatus;
}) => (
  <Card>
    <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Expected Cash" value={<AmountText value={expectedCash} />} />
      <Metric label="Actual Cash" value={<AmountText value={actualCash} />} />
      <Metric label="Difference" value={<AmountText value={differenceAmount} tone={getDifferenceTone(differenceAmount)} />} />
      <Metric label="Status" value={<StatusBadge status={status} />} />
    </CardContent>
  </Card>
);

const Metric = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-lg bg-slate-50 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <div className="mt-2 text-sm text-slate-900">{value}</div>
  </div>
);
