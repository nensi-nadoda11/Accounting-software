import type { PermissionKey } from "../types/auth";

export type TopNavMenu = "dashboard" | "accounting" | "sales" | "purchases" | "inventory" | "hr-payroll" | "reports" | "audit" | "settings";

type NavPermissionChecker = (permission: PermissionKey | PermissionKey[]) => boolean;
type PermissionAwareRoute = {
  href: string;
  permissions?: readonly PermissionKey[];
};
export type SectionNavItem = {
  label: string;
  href: string;
  permissions?: readonly PermissionKey[];
};
export type NestedSidebarConfig = {
  title: string;
  tabs: readonly SectionNavItem[];
};

export const TOP_NAV_ITEMS: ReadonlyArray<{ label: string; href: string; menu: TopNavMenu }> = [
  { label: "Dashboard", href: "/app/dashboard", menu: "dashboard" },
  { label: "Accounting", href: "/app/accounting", menu: "accounting" },
  { label: "Sales", href: "/app/sales", menu: "sales" },
  { label: "Purchases", href: "/app/purchases", menu: "purchases" },
  { label: "Inventory", href: "/app/inventory", menu: "inventory" },
  { label: "Payroll", href: "/app/hr-payroll", menu: "hr-payroll" },
  { label: "Reports", href: "/app/reports", menu: "reports" },
  { label: "Audit", href: "/app/audit", menu: "audit" },
  { label: "Settings", href: "/app/settings", menu: "settings" },
] as const;

export const SETTINGS_TABS = [
  {
    label: "Final Settings",
    href: "/app/settings/final",
    permissions: [
      "settings.view",
      "settings.manage",
      "permissions.manage",
      "invoice.settings.manage",
      "tax.settings.manage",
      "payment.settings.manage",
      "profile.manage",
    ],
  },
  { label: "Profile", href: "/app/settings/profile" },
  { label: "Company Profile", href: "/app/settings/company/profile", permissions: ["settings.manage"] },
  { label: "Tax & GST", href: "/app/settings/company/tax", permissions: ["settings.manage"] },
  { label: "Financial Year", href: "/app/settings/company/financial-years", permissions: ["settings.manage"] },
  { label: "Banks", href: "/app/settings/company/banks", permissions: ["settings.manage"] },
  { label: "Invoice Settings", href: "/app/settings/company/invoice-settings", permissions: ["settings.manage"] },
  { label: "Branding", href: "/app/settings/company/branding", permissions: ["settings.manage"] },
  { label: "Branches", href: "/app/settings/company/branches", permissions: ["settings.manage"] },
  { label: "Preferences", href: "/app/settings/company/preferences", permissions: ["settings.manage"] },
  { label: "Users", href: "/app/settings/users", permissions: ["user.view", "user.manage"] },
  { label: "Invites", href: "/app/settings/invites", permissions: ["user.view", "user.manage"] },
  { label: "Security", href: "/app/settings/security" },
] as const satisfies readonly SectionNavItem[];

export const ACCOUNTING_TABS = [
  {
    label: "Core",
    href: "/app/accounting/core",
    permissions: [
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
      "cash_verification.view",
      "cash_verification.create",
      "cash_verification.verify",
      "cash_verification.export",
    ],
  },
  {
    label: "Cash Verification",
    href: "/app/accounting/cash-verification",
    permissions: ["cash_verification.view", "cash_verification.create", "cash_verification.verify", "cash_verification.export"],
  },
  {
    label: "Expenses",
    href: "/app/accounting/expenses",
    permissions: [
      "expense.view",
      "expense.create",
      "expense.update",
      "expense.delete",
      "expense.post",
      "expense.export",
      "expense.category.manage",
      "expense.recurring.manage",
    ],
  },
  {
    label: "Payments",
    href: "/app/accounting/payments",
    permissions: [
      "payment.view",
      "payment.receive",
      "payment.pay",
      "payment.update",
      "payment.cancel",
      "payment.export",
      "payment.receipt.print",
      "payment.reminder.manage",
    ],
  },
  {
    label: "GST & Tax",
    href: "/app/accounting/gst",
    permissions: ["gst.view", "gst.manage", "gst.export", "gst.itc.manage", "gst.adjustment.manage"],
  },
] as const satisfies readonly SectionNavItem[];

