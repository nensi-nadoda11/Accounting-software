import { cn } from "../../../lib/utils";

export type NotificationTabId =
  | "all"
  | "unread"
  | "payment"
  | "inventory"
  | "gst"
  | "payroll"
  | "templates"
  | "preferences"
  | "logs";

const TABS: Array<{ id: NotificationTabId; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "payment", label: "Payment" },
  { id: "inventory", label: "Inventory" },
  { id: "gst", label: "GST" },
  { id: "payroll", label: "Payroll" },
  { id: "templates", label: "Templates" },
  { id: "preferences", label: "Preferences" },
  { id: "logs", label: "Logs" },
];

export const NotificationTabs = ({
  activeTab,
  onChange,
}: {
  activeTab: NotificationTabId;
  onChange: (tab: NotificationTabId) => void;
}) => (
  <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
    {TABS.map((tab) => (
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
