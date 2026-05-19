import { cn } from "../../../lib/utils";

export type PayrollTabOption<TTab extends string> = {
  id: TTab;
  label: string;
};

export const PayrollTabs = <TTab extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: PayrollTabOption<TTab>[];
  activeTab: TTab;
  onChange: (tab: TTab) => void;
}) => (
  <div className="overflow-x-auto">
    <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-medium transition",
            activeTab === tab.id ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);
