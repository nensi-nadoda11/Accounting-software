import { LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { NotificationBell } from "../../features/notifications/NotificationBell";
import { getAccessibleTopNavItems, getDefaultAppHref } from "../../constants/navigation";
import { cn } from "../../lib/utils";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { Button } from "../ui/Button";

export const TopNav = () => {
  const location = useLocation();
  const auth = useAuth();
  const toast = useToast();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const { hasPermission } = auth;
  const section = location.pathname.replace(/^\/app\/?/, "").split("/")[0];
  const navItems = getAccessibleTopNavItems(hasPermission);
  const homeHref = getDefaultAppHref(hasPermission);
  const activeMenu = location.pathname.startsWith("/app/settings")
    ? "settings"
    : section || new URLSearchParams(location.search).get("menu") || "dashboard";

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [profileOpen]);

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
        <div className="ml-auto flex items-center gap-3">
          <NotificationBell />
          {auth.user ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((current) => !current)}
                className="flex size-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Open profile menu"
              >
                <UserRound className="size-5" />
              </button>
              {profileOpen ? (
                <div className="absolute right-0 top-14 z-40 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="border-b border-slate-100 pb-3">
                    <p className="text-sm font-semibold text-slate-900">{auth.user.fullName}</p>
                    <p className="mt-1 break-all text-sm text-slate-500">{auth.user.email}</p>
                  </div>
                  <Button
                    variant="secondary"
                    className="mt-4 w-full"
                    onClick={async () => {
                      setProfileOpen(false);
                      await auth.logout();
                      toast.success("Logged out successfully");
                    }}
                  >
                    <LogOut className="mr-2 size-4" />
                    Logout
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
