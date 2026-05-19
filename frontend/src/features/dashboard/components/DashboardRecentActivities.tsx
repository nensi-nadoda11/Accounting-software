import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import type { DashboardRecentActivitiesResponse } from "../../../types/dashboard";

type Props = {
  data: DashboardRecentActivitiesResponse | null;
  loading?: boolean;
  error?: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
};

export const DashboardRecentActivities = ({ data, loading = false, error, onRetry, onPageChange }: Props) => (
  <Card>
    <CardHeader title="Recent Activities" />
    <CardContent className="space-y-4 p-4">
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-14 rounded-2xl bg-slate-50" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title={error}
          action={
            <Button variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No activities recorded yet" />
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3">
                <div className={`mt-0.5 size-2.5 rounded-full ${item.status === "failed" ? "bg-rose-500" : "bg-emerald-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                    <span className="text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.userName} in {item.module}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => onPageChange(data.pagination.page - 1)}
                disabled={data.pagination.page <= 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="secondary"
                onClick={() => onPageChange(data.pagination.page + 1)}
                disabled={data.pagination.page >= data.pagination.totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </CardContent>
  </Card>
);
