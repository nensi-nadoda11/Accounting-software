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
}) => {
  return (
    <div className="border-b border-slate-200 bg-white/90">
      <div className="flex gap-5 overflow-x-auto px-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative whitespace-nowrap pb-3 pt-4 font-medium transition text-[13px] lg:text-sm",
                active
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              {tab.label}
              {active ? <span className="app-accent-bg absolute inset-x-0 bottom-0 h-0.5 rounded-full" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};
