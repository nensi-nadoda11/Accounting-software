import { Link } from "react-router-dom";

import { AmountText } from "../../../components/ui/AmountText";
import { Badge } from "../../../components/ui/Badge";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import type { DashboardLatestCashVerification as LatestCashVerification } from "../../../types/dashboard";

const STATUS_LABELS: Record<NonNullable<LatestCashVerification>["status"], string> = {
  matched: "Matched",
  short_cash: "Short Cash",
  excess_cash: "Excess Cash",
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const DashboardLatestCashVerification = ({ verification }: { verification: LatestCashVerification }) => (
  <Card>
    <CardHeader title="Latest Cash Verification" />
    <CardContent className="space-y-4 p-4">
      {verification ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link
                to={`/app/accounting/cash-verification?id=${verification.id}`}
                className="text-sm font-semibold text-slate-900 hover:text-emerald-700"
              >
                {verification.verificationNo}
              </Link>
              <p className="mt-1 text-xs text-slate-500">{formatDate(verification.verificationDate)}</p>
            </div>
            <Badge
              tone={
                verification.status === "matched"
                  ? "success"
                  : verification.status === "short_cash"
                    ? "danger"
                    : "warning"
              }
            >
              {STATUS_LABELS[verification.status]}
            </Badge>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Difference</p>
            <AmountText
              value={verification.differenceAmount}
              tone={Number(verification.differenceAmount) === 0 ? "success" : Number(verification.differenceAmount) < 0 ? "danger" : "warning"}
              className="mt-2 block text-sm"
            />
          </div>
        </>
      ) : (
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No cash verification recorded</div>
      )}
    </CardContent>
  </Card>
);
