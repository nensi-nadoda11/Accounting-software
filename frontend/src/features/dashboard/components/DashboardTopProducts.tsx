import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/ui/ErrorState";
import type { DashboardTopProduct } from "../../../types/dashboard";

type Props = {
  items: DashboardTopProduct[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export const DashboardTopProducts = ({ items, loading = false, error, onRetry }: Props) => (
  <Card>
    <CardHeader title="Top Products" />
    <CardContent className="space-y-3 p-4">
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 rounded-2xl bg-slate-50" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title={error}
          action={
            onRetry ? (
              <Button variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            ) : null
          }
        />
      ) : items.length === 0 ? (
        <EmptyState title="No product movement in this range" />
      ) : (
        items.map((item, index) => (
          <div key={item.productId} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{item.productName}</p>
              <p className="mt-1 text-xs text-slate-500">{item.sku}</p>
            </div>
            <div className="text-right">
              <AmountText value={item.salesAmount} className="text-sm" tone="default" />
              <p className="mt-1 text-xs text-slate-500">{Number(item.quantity).toFixed(2)} qty</p>
            </div>
          </div>
        ))
      )}
    </CardContent>
  </Card>
);
