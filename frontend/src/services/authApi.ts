import type { ApiResponse, LoginResponse } from "../types/api";
import type { SessionData } from "../types/auth";
import { client, refreshSessionData } from "../lib/api/client";

export interface RegisterPayload {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  gstNumber?: string;
  city?: string;
  state?: string;
  termsAccepted: boolean;
}

export const authApi = {
  register: async (payload: RegisterPayload) =>
    (await client.post<ApiResponse<SessionData>>("/auth/register", payload)).data,
  verifyOtp: async (payload: { email: string; otp: string; purpose: "register" | "forgot_password" | "change_email" }) =>
    (await client.post<ApiResponse<SessionData | { user: SessionData["user"] | null; company: SessionData["company"] | null }>>("/auth/verify-otp", payload)).data,
  resendOtp: async (payload: { email: string; purpose: "register" | "forgot_password" | "change_email" }) =>
    (await client.post<ApiResponse<Record<string, never>>>("/auth/resend-otp", payload)).data,
  login: async (payload: { identifier: string; password: string; rememberMe?: boolean }) =>
    (await client.post<ApiResponse<LoginResponse>>("/auth/login", payload)).data,
  session: async () => (await client.get<ApiResponse<SessionData>>("/auth/session")).data,
  refresh: async () => ({
    success: true,
    message: "Token refreshed successfully",
    data: await refreshSessionData(),
  }),
  forgotPassword: async (payload: { identifier: string }) =>
    (await client.post<ApiResponse<Record<string, never>>>("/auth/forgot-password", payload)).data,
  resetPassword: async (payload: { email: string; otp: string; newPassword: string; confirmPassword: string }) =>
    (await client.post<ApiResponse<Record<string, never>>>("/auth/reset-password", payload)).data,
  changePassword: async (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    (await client.post<ApiResponse<Record<string, never>>>("/auth/change-password", payload)).data,
  logout: async () => (await client.post<ApiResponse<Record<string, never>>>("/auth/logout")).data,
  logoutAll: async () => (await client.post<ApiResponse<Record<string, never>>>("/auth/logout-all")).data,
};
