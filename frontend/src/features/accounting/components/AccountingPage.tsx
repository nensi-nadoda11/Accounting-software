import type { ReactNode } from "react";

import { PageHeader } from "../../../components/ui/PageHeader";
import { AccountingTabs, type AccountingTabOption } from "./AccountingTabs";

export const AccountingPage = <TTab extends string>({
  title,
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
}: {
  title: string;
  tabs: AccountingTabOption<TTab>[];
  activeTab: TTab;
  onTabChange: (tab: TTab) => void;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <div className="space-y-4">
    <PageHeader title={title} actions={actions} />
    <AccountingTabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
    {children}
  </div>
);
