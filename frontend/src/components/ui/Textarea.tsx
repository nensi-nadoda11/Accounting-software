import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/utils";
import { FormField } from "./FormField";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, rows = 4, ...props }, ref) => (
    <FormField label={label} htmlFor={id} error={error}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className={cn(
          "min-h-[104px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10",
          error && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10",
          className,
        )}
        {...props}
      />
    </FormField>
  ),
);

Textarea.displayName = "Textarea";
