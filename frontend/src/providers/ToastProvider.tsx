import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

import { cn } from "../lib/utils";

type Toast = {
  id: number;
  title: string;
  tone: "success" | "error";
};

type ToastContextValue = {
  success: (title: string) => void;
  error: (title: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

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
              "pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm",
              toast.tone === "success" ? "border-emerald-200" : "border-rose-200",
            )}
          >
            {toast.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 text-emerald-600" />
            ) : (
              <CircleAlert className="mt-0.5 size-5 text-rose-600" />
            )}
            <p className="flex-1 text-sm font-medium text-slate-700">{toast.title}</p>
            <button
              type="button"
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
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

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
};
