import { client } from "../lib/api/client";
import type { CompanyBankAccount, CompanyPaginatedResponse } from "../types/company";
import type { ApiResponse } from "../types/api";

export const bankApi = {
  list: async (params: { page?: number; limit?: number; search?: string; isActive?: boolean }) =>
    (await client.get<ApiResponse<CompanyPaginatedResponse<CompanyBankAccount>>>("/company/bank-accounts", { params })).data,
  create: async (payload: {
    bankName: string;
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    branchName?: string | null;
    upiId?: string | null;
    qrImageUrl?: string | null;
    openingBalance: number;
    accountType: CompanyBankAccount["accountType"];
    isDefault?: boolean;
    isActive?: boolean;
  }) => (await client.post<ApiResponse<CompanyBankAccount>>("/company/bank-accounts", payload)).data,
  update: async (
    id: string,
    payload: Partial<{
      bankName: string;
      accountHolderName: string;
      accountNumber: string;
      ifscCode: string;
      branchName: string | null;
      upiId: string | null;
      qrImageUrl: string | null;
      openingBalance: number;
      accountType: CompanyBankAccount["accountType"];
      isDefault: boolean;
      isActive: boolean;
    }>,
  ) => (await client.patch<ApiResponse<CompanyBankAccount>>(`/company/bank-accounts/${id}`, payload)).data,
  remove: async (id: string) => (await client.delete<ApiResponse<Record<string, never>>>(`/company/bank-accounts/${id}`)).data,
  setDefault: async (id: string) =>
    (await client.post<ApiResponse<CompanyBankAccount>>(`/company/bank-accounts/${id}/default`)).data,
};
