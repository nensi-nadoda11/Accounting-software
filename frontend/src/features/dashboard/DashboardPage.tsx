import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../providers/AuthProvider";
import { dashboardApi } from "../../services/dashboardApi";
import type {
  DashboardAlertsResponse,
  DashboardChartKey,
  DashboardChartResponse,
  DashboardFilters,
  DashboardRecentActivitiesResponse,
  DashboardRoleDashboard,
  DashboardSummary,
  DashboardTasksResponse,
  DashboardTopProductsResponse
} from "../../types/dashboard";
import { DashboardAccountingSnapshot } from "./components/DashboardAccountingSnapshot";
import { DashboardAlertsPanel } from "./components/DashboardAlertsPanel";
import { DashboardChartCard } from "./components/DashboardChartCard";
import { DashboardFilters as DashboardFiltersPanel } from "./components/DashboardFilters";
import { DashboardGstSnapshot } from "./components/DashboardGstSnapshot";
import { DashboardInventorySnapshot } from "./components/DashboardInventorySnapshot";
import { DashboardPayrollSnapshot } from "./components/DashboardPayrollSnapshot";
import { DashboardPendingTasks } from "./components/DashboardPendingTasks";
import { DashboardQuickActions } from "./components/DashboardQuickActions";
import { DashboardRecentActivities } from "./components/DashboardRecentActivities";
import { DashboardSummaryCards } from "./components/DashboardSummaryCards";
import { DashboardTopProducts } from "./components/DashboardTopProducts";

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
  const [topProducts, setTopProducts] = useState<Loadable<DashboardTopProductsResponse>>(createLoadable());
  const [activities, setActivities] = useState<Loadable<DashboardRecentActivitiesResponse>>(createLoadable());
  const [charts, setCharts] = useState<Record<DashboardChartKey, Loadable<DashboardChartResponse>>>({
    sales: createLoadable(),
    purchases: createLoadable(),
    expenses: createLoadable(),
    payments: createLoadable()
  });
  const [activityPage, setActivityPage] = useState(1);
  const [filtersPending, setFiltersPending] = useState(false);

  const visibleActions = useMemo(
    () => (roleDashboard.data?.quickActions ?? []).filter((action) => !action.permission || auth.hasPermission(action.permission as never)),
    [auth, roleDashboard.data?.quickActions]
  );

  const loadCore = async () => {
    setSummary((current) => ({ ...current, loading: true, error: null }));
    setRoleDashboard((current) => ({ ...current, loading: true, error: null }));
    setAlerts((current) => ({ ...current, loading: true, error: null }));
    setTasks((current) => ({ ...current, loading: true, error: null }));
    setTopProducts((current) => ({ ...current, loading: true, error: null }));

    try {
      const [summaryResponse, roleResponse, alertsResponse, tasksResponse, topProductsResponse] = await Promise.all([
        dashboardApi.getSummary(),
        dashboardApi.getRoleDashboard(),
        dashboardApi.getAlerts(),
        dashboardApi.getPendingTasks(),
        dashboardApi.getTopProducts(filters)
      ]);

      setSummary({ data: summaryResponse.data, loading: false, error: null });
      setRoleDashboard({ data: roleResponse.data, loading: false, error: null });
      setAlerts({ data: alertsResponse.data, loading: false, error: null });
      setTasks({ data: tasksResponse.data, loading: false, error: null });
      setTopProducts({ data: topProductsResponse.data, loading: false, error: null });
    } catch {
      const message = "Dashboard widgets could not be loaded.";
      setSummary((current) => ({ ...current, loading: false, error: current.data ? current.error : message }));
      setRoleDashboard((current) => ({ ...current, loading: false, error: message }));
      setAlerts((current) => ({ ...current, loading: false, error: message }));
      setTasks((current) => ({ ...current, loading: false, error: message }));
      setTopProducts((current) => ({ ...current, loading: false, error: message }));
    }
  };

  const loadActivities = async (page: number) => {
    setActivities((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await dashboardApi.getRecentActivities(page, 5);
      setActivities({ data: response.data, loading: false, error: null });
    } catch {
      setActivities((current) => ({ ...current, loading: false, error: "Recent activity could not be loaded." }));
    }
  };

  const loadChart = async (chartKey: DashboardChartKey) => {
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
  };

  const loadCharts = async () => {
    await Promise.all(chartConfig.map((chart) => loadChart(chart.key)));
  };

  useEffect(() => {
    void loadCore();
  }, [filters]);

  useEffect(() => {
    void loadActivities(activityPage);
  }, [activityPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCharts();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [filters]);

  const handleApplyFilters = async () => {
    setFiltersPending(true);
    setActivityPage(1);
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
    <div className="space-y-5">
      <PageHeader title="Dashboard" />
      <DashboardFiltersPanel value={draftFilters} onChange={setDraftFilters} onApply={() => void handleApplyFilters()} pending={filtersPending} />

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

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <DashboardQuickActions actions={visibleActions} />
        <DashboardAlertsPanel alerts={alerts.data?.items ?? []} />
        <DashboardPendingTasks items={tasks.data?.items ?? []} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <DashboardRecentActivities
          data={activities.data}
          loading={activities.loading}
          error={activities.error}
          onRetry={() => void loadActivities(activityPage)}
          onPageChange={setActivityPage}
        />
        <DashboardTopProducts items={topProducts.data?.items ?? []} />
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
