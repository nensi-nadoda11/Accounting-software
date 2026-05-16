import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export type TableAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
};

export const TableActionIcons = ({ actions }: { actions: TableAction[] }) => (
  <div className="flex items-center justify-end gap-1">
    {actions.map((action) => (
      <button
        key={action.label}
        type="button"
        title={action.label}
        aria-label={action.label}
        disabled={action.disabled}
        onClick={action.onClick}
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-lg border border-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40",
          action.tone === "danger" && "hover:bg-rose-50 hover:text-rose-700",
        )}
      >
        {action.icon}
      </button>
    ))}
  </div>
);