export const PURCHASES_TABS = [
  { label: "Suppliers", href: "/app/purchases/suppliers", permissions: ["supplier.view"] },
  { label: "Purchase Invoices", href: "/app/purchases/invoices", permissions: ["purchase.view"] },
  { label: "New Purchase", href: "/app/purchases/new", permissions: ["purchase.create", "purchase.update"] },
  { label: "Returns", href: "/app/purchases/returns", permissions: ["purchase.view", "purchase.return"] },
] as const satisfies readonly SectionNavItem[];

export const SALES_TABS = [
  { label: "Customers", href: "/app/sales/customers", permissions: ["customer.view"] },
  { label: "Sales Invoices", href: "/app/sales/invoices", permissions: ["sales.view"] },
  { label: "POS Billing", href: "/app/sales/pos", permissions: ["sales.create", "sales.pos.access"] },
  { label: "Returns", href: "/app/sales/returns", permissions: ["sales.view", "sales.return"] },
] as const satisfies readonly SectionNavItem[];

export const INVENTORY_TABS = [
  {
    label: "Stock",
    href: "/app/inventory/stock",
    permissions: ["inventory.view", "warehouse.manage", "batch.view", "inventory.valuation.view"],
  },
  {
    label: "Stock Check",
    href: "/app/inventory/stock-check",
    permissions: ["stock_check.view", "stock_check.create", "stock_check.approve", "stock_check.export"],
  },
  {
    label: "Products",
    href: "/app/inventory/products",
    permissions: ["product.view", "category.manage", "unit.manage", "product.price.view"],
  },
] as const satisfies readonly SectionNavItem[];

export const HR_PAYROLL_TABS = [
  {
    label: "Payroll",
    href: "/app/hr-payroll/payroll",
    permissions: [
      "payroll.view",
      "payroll.employee.manage",
      "payroll.structure.manage",
      "payroll.generate",
      "payroll.pay",
      "payroll.export",
      "payroll.slip.print",
      "payroll.manage",
    ],
  },
] as const satisfies readonly SectionNavItem[];

export const REPORTS_TABS = [
  { label: "Overview", href: "/app/reports?tab=overview", permissions: ["reports.view", "report.view"] },
  { label: "Sales", href: "/app/reports?tab=sales", permissions: ["reports.sales.view"] },
  { label: "Purchases", href: "/app/reports?tab=purchases", permissions: ["reports.purchase.view"] },
  { label: "Customers", href: "/app/reports?tab=customers", permissions: ["reports.customer.view"] },
  { label: "Suppliers", href: "/app/reports?tab=suppliers", permissions: ["reports.supplier.view"] },
  { label: "Inventory", href: "/app/reports?tab=inventory", permissions: ["reports.inventory.view"] },
  { label: "Expenses", href: "/app/reports?tab=expenses", permissions: ["reports.expense.view"] },
  { label: "Income", href: "/app/reports?tab=income", permissions: ["reports.income.view"] },
  { label: "Payroll", href: "/app/reports?tab=payroll", permissions: ["reports.payroll.view"] },
  { label: "GST", href: "/app/reports?tab=gst", permissions: ["reports.gst.view"] },
  { label: "Accounting", href: "/app/reports?tab=accounting", permissions: ["reports.accounting.view"] },
] as const satisfies readonly SectionNavItem[];

export const AUDIT_TABS = [
  {
    label: "Site Audit",
    href: "/app/audit/site-audit",
    permissions: ["site_audit.view", "site_audit.create", "site_audit.update", "site_audit.approve", "site_audit.export"],
  },
] as const satisfies readonly SectionNavItem[];

