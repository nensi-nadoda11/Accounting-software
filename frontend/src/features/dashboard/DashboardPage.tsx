import { CalendarRange } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/useAuth";
import { dashboardApi } from "../../services/dashboardApi";
import type { Role } from "../../types/auth";
import type {
  DashboardAlertsResponse,
  DashboardChartKey,
  DashboardChartResponse,
  DashboardFilters,
  DashboardRange,
  DashboardRecentActivitiesResponse,
  DashboardRoleDashboard,
  DashboardSummary,
  DashboardTasksResponse,
  DashboardTopProductsResponse
} from "../../types/dashboard";
import { DashboardAccountingSnapshot } from "./components/DashboardAccountingSnapshot";
import { DashboardAlertsPanel } from "./components/DashboardAlertsPanel";
import { DashboardChartCard } from "./components/DashboardChartCard";
import { DashboardGstSnapshot } from "./components/DashboardGstSnapshot";
import { DashboardInventorySnapshot } from "./components/DashboardInventorySnapshot";
import { DashboardPayrollSnapshot } from "./components/DashboardPayrollSnapshot";
import { DashboardPendingTasks } from "./components/DashboardPendingTasks";
import { DashboardQuickActions } from "./components/DashboardQuickActions";
import { DashboardRecentActivities } from "./components/DashboardRecentActivities";
import { DashboardSummaryCards, type DashboardSummaryCardsVariant } from "./components/DashboardSummaryCards";
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

type DashboardWidget =
  | "summary"
  | "charts"
  | "quick-actions"
  | "alerts"
  | "recent-activities"
  | "pending-tasks"
  | "top-products"
  | "inventory"
  | "gst"
  | "payroll"
  | "accounting";

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);

const getDefaultCustomRange = (): Pick<DashboardFilters, "dateFrom" | "dateTo"> => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 29);

  return {
    dateFrom: toInputDate(start),
    dateTo: toInputDate(today)
  };
};

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

const widgetFallbackByRole: Record<Role, DashboardWidget[]> = {
  admin: ["summary", "charts", "quick-actions", "alerts", "recent-activities", "pending-tasks", "top-products", "inventory", "gst", "payroll", "accounting"],
  accountant: ["summary", "charts", "quick-actions", "alerts", "pending-tasks", "top-products", "recent-activities", "gst", "payroll", "accounting"],
  staff: ["summary", "charts", "quick-actions", "alerts", "pending-tasks", "top-products", "inventory"],
  auditor: ["summary", "charts", "alerts", "recent-activities", "gst", "payroll", "accounting"]
};

const chartKeysByRole: Record<Role, DashboardChartKey[]> = {
  admin: ["sales", "purchases", "expenses", "payments"],
  accountant: ["sales", "purchases", "expenses", "payments"],
  staff: ["sales", "purchases"],
  auditor: ["sales", "purchases", "expenses", "payments"]
};

const summaryVariantByRole: Record<Role, DashboardSummaryCardsVariant> = {
  admin: "default",
  accountant: "accountant",
  staff: "staff",
  auditor: "auditor"
};

