import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { AcceptInvitePage } from "../features/auth/AcceptInvitePage";
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage";
import { VerifyOtpPage } from "../features/auth/VerifyOtpPage";
import { PaymentsPage } from "../features/payments/PaymentsPage";
import { CustomersPage } from "../features/customers/CustomersPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { BankAccountsPage } from "../features/company/BankAccountsPage";
import { BranchesPage } from "../features/company/BranchesPage";
import { BrandingPage } from "../features/company/BrandingPage";
import { CompanyProfilePage } from "../features/company/CompanyProfilePage";
import { FinancialYearsPage } from "../features/company/FinancialYearsPage";
import { InvoiceSettingsPage } from "../features/company/InvoiceSettingsPage";
import { InventoryStockPage } from "../features/inventory/InventoryStockPage";
import { PreferencesPage } from "../features/company/PreferencesPage";
import { PurchasePage } from "../features/purchases/PurchasePage";
import { SalesPage } from "../features/sales/SalesPage";
import { TaxSettingsPage } from "../features/company/TaxSettingsPage";
import { ProductsPage } from "../features/products/ProductsPage";
import { InvitesPage } from "../features/settings/InvitesPage";
import { ProfilePage } from "../features/settings/ProfilePage";
import { RolesPermissionsPage } from "../features/settings/RolesPermissionsPage";
import { SecurityPage } from "../features/settings/SecurityPage";
import { SuppliersPage } from "../features/suppliers/SuppliersPage";
import { UsersPage } from "../features/settings/UsersPage";
import { UnauthorizedPage } from "../features/shared/UnauthorizedPage";
import { useAuth } from "../providers/AuthProvider";
import { PermissionRoute, ProtectedRoute, PublicOnlyRoute } from "./guards";

const SettingsIndexRedirect = () => {
  const auth = useAuth();

  if (auth.hasPermission("settings.manage")) {
    return <Navigate to="/app/settings/company/profile" replace />;
  }

  if (auth.hasPermission(["user.view", "user.manage"])) {
    return <Navigate to="/app/settings/users" replace />;
  }

  return <Navigate to="/app/settings/profile" replace />;
};

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
          path="accounting/payments"
          element={
            <PermissionRoute
              permissions={[
                "payment.view",
                "payment.receive",
                "payment.pay",
                "payment.update",
                "payment.cancel",
                "payment.export",
                "payment.receipt.print",
                "payment.reminder.manage",
              ]}
            >
              <PaymentsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="sales/invoices"
          element={
            <PermissionRoute permissions={["sales.view"]}>
              <SalesPage tab="invoices" />
            </PermissionRoute>
          }
        />
        <Route
          path="sales/pos"
          element={
            <PermissionRoute permissions={["sales.create", "sales.pos.access"]}>
              <SalesPage tab="pos" />
            </PermissionRoute>
          }
        />
        <Route
          path="sales/returns"
          element={
            <PermissionRoute permissions={["sales.view", "sales.return"]}>
              <SalesPage tab="returns" />
            </PermissionRoute>
          }
        />
        <Route
          path="sales/payments"
          element={
            <PermissionRoute permissions={["sales.payment.view", "sales.payment.manage"]}>
              <SalesPage tab="payments" />
            </PermissionRoute>
          }
        />
        <Route
          path="sales/customers"
          element={
            <PermissionRoute permissions={["customer.view"]}>
              <CustomersPage />
            </PermissionRoute>
          }
        />
        <Route
          path="purchases/invoices"
          element={
            <PermissionRoute permissions={["purchase.view"]}>
              <PurchasePage tab="invoices" />
            </PermissionRoute>
          }
        />
        <Route
          path="purchases/new"
          element={
            <PermissionRoute permissions={["purchase.create", "purchase.update"]}>
              <PurchasePage tab="new" />
            </PermissionRoute>
          }
        />
        <Route
          path="purchases/returns"
          element={
            <PermissionRoute permissions={["purchase.view", "purchase.return"]}>
              <PurchasePage tab="returns" />
            </PermissionRoute>
          }
        />
        <Route
          path="purchases/payments"
          element={
            <PermissionRoute permissions={["purchase.payment.view", "purchase.payment.manage"]}>
              <PurchasePage tab="payments" />
            </PermissionRoute>
          }
        />
        <Route
          path="purchases/suppliers"
          element={
            <PermissionRoute permissions={["supplier.view"]}>
              <SuppliersPage />
            </PermissionRoute>
          }
        />
        <Route
          path="inventory/stock"
          element={
            <PermissionRoute permissions={["inventory.view", "warehouse.manage", "batch.view", "inventory.valuation.view"]}>
              <InventoryStockPage />
            </PermissionRoute>
          }
        />
        <Route
          path="inventory/products"
          element={
            <PermissionRoute permissions={["product.view"]}>
              <ProductsPage />
            </PermissionRoute>
          }
        />
        <Route path="settings" element={<SettingsIndexRedirect />} />
        <Route
          path="settings/company/profile"
          element={
            <PermissionRoute permissions={["settings.manage"]}>
              <CompanyProfilePage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings/company/tax"
          element={
            <PermissionRoute permissions={["settings.manage"]}>
              <TaxSettingsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings/company/financial-years"
          element={
            <PermissionRoute permissions={["settings.manage"]}>
              <FinancialYearsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings/company/banks"
          element={
            <PermissionRoute permissions={["settings.manage"]}>
              <BankAccountsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings/company/invoice-settings"
          element={
            <PermissionRoute permissions={["settings.manage"]}>
              <InvoiceSettingsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings/company/branding"
          element={
            <PermissionRoute permissions={["settings.manage"]}>
              <BrandingPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings/company/branches"
          element={
            <PermissionRoute permissions={["settings.manage"]}>
              <BranchesPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings/company/preferences"
          element={
            <PermissionRoute permissions={["settings.manage"]}>
              <PreferencesPage />
            </PermissionRoute>
          }
        />
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
