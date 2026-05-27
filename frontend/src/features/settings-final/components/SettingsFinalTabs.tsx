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
  <div className="app-topbar">
    <div className="overflow-x-auto px-4 sm:px-5">
      <div className="flex min-w-max items-center gap-8">
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={cn(
                "relative shrink-0 whitespace-nowrap pb-3 pt-4 text-[13px] font-medium transition lg:text-sm",
                active ? "app-shell-text" : "app-shell-muted hover:text-[var(--app-shell-text)]",
              )}
            >
              {tab.label}
              {active ? <span className="app-accent-bg absolute inset-x-0 bottom-0 h-0.5 rounded-full" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);
