import { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, children, required, ...props }, ref) => (
    <label className="flex w-full flex-col gap-2">
      {label ? (
        <span className="text-sm font-medium text-slate-700">
          {label}
          {required ? <span className="ml-1 text-rose-500">*</span> : null}
        </span>
      ) : null}
      <select
        ref={ref}
        required={required}
        className={cn(
          "app-control-height app-input-focus rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition",
          error && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  ),
);

Select.displayName = "Select";
