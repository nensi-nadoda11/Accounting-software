import { cn } from "../../../lib/utils";
import type { ReportsTabId } from "../../../types/report";

export type ReportsTabOption = {
  id: ReportsTabId;
  label: string;
};

export const ReportsTabs = ({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: ReportsTabOption[];
  activeTab: ReportsTabId;
  onChange: (tab: ReportsTabId) => void;
}) => (
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
    <div className="flex min-w-max gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-medium transition",
            activeTab === tab.id ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);
