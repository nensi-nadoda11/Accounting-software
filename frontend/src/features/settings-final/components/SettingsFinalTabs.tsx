import { cn } from "../../../lib/utils";
import type { SettingsTabKey } from "../settingsFinalSchemas";

export const SettingsFinalTabs = ({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ key: SettingsTabKey; label: string }>;
  activeTab: SettingsTabKey;
  onChange: (tab: SettingsTabKey) => void;
}) => (
  <div className="border-b border-slate-200 bg-white/90">
    <div className="flex justify-between gap-3 overflow-hidden px-3">
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "relative whitespace-nowrap pb-3 pt-4 text-[13px] font-medium transition lg:text-sm",
              active ? "text-slate-900" : "text-slate-500 hover:text-slate-900",
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
