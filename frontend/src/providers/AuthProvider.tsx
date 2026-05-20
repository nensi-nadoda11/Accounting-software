import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { AxiosError } from "axios";

import { authApi } from "../services/authApi";
import { tokenStore } from "../lib/token-store";
import type { Company, PermissionKey, User } from "../types/auth";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { useToast } from "./useToast";

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setAccessToken(null);
    setUser(null);
    setCompany(null);
    setPermissions([]);
  }, []);

  const setSession = useCallback(
    (payload: { accessToken: string; user: User; company: Company | null; permissions: PermissionKey[] }) => {
      tokenStore.set(payload.accessToken);
      setAccessToken(payload.accessToken);
      setUser(payload.user);
      setCompany(payload.company);
      setPermissions(payload.permissions);
    },
    [],
  );

  const refreshSession = useCallback(async () => {
    try {
      const response = await authApi.refresh();
      setSession({
        accessToken: response.data.accessToken,
        user: response.data.user,
        company: response.data.company,
        permissions: response.data.permissions,
      });
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        if (status === 401 || status === 403) {
          clearSession();
        }
        return;
      }

      clearSession();
    }
  }, [clearSession, setSession]);

  useEffect(() => {
    void (async () => {
      try {
        await refreshSession();
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [refreshSession]);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession();
      toast.error("Session expired. Please login again.");
    };

    window.addEventListener("session-expired", handleSessionExpired);
    return () => window.removeEventListener("session-expired", handleSessionExpired);
  }, [clearSession, toast]);

  const login = useCallback<AuthContextValue["login"]>(
    async (payload) => {
      const response = await authApi.login(payload);
      setSession({
        accessToken: response.data.accessToken,
        user: response.data.user,
        company: response.data.company,
        permissions: response.data.permissions,
      });
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      company,
      permissions,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      isInitializing,
      login,
      logout,
      logoutAll,
      refreshSession,
      hasRole: (roles) => (user ? roles.includes(user.role) : false),
      hasPermission: (permission) => {
        const list = Array.isArray(permission) ? permission : [permission];
        return list.some((item) => permissions.includes(item));
      },
      setSession,
      updateUser: (nextUser) => setUser(nextUser),
      updateCompany: (nextCompany) => setCompany(nextCompany),
    }),
    [accessToken, company, isInitializing, login, logout, logoutAll, permissions, refreshSession, setSession, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
