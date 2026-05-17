export const TOP_NAV_ITEMS = [
  { label: "Dashboard", href: "/app?menu=dashboard", menu: "dashboard" },
  { label: "Accounting", href: "/app?menu=accounting", menu: "accounting" },
  { label: "Sales", href: "/app/sales/customers", menu: "sales" },
  { label: "Purchases", href: "/app/purchases/suppliers", menu: "purchases" },
  { label: "Inventory", href: "/app/inventory/products", menu: "inventory" },
  { label: "Reports", href: "/app?menu=reports", menu: "reports" },
  { label: "Settings", href: "/app/settings", menu: "settings" },
] as const;

export const SETTINGS_TABS = [
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
  { label: "Roles & Permissions", href: "/app/settings/roles-permissions", permissions: ["user.view", "user.manage"] },
  { label: "Profile", href: "/app/settings/profile" },
  { label: "Security", href: "/app/settings/security" },
] as const;

export const PURCHASES_TABS = [
  { label: "Suppliers", href: "/app/purchases/suppliers", permissions: ["supplier.view"] },
] as const;

export const INVENTORY_TABS = [
  {
    label: "Products",
    href: "/app/inventory/products",
    permissions: ["product.view", "category.manage", "unit.manage", "product.price.view"],
  },
] as const;
