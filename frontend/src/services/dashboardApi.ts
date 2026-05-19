import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
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
} from "../types/dashboard";

const toParams = (filters?: DashboardFilters) => ({
  range: filters?.range ?? "monthly",
  dateFrom: filters?.dateFrom || undefined,
  dateTo: filters?.dateTo || undefined
});

export const dashboardApi = {
  getSummary: async () => (await client.get<ApiResponse<DashboardSummary>>("/dashboard/summary")).data,

  getChart: async (chart: DashboardChartKey, filters: DashboardFilters) =>
    (await client.get<ApiResponse<DashboardChartResponse>>(`/dashboard/charts/${chart}`, { params: toParams(filters) })).data,

  getTopProducts: async (filters: DashboardFilters, limit = 5) =>
    (
      await client.get<ApiResponse<DashboardTopProductsResponse>>("/dashboard/top-products", {
        params: { ...toParams(filters), limit }
      })
    ).data,

  getRecentActivities: async (page = 1, limit = 8) =>
    (
      await client.get<ApiResponse<DashboardRecentActivitiesResponse>>("/dashboard/recent-activities", {
        params: { page, limit }
      })
    ).data,

  getAlerts: async () => (await client.get<ApiResponse<DashboardAlertsResponse>>("/dashboard/alerts")).data,

  getPendingTasks: async () => (await client.get<ApiResponse<DashboardTasksResponse>>("/dashboard/pending-tasks")).data,

  getRoleDashboard: async () => (await client.get<ApiResponse<DashboardRoleDashboard>>("/dashboard/role-dashboard")).data
};
