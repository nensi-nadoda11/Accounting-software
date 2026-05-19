import { Shield, History, Database, RotateCcw } from "lucide-react";

import { cn } from "../../../lib/utils";

export type SecurityAdminTabKey = "audit" | "login" | "backups" | "restore";

const TAB_META: Array<{ key: SecurityAdminTabKey; label: string; icon: typeof Shield }> = [
  { key: "audit", label: "Audit Logs", icon: Shield },
  { key: "login", label: "Login Logs", icon: History },
  { key: "backups", label: "Backups", icon: Database },
  { key: "restore", label: "Restore Logs", icon: RotateCcw }
];

export const SecurityTabs = ({
  value,
  onChange,
  visibleTabs
}: {
  value: SecurityAdminTabKey;
  onChange: (value: SecurityAdminTabKey) => void;
  visibleTabs: SecurityAdminTabKey[];
}) => (
  <div className="flex flex-wrap gap-2">
    {TAB_META.filter((tab) => visibleTabs.includes(tab.key)).map((tab) => {
      const Icon = tab.icon;
      const active = value === tab.key;

      return (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition",
            active
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <Icon className="size-4" />
          {tab.label}
        </button>
      );
    })}
  </div>
);
