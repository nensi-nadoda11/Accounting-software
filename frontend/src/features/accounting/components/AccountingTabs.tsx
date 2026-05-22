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
  const compactTabs = tabs.length >= 8;

  return (
    <div className="w-full overflow-hidden">
      <div
        className="grid w-full items-stretch gap-1 rounded-2xl border border-slate-200 bg-white p-2"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "min-w-0 whitespace-nowrap rounded-xl font-medium tracking-tight transition",
            compactTabs ? "min-h-10 px-2 py-2 text-[11px] sm:text-xs lg:text-[13px]" : "min-h-11 px-4 py-2 text-sm",
            activeTab === tab.id ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {tab.label}
        </button>
      ))}
      </div>
    </div>
  );
};
