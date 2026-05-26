import { forwardRef, type TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/utils";
import { FormField } from "./FormField";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, rows = 4, required, ...props }, ref) => (
    <FormField label={label} htmlFor={id} error={error} required={required}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        className={cn(
          "app-input-focus min-h-[104px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400",
          error && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10",
          className,
        )}
        {...props}
      />
    </FormField>
  ),
);

Textarea.displayName = "Textarea";
