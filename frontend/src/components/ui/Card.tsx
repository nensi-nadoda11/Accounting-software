import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/utils";

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("rounded-2xl border border-[#E5EAEA] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]", className)} {...props} />
);

export const CardHeader = ({ title, action }: { title: string; action?: ReactNode }) => (
  <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
    <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
    {action}
  </div>
);

export const CardContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-5 py-4", className)} {...props} />
);
