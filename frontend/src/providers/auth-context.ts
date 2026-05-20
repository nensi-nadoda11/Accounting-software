import { createContext } from "react";

import type { Company, PermissionKey, Role, User } from "../types/auth";

export type AuthContextValue = {
  user: User | null;
  company: Company | null;
  permissions: PermissionKey[];
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (payload: { identifier: string; password: string; rememberMe?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
  hasPermission: (permission: PermissionKey | PermissionKey[]) => boolean;
  setSession: (payload: { accessToken: string; user: User; company: Company | null; permissions: PermissionKey[] }) => void;
  updateUser: (user: User) => void;
  updateCompany: (company: Company | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