const DASHBOARD_ROUTES = [{ href: "/app/dashboard", permissions: ["dashboard.view"] }] as const satisfies readonly PermissionAwareRoute[];

const isRouteAccessible = (route: PermissionAwareRoute, hasPermission: NavPermissionChecker) =>
  route.permissions ? hasPermission(Array.from(route.permissions)) : true;

const getRoutesForMenu = (menu: TopNavMenu): readonly PermissionAwareRoute[] => {
  switch (menu) {
    case "dashboard":
      return DASHBOARD_ROUTES;
    case "accounting":
      return ACCOUNTING_TABS;
    case "sales":
      return SALES_TABS;
    case "purchases":
      return PURCHASES_TABS;
    case "inventory":
      return INVENTORY_TABS;
    case "hr-payroll":
      return HR_PAYROLL_TABS;
    case "reports":
      return REPORTS_TABS;
    case "audit":
      return AUDIT_TABS;
    case "settings":
      return SETTINGS_TABS;
    default:
      return [];
  }
};

export const getSubTabsForPathname = (pathname: string): readonly SectionNavItem[] => {
  if (pathname.startsWith("/app/sales")) {
    return SALES_TABS;
  }
  if (pathname.startsWith("/app/purchases")) {
    return PURCHASES_TABS;
  }
  if (pathname.startsWith("/app/inventory")) {
    return INVENTORY_TABS;
  }
  if (pathname.startsWith("/app/hr-payroll")) {
    return HR_PAYROLL_TABS;
  }
  if (pathname.startsWith("/app/accounting")) {
    return ACCOUNTING_TABS;
  }
  if (pathname.startsWith("/app/audit")) {
    return AUDIT_TABS;
  }
  return SETTINGS_TABS;
};

const SIDEBAR_ROUTE_CONFIGS: ReadonlyArray<{
  title: string;
  tabs: readonly SectionNavItem[];
  matches: readonly string[];
}> = [
  {
    title: "Settings",
    tabs: SETTINGS_TABS,
    matches: ["/app/settings"],
  },
  {
    title: "Accounting",
    tabs: ACCOUNTING_TABS,
    matches: ["/app/accounting"],
  },
  {
    title: "Sales",
    tabs: SALES_TABS,
    matches: ["/app/sales"],
  },
  {
    title: "Purchases",
    tabs: PURCHASES_TABS,
    matches: ["/app/purchases"],
  },
  {
    title: "Payroll",
    tabs: HR_PAYROLL_TABS,
    matches: ["/app/hr-payroll"],
  },
  {
    title: "Reports",
    tabs: REPORTS_TABS,
    matches: ["/app/reports"],
  },
] as const;

export const getNestedSidebarConfigForPathname = (pathname: string): NestedSidebarConfig | null =>
  pathname.startsWith("/app/accounting/cash-verification") || pathname.startsWith("/app/audit/site-audit")
    ? null
    :
  SIDEBAR_ROUTE_CONFIGS.find((config) =>
    config.matches.some((route) => pathname === route || pathname.startsWith(`${route}/`)),
  ) ?? null;

export const getFirstAccessibleTopNavHref = (menu: TopNavMenu, hasPermission: NavPermissionChecker) =>
  getRoutesForMenu(menu).find((route) => isRouteAccessible(route, hasPermission))?.href ?? null;

export const getAccessibleTopNavItems = (hasPermission: NavPermissionChecker) =>
  TOP_NAV_ITEMS.flatMap((item) => {
    const href = getFirstAccessibleTopNavHref(item.menu, hasPermission);
    return href ? [{ ...item, href }] : [];
  });

export const getDefaultAppHref = (hasPermission: NavPermissionChecker) =>
  getAccessibleTopNavItems(hasPermission)[0]?.href ?? "/app/settings/profile";
