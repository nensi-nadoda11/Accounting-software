export const TOP_NAV_ITEMS = [
  { label: "Dashboard", href: "/app?menu=dashboard", menu: "dashboard" },
  { label: "Accounting", href: "/app?menu=accounting", menu: "accounting" },
  { label: "Sales", href: "/app?menu=sales", menu: "sales" },
  { label: "Purchases", href: "/app?menu=purchases", menu: "purchases" },
  { label: "Inventory", href: "/app?menu=inventory", menu: "inventory" },
  { label: "Reports", href: "/app?menu=reports", menu: "reports" },
  { label: "Settings", href: "/app/settings/users", menu: "settings" },
] as const;

export const SETTINGS_TABS = [
  { label: "Users", href: "/app/settings/users" },
  { label: "Invites", href: "/app/settings/invites" },
  { label: "Roles & Permissions", href: "/app/settings/roles-permissions" },
  { label: "Profile", href: "/app/settings/profile" },
  { label: "Security", href: "/app/settings/security" },
] as const;
