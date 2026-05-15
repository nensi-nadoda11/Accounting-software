import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { tokenStore } from "../token-store";

const resolveApiOrigin = () => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    if (window.location.port === "5173") {
      return "http://localhost:4000";
    }

    return window.location.origin.replace(/\/+$/, "");
  }

  return "http://localhost:4000";
};

const API_BASE_URL = `${resolveApiOrigin()}/api/v1`;

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let refreshPromise: Promise<string | null> | null = null;

const dispatchSessionExpired = () => {
  window.dispatchEvent(new CustomEvent("session-expired"));
};

client.interceptors.request.use((config) => {
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

    if (status !== 401 || !originalRequest || originalRequest._retry || requestUrl.includes("/auth/login")) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshClient
          .post("/auth/refresh")
          .then((response) => {
            const token = response.data.data.accessToken as string | undefined;
            if (!token) {
              throw new Error("Missing access token");
            }
            tokenStore.set(token);
            return token;
          })
          .catch((refreshError) => {
            tokenStore.clear();
            dispatchSessionExpired();
            throw refreshError;
          })
          .finally(() => {
            refreshPromise = null;
          });
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
