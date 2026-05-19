import { CalendarRange } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";
import type { DashboardFilters as DashboardFiltersValue, DashboardRange } from "../../../types/dashboard";

const RANGE_OPTIONS: Array<{ label: string; value: DashboardRange }> = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Custom", value: "custom" }
];

type Props = {
  value: DashboardFiltersValue;
  pending?: boolean;
  onChange: (next: DashboardFiltersValue) => void;
  onApply: () => void;
};

export const DashboardFilters = ({ value, pending = false, onChange, onApply }: Props) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-wrap gap-2">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange({ ...value, range: option.value })}
          className={cn(
            "rounded-xl border px-3 py-2 text-sm font-medium transition",
            value.range === option.value
              ? "app-accent-surface text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {value.range === "custom" ? (
        <>
          <input
            type="date"
            value={value.dateFrom ?? ""}
            onChange={(event) => onChange({ ...value, dateFrom: event.target.value })}
            className="app-input-focus rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none"
          />
          <input
            type="date"
            value={value.dateTo ?? ""}
            onChange={(event) => onChange({ ...value, dateTo: event.target.value })}
            className="app-input-focus rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none"
          />
        </>
      ) : null}
      <Button variant="secondary" onClick={onApply} loading={pending}>
        <CalendarRange className="mr-2 size-4" />
        Refresh
      </Button>
    </div>
  </div>
);
