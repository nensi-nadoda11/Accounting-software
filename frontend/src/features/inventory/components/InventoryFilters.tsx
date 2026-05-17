import type { HTMLAttributes, ReactNode } from "react";

import { Card, CardContent } from "../../../components/ui/Card";
import { cn } from "../../../lib/utils";

export const InventoryFilters = ({
  children,
  actions,
  className,
}: HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
}) => (
  <Card>
    <CardContent className="space-y-3">
      <div className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>
      {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
    </CardContent>
  </Card>
);
