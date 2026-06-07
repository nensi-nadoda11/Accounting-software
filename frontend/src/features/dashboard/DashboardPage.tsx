import { CalendarRange } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
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
  DashboardTasksResponse
} from "../../types/dashboard";
import { DashboardAccountingSnapshot } from "./components/DashboardAccountingSnapshot";
import { DashboardAlertsPanel } from "./components/DashboardAlertsPanel";
import { DashboardChartCard } from "./components/DashboardChartCard";
import { DashboardGstSnapshot } from "./components/DashboardGstSnapshot";
import { DashboardInventorySnapshot } from "./components/DashboardInventorySnapshot";
import { DashboardLatestCashVerification } from "./components/DashboardLatestCashVerification";
import { DashboardPayrollSnapshot } from "./components/DashboardPayrollSnapshot";
import { DashboardPendingTasks } from "./components/DashboardPendingTasks";
import { DashboardQuickActions } from "./components/DashboardQuickActions";
import { DashboardRecentActivities } from "./components/DashboardRecentActivities";
import { DashboardSummaryCards, type DashboardSummaryCardsVariant } from "./components/DashboardSummaryCards";

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
  | "inventory"
  | "gst"
  | "payroll"
  | "accounting"
  | "cash-verification";

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
  admin: ["summary", "charts", "quick-actions", "alerts", "pending-tasks", "inventory", "gst", "payroll", "accounting", "cash-verification"],
  accountant: ["summary", "charts", "quick-actions", "alerts", "pending-tasks", "gst", "payroll", "accounting", "cash-verification"],
  staff: ["summary", "charts", "quick-actions", "alerts", "pending-tasks", "inventory", "cash-verification"],
  auditor: ["summary", "charts", "alerts", "recent-activities", "gst", "payroll", "accounting", "cash-verification"]
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

