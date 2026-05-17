import type { ReactNode } from "react";

import { PageHeader } from "../../../components/ui/PageHeader";

export const InventoryPage = ({
  title,
  actions,
  tabs,
  children,
}: {
  title: string;
  actions?: ReactNode;
  tabs: ReactNode;
  children: ReactNode;
}) => (
  <div className="space-y-4">
    <PageHeader title={title} actions={actions} />
    {tabs}
    {children}
  </div>
);
