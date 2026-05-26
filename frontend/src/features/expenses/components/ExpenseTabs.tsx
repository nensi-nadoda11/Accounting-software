import { cn } from "../../../lib/utils";

export const ExpenseTabs = <TTab extends string,>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ id: TTab; label: string }>;
  activeTab: TTab;
  onChange: (tab: TTab) => void;
}) => (
  <div className="overflow-x-auto border-b border-slate-200 bg-white/90">
    <div className="flex min-w-max gap-6 px-4 sm:px-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative whitespace-nowrap pb-3 pt-4 text-sm font-medium transition",
            activeTab === tab.id ? "text-slate-900" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {tab.label}
          {activeTab === tab.id ? <span className="app-accent-bg absolute inset-x-0 bottom-0 h-0.5 rounded-full" /> : null}
        </button>
      ))}
    </div>
  </div>
);
