import { Link } from "react-router-dom";

import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { cn } from "../../../lib/utils";
import type { DashboardTask } from "../../../types/dashboard";

export const DashboardPendingTasks = ({ items, className }: { items: DashboardTask[]; className?: string }) => (
  <Card className={cn("flex h-full min-h-0 flex-col", className)}>
    <CardHeader title="Pending Tasks" />
    <CardContent className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
      {items.length === 0 ? (
        <EmptyState title="No pending tasks" />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} to={item.href} className="block overflow-hidden rounded-2xl border border-slate-200 p-3 transition hover:border-slate-300">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.count} items</p>
                </div>
                <AmountText value={item.amount} className="shrink-0 text-sm" tone="default" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
);