const DASHBOARD_RETRY_ATTEMPTS = 3;
const DASHBOARD_RETRY_DELAY_MS = 700;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const retryDashboardRequest = async <T,>(request: () => Promise<T>) => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DASHBOARD_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      lastError = error;

      if (attempt < DASHBOARD_RETRY_ATTEMPTS) {
        await sleep(DASHBOARD_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
};

export const DashboardPage = () => {
  const auth = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(initialFilters);
  const [summary, setSummary] = useState<Loadable<DashboardSummary>>(createLoadable());
  const [roleDashboard, setRoleDashboard] = useState<Loadable<DashboardRoleDashboard>>(createLoadable());
  const [alerts, setAlerts] = useState<Loadable<DashboardAlertsResponse>>(createLoadable());
  const [tasks, setTasks] = useState<Loadable<DashboardTasksResponse>>(createLoadable());
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
  const showRecentActivities = activeRole !== "admin" && activeWidgets.has("recent-activities");
  const showInventorySnapshot = activeWidgets.has("inventory");
  const showGstSnapshot = activeWidgets.has("gst");
  const showPayrollSnapshot = activeWidgets.has("payroll");
  const showAccountingSnapshot = activeWidgets.has("accounting");
  const showCashVerification = activeWidgets.has("cash-verification");

  const visibleActions = useMemo(
    () => (roleDashboard.data?.quickActions ?? []).filter((action) => !action.permission || auth.hasPermission(action.permission as never)),
    [auth, roleDashboard.data?.quickActions]
  );

  const loadSummary = useCallback(async (activeFilters: DashboardFilters) => {
    setSummary((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await retryDashboardRequest(() => dashboardApi.getSummary(activeFilters));
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

    const message = "Dashboard widgets could not be loaded.";
    let roleLoaded = false;

    try {
      const roleResponse = await retryDashboardRequest(() => dashboardApi.getRoleDashboard());
      setRoleDashboard({ data: roleResponse.data, loading: false, error: null });
      roleLoaded = true;
    } catch {
      setRoleDashboard((current) => ({ ...current, loading: false, error: current.data ? current.error : message }));
    }

    const [alertsResponse, tasksResponse] = await Promise.allSettled([
      retryDashboardRequest(() => dashboardApi.getAlerts()),
      retryDashboardRequest(() => dashboardApi.getPendingTasks())
    ]);

    if (!roleLoaded) {
      setRoleDashboard((current) => ({ ...current, loading: false }));
    }

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

  const loadRecentActivities = useCallback(async (page: number) => {
    setRecentActivities((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await retryDashboardRequest(() => dashboardApi.getRecentActivities(page, 8));
      setRecentActivities({ data: response.data, loading: false, error: null });
    } catch {
      const message = "Recent activities could not be loaded.";
      setRecentActivities((current) => ({ ...current, loading: false, error: current.data ? current.error : message }));
    }
  }, []);

  const loadChart = useCallback(async (chartKey: DashboardChartKey, activeFilters: DashboardFilters = filters) => {
    setCharts((current) => ({
      ...current,
      [chartKey]: { ...current[chartKey], loading: true, error: null }
    }));

    try {
      const response = await retryDashboardRequest(() => dashboardApi.getChart(chartKey, activeFilters));
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

  const loadCharts = useCallback(async (activeFilters: DashboardFilters = filters) => {
    for (const chart of visibleCharts) {
      await loadChart(chart.key, activeFilters);
    }
  }, [filters, loadChart, visibleCharts]);

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
    if (showRecentActivities) {
      void loadRecentActivities(activitiesPage);
    }
  }, [activitiesPage, loadRecentActivities, showRecentActivities]);

  useEffect(() => {
    const hasCoreRecoveryPending =
      (!summary.data && !!summary.error) ||
      (!roleDashboard.data && !!roleDashboard.error) ||
      (!alerts.data && !!alerts.error) ||
      (!tasks.data && !!tasks.error);
    const hasChartRecoveryPending = visibleCharts.some((chart) => !charts[chart.key].data && !!charts[chart.key].error);
    const hasActivitiesRecoveryPending = showRecentActivities && !recentActivities.data && !!recentActivities.error;

    if (!hasCoreRecoveryPending && !hasChartRecoveryPending && !hasActivitiesRecoveryPending) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!summary.data && summary.error) {
        void loadSummary(filters);
      }

      if ((!roleDashboard.data && roleDashboard.error) || (!alerts.data && alerts.error) || (!tasks.data && tasks.error)) {
        void loadStaticCore();
      }

      if (hasChartRecoveryPending) {
        void loadCharts(filters);
      }

      if (showRecentActivities && !recentActivities.data && recentActivities.error) {
        void loadRecentActivities(activitiesPage);
      }
    }, 2200);

    return () => window.clearTimeout(timer);
  }, [
    activitiesPage,
    alerts.data,
    alerts.error,
    charts,
    filters,
    loadCharts,
    loadRecentActivities,
    loadStaticCore,
    loadSummary,
    recentActivities.data,
    recentActivities.error,
    roleDashboard.data,
    roleDashboard.error,
    showRecentActivities,
    summary.data,
    summary.error,
    tasks.data,
    tasks.error,
    visibleCharts
  ]);

  const isRefreshing =
    summary.loading ||
    visibleCharts.some((chart) => charts[chart.key].loading);

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
        loading={summary.loading || !summary.data}
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
              loading={charts[chart.key].loading || !charts[chart.key].data}
              error={charts[chart.key].data ? charts[chart.key].error : null}
              onRefresh={() => void loadChart(chart.key)}
            />
          ))}
        </div>
      ) : null}

      {activeRole === "staff" ? (
        <>
          <div className="grid items-stretch gap-4 xl:grid-cols-[1.05fr_1fr_1fr]">
            {showQuickActions && visibleActions.length > 0 ? (
              <DashboardQuickActions actions={visibleActions} className="h-[20rem]" compact />
            ) : null}
            {showPendingTasks ? (
              tasks.data ? (
                <DashboardPendingTasks items={tasks.data.items} className="h-[20rem]" />
              ) : (
                <LoadingState label="Loading pending tasks..." className="h-[20rem]" />
              )
            ) : null}
            {showAlerts ? (
              alerts.data ? (
                <DashboardAlertsPanel alerts={alerts.data.items} className="h-[20rem]" />
              ) : (
                <LoadingState label="Loading alerts..." className="h-[20rem]" />
              )
            ) : null}
          </div>
          {showInventorySnapshot ? (
            <div className="grid gap-4">
              {roleDashboard.data ? (
                <DashboardInventorySnapshot snapshot={roleDashboard.data.inventorySnapshot} />
              ) : (
                <LoadingState label="Loading inventory snapshot..." />
              )}
            </div>
          ) : null}
          {showCashVerification ? (
            roleDashboard.data ? (
              <DashboardLatestCashVerification verification={roleDashboard.data.latestCashVerification} />
            ) : (
              <LoadingState label="Loading cash verification..." />
            )
          ) : null}
        </>
      ) : null}

      {activeRole === "accountant" ? (
        <>
          <div className="grid items-stretch gap-4 xl:grid-cols-[1.05fr_1fr_1fr]">
            {showQuickActions && visibleActions.length > 0 ? <DashboardQuickActions actions={visibleActions} /> : null}
            {showAlerts ? (
              alerts.data ? (
                <DashboardAlertsPanel alerts={alerts.data.items} className="h-[24rem]" />
              ) : (
                <LoadingState label="Loading alerts..." className="h-[24rem]" />
              )
            ) : null}
            {showPendingTasks ? (
              tasks.data ? (
                <DashboardPendingTasks items={tasks.data.items} className="h-[24rem]" />
              ) : (
                <LoadingState label="Loading pending tasks..." className="h-[24rem]" />
              )
            ) : null}
          </div>
          <div className="grid gap-4 xl:grid-cols-4">
            {showAccountingSnapshot ? (
              roleDashboard.data ? (
                <DashboardAccountingSnapshot snapshot={roleDashboard.data.accountingSnapshot} />
              ) : (
                <LoadingState label="Loading accounting snapshot..." />
              )
            ) : null}
            {showGstSnapshot ? (
              roleDashboard.data ? (
                <DashboardGstSnapshot snapshot={roleDashboard.data.gstSnapshot} />
              ) : (
                <LoadingState label="Loading GST snapshot..." />
              )
            ) : null}
            {showPayrollSnapshot ? (
              roleDashboard.data ? (
                <DashboardPayrollSnapshot snapshot={roleDashboard.data.payrollSnapshot} />
              ) : (
                <LoadingState label="Loading payroll snapshot..." />
              )
            ) : null}
            {showCashVerification ? (
              roleDashboard.data ? (
                <DashboardLatestCashVerification verification={roleDashboard.data.latestCashVerification} />
              ) : (
                <LoadingState label="Loading cash verification..." />
              )
            ) : null}
          </div>
        </>
      ) : null}

      {activeRole === "auditor" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            {showRecentActivities ? (
              <DashboardRecentActivities
                data={recentActivities.data}
                loading={recentActivities.loading || !recentActivities.data}
                error={recentActivities.data ? recentActivities.error : null}
                onRetry={() => void loadRecentActivities(activitiesPage)}
                onPageChange={setActivitiesPage}
              />
            ) : null}
            {showAlerts ? (
              alerts.data ? (
                <DashboardAlertsPanel alerts={alerts.data.items} />
              ) : (
                <LoadingState label="Loading alerts..." />
              )
            ) : null}
          </div>
          <div className="grid gap-4 xl:grid-cols-4">
            {showAccountingSnapshot ? (
              roleDashboard.data ? (
                <DashboardAccountingSnapshot snapshot={roleDashboard.data.accountingSnapshot} />
              ) : (
                <LoadingState label="Loading accounting snapshot..." />
              )
            ) : null}
            {showGstSnapshot ? (
              roleDashboard.data ? (
                <DashboardGstSnapshot snapshot={roleDashboard.data.gstSnapshot} />
              ) : (
                <LoadingState label="Loading GST snapshot..." />
              )
            ) : null}
            {showPayrollSnapshot ? (
              roleDashboard.data ? (
                <DashboardPayrollSnapshot snapshot={roleDashboard.data.payrollSnapshot} />
              ) : (
                <LoadingState label="Loading payroll snapshot..." />
              )
            ) : null}
            {showCashVerification ? (
              roleDashboard.data ? (
                <DashboardLatestCashVerification verification={roleDashboard.data.latestCashVerification} />
              ) : (
                <LoadingState label="Loading cash verification..." />
              )
            ) : null}
          </div>
        </>
      ) : null}

      {activeRole === "admin" ? (
        <>
          <div className="grid items-stretch gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
            {showQuickActions && visibleActions.length > 0 ? <DashboardQuickActions actions={visibleActions} className="h-[40rem]" /> : null}
            {showAlerts ? (
              alerts.data ? (
                <DashboardAlertsPanel alerts={alerts.data.items} className="h-[40rem]" />
              ) : (
                <LoadingState label="Loading alerts..." className="h-[40rem]" />
              )
            ) : null}
            {showPendingTasks ? (
              tasks.data ? (
                <DashboardPendingTasks items={tasks.data.items} className="h-[40rem]" />
              ) : (
                <LoadingState label="Loading pending tasks..." className="h-[40rem]" />
              )
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
            {showInventorySnapshot ? (
              roleDashboard.data ? (
                <DashboardInventorySnapshot snapshot={roleDashboard.data.inventorySnapshot} />
              ) : (
                <LoadingState label="Loading inventory snapshot..." />
              )
            ) : null}
            {showGstSnapshot ? (
              roleDashboard.data ? (
                <DashboardGstSnapshot snapshot={roleDashboard.data.gstSnapshot} />
              ) : (
                <LoadingState label="Loading GST snapshot..." />
              )
            ) : null}
            {showPayrollSnapshot ? (
              roleDashboard.data ? (
                <DashboardPayrollSnapshot snapshot={roleDashboard.data.payrollSnapshot} />
              ) : (
                <LoadingState label="Loading payroll snapshot..." />
              )
            ) : null}
            {showAccountingSnapshot ? (
              roleDashboard.data ? (
                <DashboardAccountingSnapshot snapshot={roleDashboard.data.accountingSnapshot} />
              ) : (
                <LoadingState label="Loading accounting snapshot..." />
              )
            ) : null}
            {showCashVerification ? (
              roleDashboard.data ? (
                <DashboardLatestCashVerification verification={roleDashboard.data.latestCashVerification} />
              ) : (
                <LoadingState label="Loading cash verification..." />
              )
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
};

