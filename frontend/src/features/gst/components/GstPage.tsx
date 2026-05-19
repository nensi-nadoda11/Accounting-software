import type { ReactNode } from "react";

import { PageHeader } from "../../../components/ui/PageHeader";
import { GstTabs, type GstTabOption } from "./GstTabs";

export const GstPage = <TTab extends string>({
  title,
  tabs,
  activeTab,
  onTabChange,
  actions,
  children,
}: {
  title: string;
  tabs: GstTabOption<TTab>[];
  activeTab: TTab;
  onTabChange: (tab: TTab) => void;
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <div className="space-y-4">
    <PageHeader title={title} actions={actions} />
    <GstTabs tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
    {children}
  </div>
);