export const DashboardPage = () => {
  const auth = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(initialFilters);
  const [summary, setSummary] = useState<Loadable<DashboardSummary>>(createLoadable());
  const [roleDashboard, setRoleDashboard] = useState<Loadable<DashboardRoleDashboard>>(createLoadable());
  const [alerts, setAlerts] = useState<Loadable<DashboardAlertsResponse>>(createLoadable());
  const [tasks, setTasks] = useState<Loadable<DashboardTasksResponse>>(createLoadable());
  const [topProducts, setTopProducts] = useState<Loadable<DashboardTopProductsResponse>>(createLoadable());
  const [recentActivities, setRecentActivities] = useState<Loadable<DashboardRecentActivitiesResponse>>(createLoadable());
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [charts, setCharts] = useState<Record<DashboardChartKey, Loadable<DashboardChartResponse>>>({
    sales: createLoadable(),
    purchases: createLoadable(),
    expenses: createLoadable(),
    payments: createLoadable()
  });
  const [filtersError, setFiltersError] = useState<string | null>(null);

  const activeRole = roleDashboard.data?.role ?? auth.user?.role ?? "staff";
  const activeWidgets = useMemo(
    () => new Set<DashboardWidget>((roleDashboard.data?.widgets as DashboardWidget[] | undefined) ?? widgetFallbackByRole[activeRole]),
    [activeRole, roleDashboard.data?.widgets]
  );
  const visibleCharts = useMemo(
    () => chartConfig.filter((chart) => chartKeysByRole[activeRole].includes(chart.key)),
    [activeRole]
  );
  const summaryVariant = summaryVariantByRole[activeRole];
  const showQuickActions = activeWidgets.has("quick-actions");
  const showAlerts = activeWidgets.has("alerts");
  const showPendingTasks = activeWidgets.has("pending-tasks");
  const showTopProducts = activeWidgets.has("top-products");
  const showRecentActivities = activeWidgets.has("recent-activities");
  const showInventorySnapshot = activeWidgets.has("inventory");
  const showGstSnapshot = activeWidgets.has("gst");
  const showPayrollSnapshot = activeWidgets.has("payroll");
  const showAccountingSnapshot = activeWidgets.has("accounting");

  const visibleActions = useMemo(
    () => (roleDashboard.data?.quickActions ?? []).filter((action) => !action.permission || auth.hasPermission(action.permission as never)),
    [auth, roleDashboard.data?.quickActions]
  );

  const loadSummary = useCallback(async (activeFilters: DashboardFilters) => {
    setSummary((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await dashboardApi.getSummary(activeFilters);
      setSummary({ data: response.data, loading: false, error: null });
    } catch {
      const message = "Dashboard summary could not be loaded.";
      setSummary((current) => ({ ...current, loading: false, error: current.data ? current.error : message }));
    }
  }, []);

  const loadStaticCore = useCallback(async () => {
    setRoleDashboard((current) => ({ ...current, loading: true, error: null }));
    setAlerts((current) => ({ ...current, loading: true, error: null }));
    setTasks((current) => ({ ...current, loading: true, error: null }));

    const [roleResponse, alertsResponse, tasksResponse] = await Promise.allSettled([
      dashboardApi.getRoleDashboard(),
      dashboardApi.getAlerts(),
      dashboardApi.getPendingTasks()
    ]);

    const message = "Dashboard widgets could not be loaded.";

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
  }, []);

  const loadTopProducts = useCallback(async (activeFilters: DashboardFilters) => {
    setTopProducts((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await dashboardApi.getTopProducts(activeFilters, 5);
      setTopProducts({ data: response.data, loading: false, error: null });
    } catch {
      const message = "Top products could not be loaded.";
      setTopProducts((current) => ({ ...current, loading: false, error: current.data ? current.error : message }));
    }
  }, []);

  const loadRecentActivities = useCallback(async (page: number) => {
    setRecentActivities((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await dashboardApi.getRecentActivities(page, 8);
      setRecentActivities({ data: response.data, loading: false, error: null });
    } catch {
      const message = "Recent activities could not be loaded.";
      setRecentActivities((current) => ({ ...current, loading: false, error: current.data ? current.error : message }));
    }
  }, []);

  const loadChart = useCallback(async (chartKey: DashboardChartKey) => {
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
  }, [filters]);

  const loadCharts = useCallback(async () => {
    await Promise.all(visibleCharts.map((chart) => loadChart(chart.key)));
  }, [loadChart, visibleCharts]);

  useEffect(() => {
    void loadStaticCore();
  }, [loadStaticCore]);

  useEffect(() => {
    void loadSummary(filters);
  }, [filters, loadSummary]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (visibleCharts.length > 0) {
        void loadCharts();
      }
    }, 150);

    return () => window.clearTimeout(timer);
  }, [filters, loadCharts, visibleCharts.length]);

  useEffect(() => {
    if (showTopProducts) {
      void loadTopProducts(filters);
    }
  }, [filters, loadTopProducts, showTopProducts]);

  useEffect(() => {
    if (showRecentActivities) {
      void loadRecentActivities(activitiesPage);
    }
  }, [activitiesPage, loadRecentActivities, showRecentActivities]);

  const isRefreshing =
    summary.loading ||
    visibleCharts.some((chart) => charts[chart.key].loading) ||
    (showTopProducts && topProducts.loading);

  const handleRangeSelect = (range: DashboardRange) => {
    setFiltersError(null);
    setDraftFilters((current) => {
      if (range !== "custom") {
        return { range };
      }

      const fallbackRange = getDefaultCustomRange();

      return {
        range,
        dateFrom: current.dateFrom ?? fallbackRange.dateFrom,
        dateTo: current.dateTo ?? fallbackRange.dateTo
      };
    });
  };

  const handleApplyFilters = () => {
    if (draftFilters.range === "custom") {
      if (!draftFilters.dateFrom || !draftFilters.dateTo) {
        setFiltersError("Custom range ke liye start aur end date select karni hogi.");
        return;
      }

      if (draftFilters.dateFrom > draftFilters.dateTo) {
        setFiltersError("Start date end date se badi nahi ho sakti.");
        return;
      }
    }

    setFiltersError(null);
    setFilters({ ...draftFilters });
  };

  if (summary.loading && !summary.data && roleDashboard.loading && !roleDashboard.data) {
    return <LoadingState label="Loading dashboard..." />;
  }

  if (summary.error && !summary.data && roleDashboard.error && !roleDashboard.data) {
    return (
      <ErrorState
        title="Dashboard could not be loaded."
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void loadStaticCore();
              void loadSummary(filters);
              void loadCharts();
              if (showTopProducts) {
                void loadTopProducts(filters);
              }
              if (showRecentActivities) {
                void loadRecentActivities(activitiesPage);
              }
            }}
          >
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
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRangeSelect(option.value)}
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
              {draftFilters.range === "custom" ? (
                <>
                  <input
                    type="date"
                    value={draftFilters.dateFrom ?? ""}
                    onChange={(event) => {
                      setFiltersError(null);
                      setDraftFilters((current) => ({ ...current, dateFrom: event.target.value }));
                    }}
                    className="app-input-focus rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none"
                  />
                  <input
                    type="date"
                    value={draftFilters.dateTo ?? ""}
                    onChange={(event) => {
                      setFiltersError(null);
                      setDraftFilters((current) => ({ ...current, dateTo: event.target.value }));
                    }}
                    className="app-input-focus rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none"
                  />
                </>
              ) : null}
              <Button variant="secondary" onClick={handleApplyFilters} loading={isRefreshing}>
                <CalendarRange className="mr-2 size-4" />
                Refresh
              </Button>
            </div>
            {filtersError ? <p className="text-sm text-rose-600">{filtersError}</p> : null}
          </div>
        }
      />

      <DashboardSummaryCards
        summary={summary.data}
        range={filters.range}
        loading={summary.loading && !summary.data}
        variant={summaryVariant}
      />

      {visibleCharts.length > 0 ? (
        <div className={cn("grid gap-4", visibleCharts.length > 1 ? "xl:grid-cols-2" : "xl:grid-cols-1")}>
          {visibleCharts.map((chart) => (
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
      ) : null}

      {activeRole === "staff" ? (
        <>
          <div className="grid items-stretch gap-4 xl:grid-cols-[1.05fr_1fr_1fr]">
            {showQuickActions && visibleActions.length > 0 ? <DashboardQuickActions actions={visibleActions} /> : null}
            {showPendingTasks ? <DashboardPendingTasks items={tasks.data?.items ?? []} /> : null}
            {showAlerts ? <DashboardAlertsPanel alerts={alerts.data?.items ?? []} /> : null}
          </div>
          {roleDashboard.data ? (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              {showTopProducts ? (
                <DashboardTopProducts
                  items={topProducts.data?.items ?? []}
                  loading={topProducts.loading && !topProducts.data}
                  error={topProducts.error}
                  onRetry={() => void loadTopProducts(filters)}
                />
              ) : null}
              {showInventorySnapshot ? <DashboardInventorySnapshot snapshot={roleDashboard.data.inventorySnapshot} /> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {activeRole === "accountant" ? (
        <>
          <div className="grid items-stretch gap-4 xl:grid-cols-[1.05fr_1fr_1fr]">
            {showQuickActions && visibleActions.length > 0 ? <DashboardQuickActions actions={visibleActions} /> : null}
            {showAlerts ? <DashboardAlertsPanel alerts={alerts.data?.items ?? []} /> : null}
            {showPendingTasks ? <DashboardPendingTasks items={tasks.data?.items ?? []} /> : null}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {showTopProducts ? (
              <DashboardTopProducts
                items={topProducts.data?.items ?? []}
                loading={topProducts.loading && !topProducts.data}
                error={topProducts.error}
                onRetry={() => void loadTopProducts(filters)}
              />
            ) : null}
            {showRecentActivities ? (
              <DashboardRecentActivities
                data={recentActivities.data}
                loading={recentActivities.loading && !recentActivities.data}
                error={recentActivities.error}
                onRetry={() => void loadRecentActivities(activitiesPage)}
                onPageChange={setActivitiesPage}
              />
            ) : null}
          </div>
          {roleDashboard.data ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {showAccountingSnapshot ? <DashboardAccountingSnapshot snapshot={roleDashboard.data.accountingSnapshot} /> : null}
              {showGstSnapshot ? <DashboardGstSnapshot snapshot={roleDashboard.data.gstSnapshot} /> : null}
              {showPayrollSnapshot ? <DashboardPayrollSnapshot snapshot={roleDashboard.data.payrollSnapshot} /> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {activeRole === "auditor" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            {showRecentActivities ? (
              <DashboardRecentActivities
                data={recentActivities.data}
                loading={recentActivities.loading && !recentActivities.data}
                error={recentActivities.error}
                onRetry={() => void loadRecentActivities(activitiesPage)}
                onPageChange={setActivitiesPage}
              />
            ) : null}
            {showAlerts ? <DashboardAlertsPanel alerts={alerts.data?.items ?? []} /> : null}
          </div>
          {roleDashboard.data ? (
            <div className="grid gap-4 xl:grid-cols-3">
              {showAccountingSnapshot ? <DashboardAccountingSnapshot snapshot={roleDashboard.data.accountingSnapshot} /> : null}
              {showGstSnapshot ? <DashboardGstSnapshot snapshot={roleDashboard.data.gstSnapshot} /> : null}
              {showPayrollSnapshot ? <DashboardPayrollSnapshot snapshot={roleDashboard.data.payrollSnapshot} /> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {activeRole === "admin" && roleDashboard.data ? (
        <>
          <div className="grid items-stretch gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
            {showQuickActions && visibleActions.length > 0 ? <DashboardQuickActions actions={visibleActions} /> : null}
            {showAlerts ? <DashboardAlertsPanel alerts={alerts.data?.items ?? []} /> : null}
            {showPendingTasks ? <DashboardPendingTasks items={tasks.data?.items ?? []} /> : null}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {showTopProducts ? (
              <DashboardTopProducts
                items={topProducts.data?.items ?? []}
                loading={topProducts.loading && !topProducts.data}
                error={topProducts.error}
                onRetry={() => void loadTopProducts(filters)}
              />
            ) : null}
            {showRecentActivities ? (
              <DashboardRecentActivities
                data={recentActivities.data}
                loading={recentActivities.loading && !recentActivities.data}
                error={recentActivities.error}
                onRetry={() => void loadRecentActivities(activitiesPage)}
                onPageChange={setActivitiesPage}
              />
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            {showInventorySnapshot ? <DashboardInventorySnapshot snapshot={roleDashboard.data.inventorySnapshot} /> : null}
            {showGstSnapshot ? <DashboardGstSnapshot snapshot={roleDashboard.data.gstSnapshot} /> : null}
            {showPayrollSnapshot ? <DashboardPayrollSnapshot snapshot={roleDashboard.data.payrollSnapshot} /> : null}
            {showAccountingSnapshot ? <DashboardAccountingSnapshot snapshot={roleDashboard.data.accountingSnapshot} /> : null}
          </div>
        </>
      ) : null}
    </div>
  );
};

