import { client } from "../lib/api/client";
import { runtimePreferences } from "../lib/runtime-preferences";
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

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const DEFAULT_ACCENT = "#0f9f8a";
const DEFAULT_ERROR = "#dc2626";

const clampColorChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const expandHexColor = (value: string) => {
  const normalized = value.trim().replace("#", "");
  if (normalized.length === 3) {
    return normalized
      .split("")
      .map((channel) => `${channel}${channel}`)
      .join("");
  }

  return normalized;
};

const parseHexColor = (value: string): RgbColor | null => {
  const normalized = expandHexColor(value);
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
};

const mixColor = (base: RgbColor, target: RgbColor, ratio: number): RgbColor => ({
  r: clampColorChannel(base.r * (1 - ratio) + target.r * ratio),
  g: clampColorChannel(base.g * (1 - ratio) + target.g * ratio),
  b: clampColorChannel(base.b * (1 - ratio) + target.b * ratio),
});

const toHexColor = ({ r, g, b }: RgbColor) =>
  `#${[r, g, b].map((channel) => clampColorChannel(channel).toString(16).padStart(2, "0")).join("")}`;

const toRgbValue = ({ r, g, b }: RgbColor) => `${clampColorChannel(r)} ${clampColorChannel(g)} ${clampColorChannel(b)}`;

const toRgbaColor = ({ r, g, b }: RgbColor, alpha: number) =>
  `rgba(${clampColorChannel(r)}, ${clampColorChannel(g)}, ${clampColorChannel(b)}, ${alpha})`;

export const applyUiPreferencesToDocument = (preferences: UiPreference | null) => {
  const root = document.documentElement;
  const accent = preferences?.accentColor?.trim() || DEFAULT_ACCENT;
  const accentRgb = parseHexColor(accent) ?? parseHexColor(DEFAULT_ACCENT)!;
  const errorRgb = parseHexColor(DEFAULT_ERROR)!;
  const white = { r: 255, g: 255, b: 255 };
  const darkText = { r: 15, g: 23, b: 42 };

  const accentStrong = mixColor(accentRgb, darkText, 0.18);
  const appBg = mixColor(accentRgb, white, 0.96);
  const appBorder = mixColor(accentRgb, white, 0.86);
  const sidebarBg = mixColor(accentRgb, white, 0.92);
  const sidebarHoverBg = mixColor(accentRgb, white, 0.84);
  const sidebarActiveBg = mixColor(accentRgb, white, 0.76);
  const successBg = mixColor(accentRgb, white, 0.9);
  const successBorder = mixColor(accentRgb, white, 0.74);
  const errorBg = mixColor(errorRgb, white, 0.92);
  const errorBorder = mixColor(errorRgb, white, 0.78);

  root.style.setProperty("--app-accent", accent);
  root.style.setProperty("--app-accent-rgb", toRgbValue(accentRgb));
  root.style.setProperty("--app-accent-strong", toHexColor(accentStrong));
  root.style.setProperty("--app-accent-soft", toRgbaColor(accentRgb, 0.16));
  root.style.setProperty("--app-accent-subtle", toRgbaColor(accentRgb, 0.08));
  root.style.setProperty("--app-shell-bg", toHexColor(appBg));
  root.style.setProperty("--app-shell-surface", "#ffffff");
  root.style.setProperty("--app-shell-surface-muted", toRgbaColor(white, 0.9));
  root.style.setProperty("--app-shell-border", toHexColor(appBorder));
  root.style.setProperty("--app-shell-text", "#0f172a");
  root.style.setProperty("--app-shell-muted", "#64748b");
  root.style.setProperty("--app-topbar-bg", toRgbaColor(white, 0.92));
  root.style.setProperty("--app-sidebar-bg", toHexColor(sidebarBg));
  root.style.setProperty("--app-sidebar-border", toHexColor(appBorder));
  root.style.setProperty("--app-sidebar-hover-bg", toHexColor(sidebarHoverBg));
  root.style.setProperty("--app-sidebar-active-bg", toHexColor(sidebarActiveBg));
  root.style.setProperty("--app-success-bg", toHexColor(successBg));
  root.style.setProperty("--app-success-border", toHexColor(successBorder));
  root.style.setProperty("--app-success-text", toHexColor(accentStrong));
  root.style.setProperty("--app-success-icon", accent);
  root.style.setProperty("--app-error-bg", toHexColor(errorBg));
  root.style.setProperty("--app-error-border", toHexColor(errorBorder));
  root.style.setProperty("--app-error-text", "#b91c1c");
  root.style.setProperty("--app-error-icon", DEFAULT_ERROR);
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
  getTaxSettings: async () => {
    const response = await client.get<ApiResponse<TaxSettings>>("/settings/tax");
    runtimePreferences.setRoundOffEnabled(response.data.data.roundOffEnabled);
    return response.data;
  },
  updateTaxSettings: async (payload: Partial<TaxSettings>) => {
    const response = await client.patch<ApiResponse<TaxSettings>>("/settings/tax", payload);
    runtimePreferences.setRoundOffEnabled(response.data.data.roundOffEnabled);
    return response.data;
  },
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
  getUiPreferences: async () => {
    const response = await client.get<ApiResponse<UiPreference>>("/settings/ui-preferences");
    runtimePreferences.setDateFormat(response.data.data.dateFormat);
    return response.data;
  },
  updateUiPreferences: async (payload: Partial<UiPreference>) => {
    const response = await client.patch<ApiResponse<UiPreference>>("/settings/ui-preferences", payload);
    runtimePreferences.setDateFormat(response.data.data.dateFormat);
    return response.data;
  },
  getProfileSettings: async () =>
    (await client.get<ApiResponse<ProfileSettings>>("/settings/profile-settings")).data,
  updateProfileSettings: async (payload: { fullName: string; mobileNumber?: string | null }) =>
    (await client.patch<ApiResponse<ProfileSettings>>("/settings/profile-settings", payload)).data,
  changePassword: async (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    (await client.post<ApiResponse<Record<string, never>>>("/settings/profile-settings/change-password", payload)).data,
  logoutAll: async () =>
    (await client.post<ApiResponse<Record<string, never>>>("/settings/profile-settings/logout-all")).data,
};
