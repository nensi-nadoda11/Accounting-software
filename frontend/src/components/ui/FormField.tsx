import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export const FormField = ({
  label,
  htmlFor,
  error,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex w-full flex-col gap-2", className)}>
    {label ? (
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
    ) : null}
    {children}
    {error ? <span className="text-xs text-rose-600">{error}</span> : null}
  </div>
);
