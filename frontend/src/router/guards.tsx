import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../providers/useAuth";
import { LoadingState } from "../components/ui/LoadingState";
import type { PermissionKey, Role } from "../types/auth";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <LoadingState label="Loading workspace..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
};

export const PublicOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <LoadingState label="Loading..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export const PermissionRoute = ({
  children,
  permissions,
  roles,
}: {
  children: ReactNode;
  permissions?: PermissionKey[];
  roles?: Role[];
}) => {
  const auth = useAuth();

  const allowedByRole = roles ? auth.hasRole(roles) : true;
  const allowedByPermission = permissions ? auth.hasPermission(permissions) : true;

  if (!allowedByRole || !allowedByPermission) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

