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
    <div className="app-topbar">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3 sm:px-6 lg:px-8">
        <Link to={homeHref} className="app-shell-text mr-4 whitespace-nowrap text-lg font-semibold">
          {auth.company?.name ?? "LedgerFlow"}
        </Link>
        <nav className="flex flex-1 justify-center">
          {navItems.map((item) => (
            <Link
              key={item.menu}
              to={item.href}
              className={cn(
                "app-shell-muted relative mr-6 whitespace-nowrap pb-2 pt-1 text-sm font-medium transition hover:text-[var(--app-shell-text)]",
                activeMenu === item.menu && "app-shell-text",
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
                className="app-shell-surface app-shell-muted flex size-10 items-center justify-center rounded-full border transition hover:bg-[var(--app-accent-subtle)] hover:text-[var(--app-shell-text)]"
                aria-label="Open profile menu"
              >
                <UserRound className="size-5" />
              </button>
              {profileOpen ? (
                <div className="app-shell-surface absolute right-0 top-14 z-40 w-72 rounded-2xl border p-4 shadow-xl">
                  <div className="border-b border-[var(--app-shell-border)] pb-3">
                    <p className="app-shell-text text-sm font-semibold">{auth.user.fullName}</p>
                    <p className="app-shell-muted mt-1 break-all text-sm">{auth.user.email}</p>
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
