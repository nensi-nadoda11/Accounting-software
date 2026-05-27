import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export const Badge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) => (
  <span
    className={cn(
      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
      tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-600",
      tone === "success" && "app-feedback-success",
      tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
      tone === "danger" && "app-feedback-error",
      tone === "info" && "border-[var(--app-success-border)] bg-[var(--app-accent-subtle)] text-[var(--app-accent-strong)]",
    )}
  >
    {children}
  </span>
);
