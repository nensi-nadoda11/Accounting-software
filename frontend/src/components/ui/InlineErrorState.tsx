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
      "app-feedback-error flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
      className,
    )}
  >
    <CircleAlert className="app-feedback-error-icon mt-0.5 size-5 shrink-0" />
    <p className="font-medium">{title}</p>
  </div>
);
