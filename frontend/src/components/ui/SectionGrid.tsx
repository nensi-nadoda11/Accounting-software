import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export const SectionGrid = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)} {...props} />
);
