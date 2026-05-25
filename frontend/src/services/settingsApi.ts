import { client } from "../lib/api/client";
import type { ApiResponse } from "../types/api";
import type {
  InvoiceTemplate,
  PaymentMode,
  PermissionMatrix,
  ProfileSettings,
  TaxSettings,
  UiPreference
} from "../types/settings";
import type { PermissionKey, Role } from "../types/auth";

export const applyUiPreferencesToDocument = (preferences: UiPreference | null) => {
  const root = document.documentElement;
  const accent = preferences?.accentColor?.trim() || "#0f9f8a";

  root.style.setProperty("--app-accent", accent);
  root.dataset.compactMode = preferences?.compactMode === false ? "false" : "true";
  root.dataset.tableDensity = preferences?.tableDensity ?? "compact";
};

export const settingsApi = {
  getPermissions: async () => (await client.get<ApiResponse<PermissionMatrix>>("/settings/permissions")).data,
  updateUserPermissions: async (userId: string, permissions: PermissionKey[]) =>
    (await client.patch<ApiResponse<{ userId: string; permissions: PermissionKey[] }>>(`/settings/permissions/user/${userId}`, { permissions })).data,
  updateRolePermissions: async (role: Role, permissions: PermissionKey[]) =>
    (await client.patch<ApiResponse<{ role: Role; permissions: PermissionKey[] }>>(`/settings/permissions/role/${role}`, { permissions })).data,
  listInvoiceTemplates: async () =>
    (await client.get<ApiResponse<InvoiceTemplate[]>>("/settings/invoice-templates")).data,
  createInvoiceTemplate: async (payload: Omit<InvoiceTemplate, "id" | "companyId" | "createdAt" | "updatedAt">) =>
    (await client.post<ApiResponse<InvoiceTemplate>>("/settings/invoice-templates", payload)).data,
  updateInvoiceTemplate: async (
    id: string,
    payload: Partial<Omit<InvoiceTemplate, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ) => (await client.patch<ApiResponse<InvoiceTemplate>>(`/settings/invoice-templates/${id}`, payload)).data,
  setDefaultInvoiceTemplate: async (id: string) =>
    (await client.post<ApiResponse<InvoiceTemplate>>(`/settings/invoice-templates/${id}/default`)).data,
  deleteInvoiceTemplate: async (id: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/settings/invoice-templates/${id}`)).data,
  getTaxSettings: async () => (await client.get<ApiResponse<TaxSettings>>("/settings/tax")).data,
  updateTaxSettings: async (payload: Partial<TaxSettings>) =>
    (await client.patch<ApiResponse<TaxSettings>>("/settings/tax", payload)).data,
  listPaymentModes: async () =>
    (await client.get<ApiResponse<PaymentMode[]>>("/settings/payment-modes")).data,
  createPaymentMode: async (payload: Omit<PaymentMode, "id" | "companyId" | "createdAt" | "updatedAt">) =>
    (await client.post<ApiResponse<PaymentMode>>("/settings/payment-modes", payload)).data,
  updatePaymentMode: async (
    id: string,
    payload: Partial<Omit<PaymentMode, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ) => (await client.patch<ApiResponse<PaymentMode>>(`/settings/payment-modes/${id}`, payload)).data,
  setDefaultPaymentMode: async (id: string) =>
    (await client.post<ApiResponse<PaymentMode>>(`/settings/payment-modes/${id}/default`)).data,
  deletePaymentMode: async (id: string) =>
    (await client.delete<ApiResponse<Record<string, never>>>(`/settings/payment-modes/${id}`)).data,
  getUiPreferences: async () => (await client.get<ApiResponse<UiPreference>>("/settings/ui-preferences")).data,
  updateUiPreferences: async (payload: Partial<UiPreference>) =>
    (await client.patch<ApiResponse<UiPreference>>("/settings/ui-preferences", payload)).data,
  getProfileSettings: async () =>
    (await client.get<ApiResponse<ProfileSettings>>("/settings/profile-settings")).data,
  updateProfileSettings: async (payload: { fullName: string; mobileNumber?: string | null }) =>
    (await client.patch<ApiResponse<ProfileSettings>>("/settings/profile-settings", payload)).data,
  changePassword: async (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    (await client.post<ApiResponse<Record<string, never>>>("/settings/profile-settings/change-password", payload)).data,
  logoutAll: async () =>
    (await client.post<ApiResponse<Record<string, never>>>("/settings/profile-settings/logout-all")).data,
};
