import { Link, useLocation } from "react-router-dom";

import { NotificationBell } from "../../features/notifications/NotificationBell";
import { getAccessibleTopNavItems, getDefaultAppHref } from "../../constants/navigation";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/useAuth";

export const TopNav = () => {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const section = location.pathname.replace(/^\/app\/?/, "").split("/")[0];
  const navItems = getAccessibleTopNavItems(hasPermission);
  const homeHref = getDefaultAppHref(hasPermission);
  const activeMenu = location.pathname.startsWith("/app/settings")
    ? "settings"
    : section || new URLSearchParams(location.search).get("menu") || "dashboard";

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <Link to={homeHref} className="mr-4 whitespace-nowrap text-lg font-semibold text-slate-900">
          LedgerFlow
        </Link>
        <nav className="flex flex-1 overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.menu}
              to={item.href}
              className={cn(
                "relative mr-6 whitespace-nowrap pb-2 pt-1 text-sm font-medium text-slate-500 transition hover:text-slate-800",
                activeMenu === item.menu && "text-slate-900",
              )}
            >
              {item.label}
              {activeMenu === item.menu ? (
                <span className="app-accent-bg absolute inset-x-0 -bottom-3 h-0.5 rounded-full" />
              ) : null}
            </Link>
          ))}
        </nav>
        <NotificationBell />
      </div>
    </div>
  );
};
