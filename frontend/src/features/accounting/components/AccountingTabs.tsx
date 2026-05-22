import { cn } from "../../../lib/utils";

export type AccountingTabOption<TTab extends string> = {
  id: TTab;
  label: string;
};

export const AccountingTabs = <TTab extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: AccountingTabOption<TTab>[];
  activeTab: TTab;
  onChange: (tab: TTab) => void;
}) => (
  <div className="overflow-x-auto">
    <div className="flex min-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "min-h-11 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition",
            activeTab === tab.id ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);
