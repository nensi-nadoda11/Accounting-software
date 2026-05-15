import type { ReactNode } from "react";

export const PageHeader = ({ title, actions }: { title: string; actions?: ReactNode }) => (
  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
    <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
    {actions}
  </div>
);
