import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";
import { cn } from "../../lib/utils";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { notificationsApi } from "../../services/notificationsApi";
import type { Notification } from "../../types/notification";
import {
  formatNotificationDateTime,
  NOTIFICATIONS_UPDATED_EVENT,
  notificationTypeIcons,
} from "./notificationMeta";

export const NotificationBell = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const canView = auth.isAuthenticated && auth.hasPermission("notifications.view");

  const loadBell = async () => {
    if (!canView) {
      return;
    }

    try {
      const [countResponse, listResponse] = await Promise.all([
        notificationsApi.unreadCount(),
        notificationsApi.list({ page: 1, limit: 5, unread: true }),
      ]);

      setCount(countResponse.data.count);
      setItems(listResponse.data.items);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load notifications"));
    }
  };

  useEffect(() => {
    if (!canView) {
      return;
    }

    void loadBell();
    const interval = window.setInterval(() => {
      void loadBell();
    }, 60_000);

    const refresh = () => {
      void loadBell();
    };

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    };
  }, [canView]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  if (!canView) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={async () => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) {
            setLoading(true);
            await loadBell();
            setLoading(false);
          }
        }}
        className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <Bell className="size-5" />
        {count > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1.5 text-center text-[11px] font-semibold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-40 w-[360px] rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <Button
              variant="ghost"
              className="h-auto px-0 text-emerald-700"
              onClick={async () => {
                try {
                  await notificationsApi.markAllRead();
                  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
                  await loadBell();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Failed to mark notifications as read"));
                }
              }}
            >
              Mark all read
            </Button>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-3">
            {loading ? (
              <div className="py-12 text-center text-sm text-slate-500">Loading notifications...</div>
            ) : !items.length ? (
              <EmptyState title="No unread notifications" />
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const Icon = notificationTypeIcons[item.type];

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={async () => {
                        try {
                          await notificationsApi.markRead(item.id);
                        } catch {
                          // Keep the navigation responsive even if read sync fails.
                        } finally {
                          window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
                          setOpen(false);
                          navigate(item.actionUrl || "/app/system/notifications");
                        }
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition hover:bg-slate-50",
                        !item.isRead ? "border-emerald-100 bg-emerald-50/40" : "border-slate-100",
                      )}
                    >
                      <span className="rounded-xl bg-slate-100 p-2 text-slate-700">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{item.title}</span>
                        <span className="mt-1 block text-sm text-slate-600">{item.message}</span>
                        <span className="mt-2 block text-xs text-slate-400">{formatNotificationDateTime(item.createdAt)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 px-4 py-3">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setOpen(false);
                navigate("/app/system/notifications");
              }}
            >
              Open Notification Center
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

