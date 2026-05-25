import { CalendarRange } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/useAuth";
import { dashboardApi } from "../../services/dashboardApi";
import type {
  DashboardAlertsResponse,
  DashboardChartKey,
  DashboardChartResponse,
  DashboardFilters,
  DashboardRange,
  DashboardRoleDashboard,
  DashboardSummary,
  DashboardTasksResponse
} from "../../types/dashboard";
import { DashboardAccountingSnapshot } from "./components/DashboardAccountingSnapshot";
import { DashboardAlertsPanel } from "./components/DashboardAlertsPanel";
import { DashboardChartCard } from "./components/DashboardChartCard";
import { DashboardGstSnapshot } from "./components/DashboardGstSnapshot";
import { DashboardInventorySnapshot } from "./components/DashboardInventorySnapshot";
import { DashboardPayrollSnapshot } from "./components/DashboardPayrollSnapshot";
import { DashboardPendingTasks } from "./components/DashboardPendingTasks";
import { DashboardQuickActions } from "./components/DashboardQuickActions";
import { DashboardSummaryCards } from "./components/DashboardSummaryCards";

type Loadable<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const createLoadable = <T,>(data: T | null = null): Loadable<T> => ({
  data,
  loading: false,
  error: null
});

const initialFilters: DashboardFilters = { range: "monthly" };
const RANGE_OPTIONS: Array<{ label: string; value: DashboardRange }> = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Custom", value: "custom" }
];
const chartConfig: Array<{ key: DashboardChartKey; title: string; color: string }> = [
  { key: "sales", title: "Sales Trend", color: "#0f9f8a" },
  { key: "purchases", title: "Purchase Trend", color: "#3b82f6" },
  { key: "expenses", title: "Expense Trend", color: "#f59e0b" },
  { key: "payments", title: "Payment Trend", color: "#8b5cf6" }
];

export const DashboardPage = () => {
  const auth = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(initialFilters);
  const [summary, setSummary] = useState<Loadable<DashboardSummary>>(createLoadable());
  const [roleDashboard, setRoleDashboard] = useState<Loadable<DashboardRoleDashboard>>(createLoadable());
  const [alerts, setAlerts] = useState<Loadable<DashboardAlertsResponse>>(createLoadable());
  const [tasks, setTasks] = useState<Loadable<DashboardTasksResponse>>(createLoadable());
  const [charts, setCharts] = useState<Record<DashboardChartKey, Loadable<DashboardChartResponse>>>({
    sales: createLoadable(),
    purchases: createLoadable(),
    expenses: createLoadable(),
    payments: createLoadable()
  });
  const [filtersPending, setFiltersPending] = useState(false);

  const visibleActions = useMemo(
    () => (roleDashboard.data?.quickActions ?? []).filter((action) => !action.permission || auth.hasPermission(action.permission as never)),
    [auth, roleDashboard.data?.quickActions]
  );

  const loadCore = useEffectEvent(async () => {
    setSummary((current) => ({ ...current, loading: true, error: null }));
    setRoleDashboard((current) => ({ ...current, loading: true, error: null }));
    setAlerts((current) => ({ ...current, loading: true, error: null }));
    setTasks((current) => ({ ...current, loading: true, error: null }));

    const [summaryResponse, roleResponse, alertsResponse, tasksResponse] = await Promise.allSettled([
      dashboardApi.getSummary(),
      dashboardApi.getRoleDashboard(),
      dashboardApi.getAlerts(),
      dashboardApi.getPendingTasks()
    ]);

    const message = "Dashboard widgets could not be loaded.";

    setSummary((current) =>
      summaryResponse.status === "fulfilled"
        ? { data: summaryResponse.value.data, loading: false, error: null }
        : { ...current, loading: false, error: current.data ? current.error : message }
    );

    setRoleDashboard((current) =>
      roleResponse.status === "fulfilled"
        ? { data: roleResponse.value.data, loading: false, error: null }
        : { ...current, loading: false, error: current.data ? current.error : message }
    );

    setAlerts((current) =>
      alertsResponse.status === "fulfilled"
        ? { data: alertsResponse.value.data, loading: false, error: null }
        : { ...current, loading: false, error: message }
    );

    setTasks((current) =>
      tasksResponse.status === "fulfilled"
        ? { data: tasksResponse.value.data, loading: false, error: null }
        : { ...current, loading: false, error: message }
    );
  });

  const loadChart = useEffectEvent(async (chartKey: DashboardChartKey) => {
    setCharts((current) => ({
      ...current,
      [chartKey]: { ...current[chartKey], loading: true, error: null }
    }));

    try {
      const response = await dashboardApi.getChart(chartKey, filters);
      setCharts((current) => ({
        ...current,
        [chartKey]: { data: response.data, loading: false, error: null }
      }));
    } catch {
      setCharts((current) => ({
        ...current,
        [chartKey]: { ...current[chartKey], loading: false, error: "Chart could not be loaded." }
      }));
    }
  });

  const loadCharts = useEffectEvent(async () => {
    await Promise.all(chartConfig.map((chart) => loadChart(chart.key)));
  });

  useEffect(() => {
    void loadCore();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCharts();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [filters]);

  const handleApplyFilters = async () => {
    setFiltersPending(true);
    setFilters(draftFilters);
    setFiltersPending(false);
  };

  if (summary.loading && !summary.data && roleDashboard.loading && !roleDashboard.data) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (summary.error && !summary.data && roleDashboard.error && !roleDashboard.data) {
    return (
      <ErrorState
        title="Dashboard could not be loaded."
        action={
          <Button variant="secondary" onClick={() => void loadCore()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraftFilters({ ...draftFilters, range: option.value })}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-sm font-medium transition",
                  draftFilters.range === option.value
                    ? "app-accent-surface text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {option.label}
              </button>
            ))}
            {draftFilters.range === "custom" && draftFilters.dateFrom && draftFilters.dateTo ? (
              <>
                <input
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(event) => setDraftFilters({ ...draftFilters, dateFrom: event.target.value })}
                  className="app-input-focus rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none"
                />
                <input
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(event) => setDraftFilters({ ...draftFilters, dateTo: event.target.value })}
                  className="app-input-focus rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none"
                />
              </>
            ) : null}
            <Button variant="secondary" onClick={() => void handleApplyFilters()} loading={filtersPending}>
              <CalendarRange className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <DashboardSummaryCards summary={summary.data} loading={summary.loading && !summary.data} />

      <div className="grid gap-4 xl:grid-cols-2">
        {chartConfig.map((chart) => (
          <DashboardChartCard
            key={chart.key}
            title={chart.title}
            color={chart.color}
            items={charts[chart.key].data?.items ?? []}
            loading={charts[chart.key].loading}
            error={charts[chart.key].error}
            onRefresh={() => void loadChart(chart.key)}
          />
        ))}
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <DashboardQuickActions actions={visibleActions} />
        <DashboardAlertsPanel alerts={alerts.data?.items ?? []} />
        <DashboardPendingTasks items={tasks.data?.items ?? []} />
      </div>

      {roleDashboard.data ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          <DashboardInventorySnapshot snapshot={roleDashboard.data.inventorySnapshot} />
          <DashboardGstSnapshot snapshot={roleDashboard.data.gstSnapshot} />
          <DashboardPayrollSnapshot snapshot={roleDashboard.data.payrollSnapshot} />
          <DashboardAccountingSnapshot snapshot={roleDashboard.data.accountingSnapshot} />
        </div>
      ) : null}
    </div>
  );
};

