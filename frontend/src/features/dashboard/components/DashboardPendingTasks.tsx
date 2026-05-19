import { Link } from "react-router-dom";

import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import type { DashboardTask } from "../../../types/dashboard";

export const DashboardPendingTasks = ({ items }: { items: DashboardTask[] }) => (
  <Card>
    <CardHeader title="Pending Tasks" />
    <CardContent className="space-y-3 p-4">
      {items.length === 0 ? (
        <EmptyState title="No pending tasks" />
      ) : (
        items.map((item) => (
          <Link key={item.id} to={item.href} className="block rounded-2xl border border-slate-200 p-3 transition hover:border-slate-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{item.count} items</p>
              </div>
              <AmountText value={item.amount} className="text-sm" tone="default" />
            </div>
          </Link>
        ))
      )}
    </CardContent>
  </Card>
);
