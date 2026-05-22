import { Link, useLocation } from "react-router-dom";

import { ACCOUNTING_TABS, HR_PAYROLL_TABS, INVENTORY_TABS, PURCHASES_TABS, SALES_TABS, SETTINGS_TABS } from "../../constants/navigation";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/useAuth";

export const SubTabs = () => {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const wrapTabs = location.pathname.startsWith("/app/settings");

  const sourceTabs = location.pathname.startsWith("/app/sales")
    ? SALES_TABS
    : location.pathname.startsWith("/app/purchases")
    ? PURCHASES_TABS
    : location.pathname.startsWith("/app/inventory")
      ? INVENTORY_TABS
      : location.pathname.startsWith("/app/hr-payroll")
        ? HR_PAYROLL_TABS
      : location.pathname.startsWith("/app/accounting")
        ? ACCOUNTING_TABS
      : SETTINGS_TABS;

  const tabs = sourceTabs.filter((tab) =>
    "permissions" in tab ? hasPermission(Array.from(tab.permissions)) : true,
  );

  if (!tabs.length) {
    return null;
  }

  return (
    <div className="border-b border-slate-200 bg-white/90">
      <div
        className={cn(
          "mx-auto flex max-w-7xl px-4 sm:px-6 lg:px-8",
          wrapTabs ? "justify-between gap-3 overflow-hidden" : "gap-5 overflow-x-auto",
        )}
      >
        {tabs.map((tab) => {
          const active = location.pathname === tab.href;
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                "relative whitespace-nowrap font-medium transition",
                wrapTabs
                  ? active
                    ? "pb-3 pt-4 text-[13px] text-slate-900 lg:text-sm"
                    : "pb-3 pt-4 text-[13px] text-slate-500 hover:text-slate-800 lg:text-sm"
                  : active
                    ? "pb-3 pt-4 text-slate-900"
                    : "pb-3 pt-4 text-slate-500 hover:text-slate-800",
              )}
            >
              {tab.label}
              {active ? <span className="app-accent-bg absolute inset-x-0 bottom-0 h-0.5 rounded-full" /> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

