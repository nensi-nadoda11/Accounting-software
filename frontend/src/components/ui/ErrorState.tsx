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
      "flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-rose-200 bg-white px-6 text-center",
      className,
    )}
  >
    <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
      <CircleAlert className="size-6" />
    </div>
    <p className="max-w-md text-sm font-medium text-slate-700">{title}</p>
    {action}
  </div>
);
