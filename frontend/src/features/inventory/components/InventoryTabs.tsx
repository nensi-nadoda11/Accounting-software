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
  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-2 py-2">
    <div className="flex min-w-max gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
            activeTab === tab.id ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);
