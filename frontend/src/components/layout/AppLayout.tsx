import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../providers/useAuth";
import { applyUiPreferencesToDocument, settingsApi } from "../../services/settingsApi";
import { SubTabs } from "./SubTabs";
import { TopNav } from "./TopNav";

export const AppLayout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const showSubTabs =
    location.pathname.startsWith("/app/settings") ||
    location.pathname.startsWith("/app/accounting") ||
    location.pathname.startsWith("/app/sales") ||
    location.pathname.startsWith("/app/purchases") ||
    location.pathname.startsWith("/app/inventory") ||
    location.pathname.startsWith("/app/hr-payroll");

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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </div>
    </div>
  );
};

