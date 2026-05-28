import { LoaderCircle } from "lucide-react";

import { cn } from "../../lib/utils";

export const LoadingState = ({ label = "Loading...", className }: { label?: string; className?: string }) => (
  <div className={cn("flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white", className)}>
    <LoaderCircle className="app-accent-text size-6 animate-spin" />
    <p className="text-sm text-slate-500">{label}</p>
  </div>
);
