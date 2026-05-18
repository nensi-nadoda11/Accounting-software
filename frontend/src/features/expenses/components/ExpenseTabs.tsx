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
  <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
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
);
