import { AlertTriangle, Bell, CalendarClock, CircleDollarSign, PackageSearch } from "lucide-react";
import { Link } from "react-router-dom";

import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { DashboardAlert } from "../../../types/dashboard";

type Props = {
  alerts: DashboardAlert[];
};

const iconByKind = {
  low_stock: PackageSearch,
  expiry: CalendarClock,
  customer_due: CircleDollarSign,
  supplier_due: CircleDollarSign,
  payroll: AlertTriangle,
  gst: AlertTriangle,
  notification: Bell
} as const;

export const DashboardAlertsPanel = ({ alerts }: Props) => (
  <Card className="flex h-full min-h-0 flex-col">
    <CardHeader title="Alerts" />
    <CardContent className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
      {alerts.length === 0 ? (
        <EmptyState title="No active alerts" />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
          const Icon = iconByKind[alert.kind];

          return (
            <Link
              key={alert.id}
              to={alert.actionUrl ?? "/app/system/notifications"}
              className="flex items-start gap-3 overflow-hidden rounded-2xl border border-slate-200 p-3 transition hover:border-slate-300"
            >
              <div
                className={`mt-0.5 flex size-9 items-center justify-center rounded-xl ${
                  alert.severity === "critical"
                    ? "bg-rose-50 text-rose-700"
                    : alert.severity === "warning"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-sky-50 text-sky-700"
                }`}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="break-words text-sm font-semibold text-slate-900">{alert.title}</p>
                  {alert.amount ? <AmountText value={alert.amount} className="text-xs" tone="default" /> : null}
                </div>
                <p className="mt-1 break-words text-xs leading-5 text-slate-500">{alert.description}</p>
                {alert.dueDate ? <p className="mt-1 text-[11px] font-medium text-slate-400">Due {alert.dueDate}</p> : null}
              </div>
            </Link>
          );
          })}
        </div>
      )}
    </CardContent>
  </Card>
);
