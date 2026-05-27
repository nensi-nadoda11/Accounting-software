import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";

export const ErrorState = ({
  title,
  action,
  className,
}: {
  title: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "app-feedback-error flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border px-6 text-center",
      className,
    )}
  >
    <div className="flex size-12 items-center justify-center rounded-2xl bg-white/55">
      <CircleAlert className="app-feedback-error-icon size-6" />
    </div>
    <p className="max-w-md text-sm font-medium">{title}</p>
    {action}
  </div>
);
