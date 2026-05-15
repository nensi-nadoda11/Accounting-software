import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export const Badge = ({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) => (
  <span
    className={cn(
      "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
      tone === "neutral" && "border-slate-200 bg-slate-50 text-slate-600",
      tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
      tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700",
      tone === "danger" && "border-rose-200 bg-rose-50 text-rose-700",
      tone === "info" && "border-cyan-200 bg-cyan-50 text-cyan-700",
    )}
  >
    {children}
  </span>
);
