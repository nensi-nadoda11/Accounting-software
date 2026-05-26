import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, required, onKeyDown, onWheel, type, ...props }, ref) => (
    <label className="flex w-full flex-col gap-2">
      {label ? (
        <span className="text-sm font-medium text-slate-700">
          {label}
          {required ? <span className="ml-1 text-rose-500">*</span> : null}
        </span>
      ) : null}
      <input
        ref={ref}
        id={id}
        type={type}
        className={cn(
          "app-control-height app-input-focus rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400",
          error && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10",
          className,
        )}
        required={required}
        onWheel={(event) => {
          if (type === "number") {
            event.preventDefault();
          }
          onWheel?.(event);
        }}
        onKeyDown={(event) => {
          if (type === "number" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
            event.preventDefault();
          }
          onKeyDown?.(event);
        }}
        {...props}
      />
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  ),
);

Input.displayName = "Input";
