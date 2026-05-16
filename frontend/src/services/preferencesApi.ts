import { client } from "../lib/api/client";
import type { CompanyPreferences } from "../types/company";
import type { ApiResponse } from "../types/api";

export const preferencesApi = {
  get: async () => (await client.get<ApiResponse<CompanyPreferences>>("/company/preferences")).data,
  update: async (payload: Partial<CompanyPreferences>) =>
    (await client.patch<ApiResponse<CompanyPreferences>>("/company/preferences", payload)).data,
};
