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
const TRANSIENT_RETRY_DELAY_MS = 500;
const MAX_TRANSIENT_REQUEST_ATTEMPTS = 3;
const MAX_REFRESH_ATTEMPTS = 2;

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

let refreshPromise: Promise<LoginResponse> | null = null;

const shouldInvalidateSession = (error: AxiosError) => {
  const status = error.response?.status;
  return status === 401 || status === 403;
};

const isTransientStatus = (status: number | undefined) => status === 502 || status === 503 || status === 504;

const isTransientAxiosError = (error: AxiosError) =>
  isTransientStatus(error.response?.status) ||
  error.code === "ECONNABORTED" ||
  error.code === "ERR_NETWORK";

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

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const getTransientRetryDelay = (attempt: number) => TRANSIENT_RETRY_DELAY_MS * attempt;

const applySessionUpdate = (session: LoginResponse) => {
  tokenStore.set(session.accessToken);
  dispatchSessionUpdated({
    accessToken: session.accessToken,
    user: session.user,
    company: session.company ?? null,
    permissions: session.permissions,
  });
};

const requestRefreshedSession = async (): Promise<LoginResponse> => {
  for (let attempt = 1; attempt <= MAX_REFRESH_ATTEMPTS; attempt += 1) {
    try {
      const response = await refreshClient.post("/auth/refresh");
      const session = response.data.data as LoginResponse | undefined;

      if (!session?.accessToken) {
        throw new Error("Missing access token");
      }

      applySessionUpdate(session);
      return session;
    } catch (refreshError) {
      if (refreshError instanceof AxiosError && shouldInvalidateSession(refreshError)) {
        tokenStore.clear();
        dispatchSessionExpired();
      }

      if (
        !(refreshError instanceof AxiosError) ||
        !isTransientAxiosError(refreshError) ||
        attempt === MAX_REFRESH_ATTEMPTS
      ) {
        throw refreshError;
      }

      await sleep(TRANSIENT_RETRY_DELAY_MS);
    }
  }

  throw new Error("Refresh failed");
};

export const refreshSessionData = async () => {
  if (!refreshPromise) {
    refreshPromise = requestRefreshedSession().finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

export const refreshAccessToken = async () => {
  const session = await refreshSessionData();
  return session.accessToken;
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
    const originalRequest = error.config as (InternalAxiosRequestConfig & {
      _retry?: boolean;
      _transientRetryCount?: number;
    }) | undefined;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url ?? "";
    const method = originalRequest?.method?.toLowerCase();
    const transientRetryCount = originalRequest?._transientRetryCount ?? 0;

    if (status !== 401 || !originalRequest || originalRequest._retry || requestUrl.includes("/auth/login") || isAuthRefreshRequest(requestUrl)) {
      if (
        originalRequest &&
        transientRetryCount < MAX_TRANSIENT_REQUEST_ATTEMPTS &&
        (method === "get" || method === "head") &&
        isTransientAxiosError(error)
      ) {
        originalRequest._transientRetryCount = transientRetryCount + 1;
        await sleep(getTransientRetryDelay(originalRequest._transientRetryCount));
        return client(originalRequest);
      }

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        return Promise.reject(error);
      }

      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return client(originalRequest);
    } catch {
      return Promise.reject(error);
    }
  },
);

export { API_BASE_URL, client };
