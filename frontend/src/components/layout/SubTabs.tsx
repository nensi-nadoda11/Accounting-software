import { Link, useLocation } from "react-router-dom";

import { getSubTabsForPathname } from "../../constants/navigation";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/useAuth";

export const SubTabs = () => {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const wrapTabs = location.pathname.startsWith("/app/settings");
  const sourceTabs = getSubTabsForPathname(location.pathname);

  const tabs = sourceTabs.filter((tab) => (tab.permissions ? hasPermission(Array.from(tab.permissions)) : true));

  if (!tabs.length) {
    return null;
  }

  return (
    <div className="app-topbar">
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
                    ? "app-shell-text pb-3 pt-4 text-[13px] lg:text-sm"
                    : "app-shell-muted pb-3 pt-4 text-[13px] hover:text-[var(--app-shell-text)] lg:text-sm"
                  : active
                    ? "app-shell-text pb-3 pt-4"
                    : "app-shell-muted pb-3 pt-4 hover:text-[var(--app-shell-text)]",
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

