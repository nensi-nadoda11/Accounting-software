import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { AcceptInvitePage } from "../features/auth/AcceptInvitePage";
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage";
import { VerifyOtpPage } from "../features/auth/VerifyOtpPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { InvitesPage } from "../features/settings/InvitesPage";
import { ProfilePage } from "../features/settings/ProfilePage";
import { RolesPermissionsPage } from "../features/settings/RolesPermissionsPage";
import { SecurityPage } from "../features/settings/SecurityPage";
import { UsersPage } from "../features/settings/UsersPage";
import { UnauthorizedPage } from "../features/shared/UnauthorizedPage";
import { PermissionRoute, ProtectedRoute, PublicOnlyRoute } from "./guards";

export const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
      <Route path="/verify-otp" element={<PublicOnlyRoute><VerifyOtpPage /></PublicOnlyRoute>} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
      <Route path="/reset-password" element={<PublicOnlyRoute><ResetPasswordPage /></PublicOnlyRoute>} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route
          path="settings/users"
          element={
            <PermissionRoute permissions={["user.view", "user.manage"]}>
              <UsersPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings/invites"
          element={
            <PermissionRoute permissions={["user.view", "user.manage"]}>
              <InvitesPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings/roles-permissions"
          element={
            <PermissionRoute permissions={["user.view", "user.manage"]}>
              <RolesPermissionsPage />
            </PermissionRoute>
          }
        />
        <Route path="settings/profile" element={<ProfilePage />} />
        <Route path="settings/security" element={<SecurityPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
