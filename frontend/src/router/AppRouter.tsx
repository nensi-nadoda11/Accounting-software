import { Suspense, lazy, type ComponentType } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../components/layout/AppLayout";
import { useAuth } from "../providers/useAuth";
import { PermissionRoute, ProtectedRoute, PublicOnlyRoute } from "./guards";
import type { PurchasePageTab } from "../features/purchases/PurchasePage";
import type { SalesPageTab } from "../features/sales/SalesPage";

const lazyNamed = <TProps extends object>(
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
) =>
  lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as ComponentType<TProps> };
  });

const AcceptInvitePage = lazyNamed<Record<string, never>>(() => import("../features/auth/AcceptInvitePage"), "AcceptInvitePage");
const ForgotPasswordPage = lazyNamed<Record<string, never>>(() => import("../features/auth/ForgotPasswordPage"), "ForgotPasswordPage");
const LoginPage = lazyNamed<Record<string, never>>(() => import("../features/auth/LoginPage"), "LoginPage");
const RegisterPage = lazyNamed<Record<string, never>>(() => import("../features/auth/RegisterPage"), "RegisterPage");
const ResetPasswordPage = lazyNamed<Record<string, never>>(() => import("../features/auth/ResetPasswordPage"), "ResetPasswordPage");
const VerifyOtpPage = lazyNamed<Record<string, never>>(() => import("../features/auth/VerifyOtpPage"), "VerifyOtpPage");
const AccountingCorePage = lazyNamed<Record<string, never>>(() => import("../features/accounting/AccountingCorePage"), "AccountingCorePage");
const ExpensesPage = lazyNamed<Record<string, never>>(() => import("../features/expenses/ExpensesPage"), "ExpensesPage");
const GstManagementPage = lazyNamed<Record<string, never>>(() => import("../features/gst/GstManagementPage"), "GstManagementPage");
const PaymentsPage = lazyNamed<Record<string, never>>(() => import("../features/payments/PaymentsPage"), "PaymentsPage");
const PayrollPage = lazyNamed<Record<string, never>>(() => import("../features/payroll/PayrollPage"), "PayrollPage");
const CustomersPage = lazyNamed<Record<string, never>>(() => import("../features/customers/CustomersPage"), "CustomersPage");
const DashboardPage = lazyNamed<Record<string, never>>(() => import("../features/dashboard/DashboardPage"), "DashboardPage");
const NotificationsPage = lazyNamed<Record<string, never>>(() => import("../features/notifications/NotificationsPage"), "NotificationsPage");
const BankAccountsPage = lazyNamed<Record<string, never>>(() => import("../features/company/BankAccountsPage"), "BankAccountsPage");
const BranchesPage = lazyNamed<Record<string, never>>(() => import("../features/company/BranchesPage"), "BranchesPage");
const BrandingPage = lazyNamed<Record<string, never>>(() => import("../features/company/BrandingPage"), "BrandingPage");
const CompanyProfilePage = lazyNamed<Record<string, never>>(() => import("../features/company/CompanyProfilePage"), "CompanyProfilePage");
const FinancialYearsPage = lazyNamed<Record<string, never>>(() => import("../features/company/FinancialYearsPage"), "FinancialYearsPage");
const InvoiceSettingsPage = lazyNamed<Record<string, never>>(() => import("../features/company/InvoiceSettingsPage"), "InvoiceSettingsPage");
const InventoryStockPage = lazyNamed<Record<string, never>>(() => import("../features/inventory/InventoryStockPage"), "InventoryStockPage");
const PreferencesPage = lazyNamed<Record<string, never>>(() => import("../features/company/PreferencesPage"), "PreferencesPage");
const PurchasePage = lazyNamed<{ tab: PurchasePageTab }>(() => import("../features/purchases/PurchasePage"), "PurchasePage");
const ReportsPage = lazyNamed<Record<string, never>>(() => import("../features/reports/ReportsPage"), "ReportsPage");
const SalesPage = lazyNamed<{ tab: SalesPageTab }>(() => import("../features/sales/SalesPage"), "SalesPage");
const SecurityAdminPage = lazyNamed<Record<string, never>>(() => import("../features/security-admin/SecurityAdminPage"), "SecurityAdminPage");
const TaxSettingsPage = lazyNamed<Record<string, never>>(() => import("../features/company/TaxSettingsPage"), "TaxSettingsPage");
const ProductsPage = lazyNamed<Record<string, never>>(() => import("../features/products/ProductsPage"), "ProductsPage");
const SettingsFinalPage = lazyNamed<Record<string, never>>(() => import("../features/settings-final/SettingsFinalPage"), "SettingsFinalPage");
const InvitesPage = lazyNamed<Record<string, never>>(() => import("../features/settings/InvitesPage"), "InvitesPage");
const ProfilePage = lazyNamed<Record<string, never>>(() => import("../features/settings/ProfilePage"), "ProfilePage");
const RolesPermissionsPage = lazyNamed<Record<string, never>>(() => import("../features/settings/RolesPermissionsPage"), "RolesPermissionsPage");
const SecurityPage = lazyNamed<Record<string, never>>(() => import("../features/settings/SecurityPage"), "SecurityPage");
const SuppliersPage = lazyNamed<Record<string, never>>(() => import("../features/suppliers/SuppliersPage"), "SuppliersPage");
const UsersPage = lazyNamed<Record<string, never>>(() => import("../features/settings/UsersPage"), "UsersPage");
const UnauthorizedPage = lazyNamed<Record<string, never>>(() => import("../features/shared/UnauthorizedPage"), "UnauthorizedPage");

