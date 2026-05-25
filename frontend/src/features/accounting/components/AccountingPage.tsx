import type { ReactNode } from "react";

import { AccountingTabs, type AccountingTabOption } from "./AccountingTabs";

export const AccountingPage = <TTab extends string>({
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
}: {
  tabs: AccountingTabOption<TTab>[];
  activeTab: TTab;
  onTabChange: (tab: TTab) => void;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <div>
    <AccountingTabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
    {actions}
    {children}
  </div>
);
