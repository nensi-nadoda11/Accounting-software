import type { ReactNode } from "react";

import { Card, CardContent } from "../../../components/ui/Card";
import { cn } from "../../../lib/utils";

export const GstFilters = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <Card>
    <CardContent className={cn("grid gap-2 md:grid-cols-2 xl:grid-cols-6", className)}>{children}</CardContent>
  </Card>
);
