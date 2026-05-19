import { forwardRef, type ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";

import { cn } from "../../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", loading = false, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "app-control-height app-focus-ring inline-flex items-center justify-center rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "app-accent-surface text-white",
        variant === "secondary" && "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        variant === "ghost" && "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
        variant === "danger" && "border-rose-600 bg-rose-600 text-white hover:bg-rose-700",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
