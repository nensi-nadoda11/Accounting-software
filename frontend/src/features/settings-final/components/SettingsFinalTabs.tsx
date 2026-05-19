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
  <div className="overflow-x-auto">
    <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2">
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition",
              active ? "app-accent-surface text-white" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  </div>
);
