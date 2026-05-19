import { RefreshCw } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorState } from "../../../components/ui/ErrorState";
import type { DashboardChartPoint } from "../../../types/dashboard";

type Props = {
  title: string;
  items: DashboardChartPoint[];
  loading?: boolean;
  error?: string | null;
  color: string;
  onRefresh: () => void;
};

export const DashboardChartCard = ({ title, items, loading = false, error, color, onRefresh }: Props) => (
  <Card>
    <CardHeader
      title={title}
      action={
        <Button variant="ghost" onClick={onRefresh}>
          <RefreshCw className="size-4" />
        </Button>
      }
    />
    <CardContent className="h-[260px] p-4">
      {loading ? (
        <div className="h-full animate-pulse rounded-2xl bg-slate-50" />
      ) : error ? (
        <ErrorState
          className="min-h-full"
          title={error}
          action={
            <Button variant="secondary" onClick={onRefresh}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState title="No chart data available for the selected range" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={items}>
            <defs>
              <linearGradient id={`dashboard-${title}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.32} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
            <Tooltip
              contentStyle={{ borderRadius: 16, borderColor: "#e2e8f0" }}
              formatter={(value) => [`${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, title]}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#64748b" }}
              width={72}
              tickFormatter={(value) => Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            />
            <Area isAnimationActive={false} type="monotone" dataKey="value" stroke={color} fill={`url(#dashboard-${title})`} strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </CardContent>
  </Card>
);
