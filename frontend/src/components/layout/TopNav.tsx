import { Link, useLocation } from "react-router-dom";

import { TOP_NAV_ITEMS } from "../../constants/navigation";
import { cn } from "../../lib/utils";

export const TopNav = () => {
  const location = useLocation();
  const activeMenu = location.pathname.startsWith("/app/settings")
    ? "settings"
    : new URLSearchParams(location.search).get("menu") || "dashboard";

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/app" className="mr-4 whitespace-nowrap text-lg font-semibold text-slate-900">
          LedgerFlow
        </Link>
        <nav className="flex flex-1 overflow-x-auto">
          {TOP_NAV_ITEMS.map((item) => (
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
                <span className="absolute inset-x-0 -bottom-3 h-0.5 rounded-full bg-emerald-600" />
              ) : null}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};
