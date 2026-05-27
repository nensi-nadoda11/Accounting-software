import { useCallback, useMemo, useState, type PropsWithChildren } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

import { cn } from "../lib/utils";
import { ToastContext, type ToastContextValue } from "./toast-context";

type Toast = {
  id: number;
  title: string;
  tone: "success" | "error";
};

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((title: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((current) => {
      if (current.some((toast) => toast.title === title && toast.tone === tone)) {
        return current;
      }

      return [...current, { id, title, tone }];
    });
    window.setTimeout(() => removeToast(id), 3600);
  }, [removeToast]);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (title) => push(title, "success"),
      error: (title) => push(title, "error"),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-sm backdrop-blur-sm",
              toast.tone === "success" ? "app-feedback-success" : "app-feedback-error",
            )}
          >
            {toast.tone === "success" ? (
              <CheckCircle2 className="app-feedback-success-icon mt-0.5 size-5" />
            ) : (
              <CircleAlert className="app-feedback-error-icon mt-0.5 size-5" />
            )}
            <p className="flex-1 text-sm font-medium">{toast.title}</p>
            <button
              type="button"
              className="rounded-full p-1 text-current/60 transition hover:bg-black/5 hover:text-current"
              onClick={() => removeToast(toast.id)}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
