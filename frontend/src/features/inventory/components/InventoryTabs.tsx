import { cn } from "../../../lib/utils";
import type { InventoryTabId } from "../inventoryUtils";

export const InventoryTabs = ({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ id: InventoryTabId; label: string }>;
  activeTab: InventoryTabId;
  onChange: (tab: InventoryTabId) => void;
}) => (
  <div className="flex gap-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white px-3 sm:px-4">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        onClick={() => onChange(tab.id)}
        className={cn(
          "relative whitespace-nowrap pb-3 pt-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
          activeTab === tab.id ? "text-slate-900" : "text-slate-500 hover:text-slate-800",
        )}
      >
        {tab.label}
        {activeTab === tab.id ? <span className="app-accent-bg absolute inset-x-0 bottom-0 h-0.5 rounded-full" /> : null}
      </button>
    ))}
  </div>
);
