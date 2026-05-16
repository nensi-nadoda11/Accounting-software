import { cn } from "../../lib/utils";

export const ToggleSwitch = ({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-slate-200",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white transition",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  </div>
);
