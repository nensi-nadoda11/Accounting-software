import { client } from "../lib/api/client";
import type {
  CompanyInvoiceSettings,
  CompanyProfile,
  CompanySetupStatus,
  CompanyTaxSettings,
  InvoicePreview,
} from "../types/company";
import type { ApiResponse } from "../types/api";

export const companyApi = {
  getProfile: async () => (await client.get<ApiResponse<CompanyProfile>>("/company/profile")).data,
  updateProfile: async (payload: Partial<CompanyProfile>) =>
    (await client.patch<ApiResponse<CompanyProfile>>("/company/profile", payload)).data,
  getTaxSettings: async () => (await client.get<ApiResponse<CompanyTaxSettings>>("/company/tax-settings")).data,
  updateTaxSettings: async (payload: Partial<CompanyTaxSettings>) =>
    (await client.patch<ApiResponse<CompanyTaxSettings>>("/company/tax-settings", payload)).data,
  getInvoiceSettings: async () =>
    (await client.get<ApiResponse<CompanyInvoiceSettings>>("/company/invoice-settings")).data,
  updateInvoiceSettings: async (payload: Partial<CompanyInvoiceSettings>) =>
    (await client.patch<ApiResponse<CompanyInvoiceSettings>>("/company/invoice-settings", payload)).data,
  previewInvoiceNumber: async () =>
    (await client.get<ApiResponse<InvoicePreview>>("/company/invoice-settings/preview-number")).data,
  getSetupStatus: async () => (await client.get<ApiResponse<CompanySetupStatus>>("/company/setup-status")).data,
  completeSetup: async () => (await client.post<ApiResponse<{ company: CompanyProfile }>>("/company/complete-setup")).data,
};
