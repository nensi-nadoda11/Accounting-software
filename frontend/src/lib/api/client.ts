import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { authBootstrap } from "../auth-bootstrap";
import { dispatchSessionExpired, dispatchSessionUpdated } from "../auth-events";
import { tokenStore } from "../token-store";
import type { LoginResponse } from "../../types/api";
import { getApiBaseUrl } from "./resolve-api-base";

const API_BASE_URL = getApiBaseUrl({
  configuredBaseUrl: import.meta.env.VITE_API_BASE_URL,
  isDev: import.meta.env.DEV
});
const REQUEST_TIMEOUT_MS = 15000;

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

const shouldInvalidateSession = (error: AxiosError) => {
  const status = error.response?.status;
  return status === 401 || status === 403;
};

const isAuthRefreshRequest = (url: string) => url.includes("/auth/refresh");

const isAuthBootstrapSafeRequest = (url: string) =>
  url.includes("/auth/login") ||
  url.includes("/auth/register") ||
  url.includes("/auth/verify-otp") ||
  url.includes("/auth/resend-otp") ||
  url.includes("/auth/forgot-password") ||
  url.includes("/auth/reset-password") ||
  url.includes("/users/accept-invite") ||
  isAuthRefreshRequest(url);

const refreshAccessToken = async () => {
  try {
    const response = await refreshClient.post("/auth/refresh");
    const session = response.data.data as LoginResponse | undefined;
    const token = session?.accessToken;

    if (!token) {
      throw new Error("Missing access token");
    }

    tokenStore.set(token);
    if (session?.user) {
      dispatchSessionUpdated({
        accessToken: token,
        user: session.user,
        company: session.company ?? null,
        permissions: session.permissions,
      });
    }

    return token;
  } catch (refreshError) {
    if (refreshError instanceof AxiosError && shouldInvalidateSession(refreshError)) {
      tokenStore.clear();
      dispatchSessionExpired();
    }

    throw refreshError;
  } finally {
    refreshPromise = null;
  }
};

client.interceptors.request.use(async (config) => {
  const requestUrl = config.url ?? "";
  const bootstrapPromise = authBootstrap.get();

  if (!tokenStore.get() && bootstrapPromise && !isAuthBootstrapSafeRequest(requestUrl)) {
    try {
      await bootstrapPromise;
    } catch {
      // Let the request continue and fail naturally if bootstrap could not restore the session.
    }
  }

  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url ?? "";

    if (status !== 401 || !originalRequest || originalRequest._retry || requestUrl.includes("/auth/login") || isAuthRefreshRequest(requestUrl)) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken();
      }

      const newToken = await refreshPromise;
      if (!newToken) {
        return Promise.reject(error);
      }

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return client(originalRequest);
    } catch {
      return Promise.reject(error);
    }
  },
);

export { API_BASE_URL, client };
