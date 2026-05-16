import { client } from "../lib/api/client";
import type { CompanyBranch, CompanyPaginatedResponse } from "../types/company";
import type { ApiResponse } from "../types/api";

export const branchApi = {
  list: async (params: { page?: number; limit?: number; search?: string; isActive?: boolean }) =>
    (await client.get<ApiResponse<CompanyPaginatedResponse<CompanyBranch>>>("/company/branches", { params })).data,
  create: async (payload: {
    branchName: string;
    branchCode: string;
    gstNumber?: string | null;
    email?: string | null;
    mobileNumber?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    managerName?: string | null;
    isActive?: boolean;
  }) => (await client.post<ApiResponse<CompanyBranch>>("/company/branches", payload)).data,
  update: async (
    id: string,
    payload: Partial<{
      branchName: string;
      branchCode: string;
      gstNumber: string | null;
      email: string | null;
      mobileNumber: string | null;
      addressLine1: string | null;
      addressLine2: string | null;
      city: string | null;
      state: string | null;
      pincode: string | null;
      managerName: string | null;
      isActive: boolean;
    }>,
  ) => (await client.patch<ApiResponse<CompanyBranch>>(`/company/branches/${id}`, payload)).data,
  remove: async (id: string) => (await client.delete<ApiResponse<Record<string, never>>>(`/company/branches/${id}`)).data,
};
