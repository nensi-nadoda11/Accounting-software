import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export const FormField = ({
  label,
  htmlFor,
  error,
  required,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex w-full flex-col gap-2", className)}>
    {label ? (
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
    ) : null}
    {children}
    {error ? <span className="text-xs text-rose-600">{error}</span> : null}
  </div>
);
