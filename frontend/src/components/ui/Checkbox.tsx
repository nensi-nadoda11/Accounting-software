import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
};

export const Checkbox = ({ label, description, className, ...props }: CheckboxProps) => (
  <label className="flex cursor-pointer items-start gap-3">
    <input
      type="checkbox"
      className={cn(
        "mt-1 size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500",
        className,
      )}
      {...props}
    />
    <span className="space-y-1">
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {description ? <span className="block text-xs text-slate-500">{description}</span> : null}
    </span>
  </label>
);
