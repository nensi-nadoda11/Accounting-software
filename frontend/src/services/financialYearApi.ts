import { client } from "../lib/api/client";
import type { CompanyFinancialYear } from "../types/company";
import type { ApiResponse } from "../types/api";

export const financialYearApi = {
  list: async () =>
    (await client.get<ApiResponse<{ items: CompanyFinancialYear[] }>>("/company/financial-years")).data,
  create: async (payload: { name: string; startDate: string; endDate: string; isActive?: boolean }) =>
    (await client.post<ApiResponse<CompanyFinancialYear>>("/company/financial-years", payload)).data,
  update: async (id: string, payload: { name: string; startDate: string; endDate: string }) =>
    (await client.patch<ApiResponse<CompanyFinancialYear>>(`/company/financial-years/${id}`, payload)).data,
  activate: async (id: string) =>
    (await client.post<ApiResponse<CompanyFinancialYear>>(`/company/financial-years/${id}/activate`)).data,
  lock: async (id: string) =>
    (await client.post<ApiResponse<CompanyFinancialYear>>(`/company/financial-years/${id}/lock`)).data,
};
