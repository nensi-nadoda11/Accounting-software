import { CircleAlert } from "lucide-react";

import { cn } from "../../lib/utils";

export const InlineErrorState = ({
  title,
  className,
}: {
  title: string;
  className?: string;
}) => (
  <div
    className={cn(
      "flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700",
      className,
    )}
  >
    <CircleAlert className="mt-0.5 size-5 shrink-0 text-rose-600" />
    <p className="font-medium">{title}</p>
  </div>
);
