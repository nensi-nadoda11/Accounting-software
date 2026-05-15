import { Link, useLocation } from "react-router-dom";

import { SETTINGS_TABS } from "../../constants/navigation";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/AuthProvider";

export const SubTabs = () => {
  const location = useLocation();
  const { hasPermission } = useAuth();

  const tabs = SETTINGS_TABS.filter((tab) => {
    if (tab.href.includes("users") || tab.href.includes("invites") || tab.href.includes("roles-permissions")) {
      return hasPermission(["user.view", "user.manage"]);
    }
    return true;
  });

  return (
    <div className="border-b border-slate-200 bg-white/90">
      <div className="mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {tabs.map((tab) => {
          const active = location.pathname === tab.href;
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                "relative whitespace-nowrap pb-3 pt-4 text-sm font-medium text-slate-500 transition hover:text-slate-800",
                active && "text-slate-900",
              )}
            >
              {tab.label}
              {active ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-emerald-600" /> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
};
