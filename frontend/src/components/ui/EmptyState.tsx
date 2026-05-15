import type { ReactNode } from "react";

export const EmptyState = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
    <p className="text-sm font-medium text-slate-600">{title}</p>
    {action}
  </div>
);