const RouteFallback = () => <div className="p-6 text-sm text-slate-500">Loading page...</div>;

const SettingsIndexRedirect = () => {
  const auth = useAuth();

  if (
    auth.hasPermission([
      "settings.view",
      "settings.manage",
      "permissions.manage",
      "invoice.settings.manage",
      "tax.settings.manage",
      "payment.settings.manage",
      "profile.manage",
    ])
  ) {
    return <Navigate to="/app/settings/final" replace />;
  }

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
    <Suspense fallback={<RouteFallback />}>
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
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <PermissionRoute permissions={["dashboard.view"]}>
                <DashboardPage />
              </PermissionRoute>
            }
          />
          <Route
            path="system/notifications"
            element={
              <PermissionRoute permissions={["notifications.view"]}>
                <NotificationsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="system/security-admin"
            element={
              <PermissionRoute
                permissions={["audit.view", "audit.export", "backup.create", "backup.download", "backup.restore", "backup.delete"]}
              >
                <SecurityAdminPage />
              </PermissionRoute>
            }
          />
          <Route
            path="accounting/core"
            element={
              <PermissionRoute
                permissions={[
                  "accounting.view",
                  "accounting.manage",
                  "accounting.journal.create",
                  "accounting.journal.post",
                  "accounting.journal.cancel",
                  "accounting.reports.view",
                  "accounting.export",
                  "chart.manage",
                  "ledger.view",
                  "cashbook.view",
                  "bankbook.view",
                ]}
              >
                <AccountingCorePage />
              </PermissionRoute>
            }
          />
          <Route
            path="accounting/expenses"
            element={
              <PermissionRoute
                permissions={[
                  "expense.view",
                  "expense.create",
                  "expense.update",
                  "expense.delete",
                  "expense.post",
                  "expense.export",
                  "expense.category.manage",
                  "expense.recurring.manage",
                ]}
              >
                <ExpensesPage />
              </PermissionRoute>
            }
          />
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
            path="accounting/gst"
            element={
              <PermissionRoute permissions={["gst.view", "gst.manage", "gst.export", "gst.itc.manage", "gst.adjustment.manage"]}>
                <GstManagementPage />
              </PermissionRoute>
            }
          />
          <Route
            path="reports"
            element={
              <PermissionRoute permissions={["reports.view", "report.view"]}>
                <ReportsPage />
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
          <Route
            path="hr-payroll/payroll"
            element={
              <PermissionRoute
                permissions={[
                  "payroll.view",
                  "payroll.employee.manage",
                  "payroll.structure.manage",
                  "payroll.generate",
                  "payroll.pay",
                  "payroll.export",
                  "payroll.slip.print",
                  "payroll.manage",
                ]}
              >
                <PayrollPage />
              </PermissionRoute>
            }
          />
          <Route path="settings" element={<SettingsIndexRedirect />} />
          <Route
            path="settings/final"
            element={
              <PermissionRoute
                permissions={[
                  "settings.view",
                  "settings.manage",
                  "permissions.manage",
                  "invoice.settings.manage",
                  "tax.settings.manage",
                  "payment.settings.manage",
                  "profile.manage",
                ]}
              >
                <SettingsFinalPage />
              </PermissionRoute>
            }
          />
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
    </Suspense>
  </BrowserRouter>
);
