import { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { getNestedSidebarConfigForPathname } from "../../constants/navigation";
import { useAuth } from "../../providers/useAuth";
import { applyUiPreferencesToDocument, settingsApi } from "../../services/settingsApi";
import { NestedRouteSidebar } from "./NestedRouteSidebar";
import { SubTabs } from "./SubTabs";
import { TopNav } from "./TopNav";

export const AppLayout = () => {
  const location = useLocation();
  const { hasPermission, user } = useAuth();
  const nestedSidebarConfig = useMemo(
    () => getNestedSidebarConfigForPathname(location.pathname),
    [location.pathname],
  );
  const visibleSidebarTabs = useMemo(
    () =>
      nestedSidebarConfig?.tabs.filter((tab) =>
        tab.permissions ? hasPermission(Array.from(tab.permissions)) : true,
      ) ?? [],
    [hasPermission, nestedSidebarConfig],
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const showSubTabs =
    !(nestedSidebarConfig && visibleSidebarTabs.length) &&
    (location.pathname.startsWith("/app/settings") ||
      location.pathname.startsWith("/app/accounting") ||
      location.pathname.startsWith("/app/sales") ||
      location.pathname.startsWith("/app/purchases") ||
      location.pathname.startsWith("/app/inventory") ||
      location.pathname.startsWith("/app/hr-payroll"));

  useEffect(() => {
    if (nestedSidebarConfig) {
      setSidebarOpen(true);
    }
  }, [nestedSidebarConfig?.title]);

  useEffect(() => {
    if (!user) {
      applyUiPreferencesToDocument(null);
      return;
    }

    let active = true;

    void settingsApi
      .getUiPreferences()
      .then((response) => {
        if (active) {
          applyUiPreferencesToDocument(response.data);
        }
      })
      .catch(() => {
        if (active) {
          applyUiPreferencesToDocument(null);
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-[#F7FAFA]">
      <TopNav />
      {showSubTabs ? <SubTabs /> : null}
      <div
        className={
          nestedSidebarConfig && visibleSidebarTabs.length
            ? "max-w-none py-4 pr-4 sm:pr-6 lg:pr-8"
            : "mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
        }
      >
        <div className={nestedSidebarConfig ? "flex flex-col gap-2 lg:flex-row lg:items-start" : undefined}>
          {nestedSidebarConfig && visibleSidebarTabs.length ? (
            <NestedRouteSidebar
              title={nestedSidebarConfig.title}
              currentPath={`${location.pathname}${location.search}`}
              tabs={visibleSidebarTabs}
              open={sidebarOpen}
              onToggle={() => setSidebarOpen((current) => !current)}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

