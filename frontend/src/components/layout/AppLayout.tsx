import { LogOut } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";
import { Button } from "../ui/Button";
import { SubTabs } from "./SubTabs";
import { TopNav } from "./TopNav";

export const AppLayout = () => {
  const location = useLocation();
  const { logout, user } = useAuth();
  const toast = useToast();
  const showSubTabs = location.pathname.startsWith("/app/settings");

  return (
    <div className="min-h-screen bg-[#F7FAFA]">
      <TopNav />
      {showSubTabs ? <SubTabs /> : null}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">{user?.fullName}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
          <Button
            variant="secondary"
            onClick={async () => {
              await logout();
              toast.success("Logged out successfully");
            }}
          >
            <LogOut className="mr-2 size-4" />
            Logout
          </Button>
        </div>
        <Outlet />
      </div>
    </div>
  );
};
