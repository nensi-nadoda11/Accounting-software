import { client } from "../lib/api/client";
import { runtimePreferences } from "../lib/runtime-preferences";
import type { CompanyPreferences } from "../types/company";
import type { ApiResponse } from "../types/api";

export const preferencesApi = {
  get: async () => {
    const response = await client.get<ApiResponse<CompanyPreferences>>("/company/preferences");
    runtimePreferences.setDateFormat(response.data.data.dateFormat);
    return response.data;
  },
  update: async (payload: Partial<CompanyPreferences>) => {
    const response = await client.patch<ApiResponse<CompanyPreferences>>("/company/preferences", payload);
    runtimePreferences.setDateFormat(response.data.data.dateFormat);
    return response.data;
  },
};
