import {
  Boxes,
  Building2,
  HandCoins,
  Landmark,
  PackageSearch,
  ReceiptIndianRupee,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Card } from "../../../components/ui/Card";
import { cn } from "../../../lib/utils";
import type { DashboardRange, DashboardSummary } from "../../../types/dashboard";

export type DashboardSummaryCardsVariant = "default" | "accountant" | "staff" | "auditor";

type SummaryCardConfig = {
  key: keyof DashboardSummary;
  label: string;
  icon: LucideIcon;
  tone: keyof typeof toneStyles;
  subKey: keyof DashboardSummary;
  subLabel: string;
};

type Props = {
  summary: DashboardSummary | null;
  range: DashboardRange;
  loading?: boolean;
  variant?: DashboardSummaryCardsVariant;
};

const getComparisonLabel = (range: DashboardRange) => {
  switch (range) {
    case "daily":
      return "Yesterday";
    case "weekly":
      return "Prev 7 Days";
    case "custom":
      return "Previous Period";
    case "monthly":
    default:
      return "Previous Month";
  }
};

const baseCards: SummaryCardConfig[] = [
  { key: "monthSales", label: "Sales", icon: TrendingUp, tone: "emerald", subKey: "todaySales", subLabel: "Today" },
  { key: "monthPurchase", label: "Purchase", icon: TrendingDown, tone: "amber", subKey: "todayPurchase", subLabel: "Today" },
  { key: "receivable", label: "Receivable", icon: HandCoins, tone: "sky", subKey: "payable", subLabel: "Payable" },
  { key: "netProfit", label: "Profit", icon: ReceiptIndianRupee, tone: "teal", subKey: "monthlyExpense", subLabel: "Expense" },
  { key: "gstPayable", label: "GST", icon: Building2, tone: "rose", subKey: "pendingSalary", subLabel: "Pending Salary" },
  { key: "payrollCost", label: "Payroll", icon: Landmark, tone: "violet", subKey: "bankBalance", subLabel: "Bank" },
  { key: "cashBalance", label: "Cash", icon: ReceiptIndianRupee, tone: "cyan", subKey: "totalSales", subLabel: "Total Sales" },
  { key: "totalProducts", label: "Inventory", icon: Boxes, tone: "slate", subKey: "lowStockCount", subLabel: "Low Stock" }
] as const;

const toneStyles: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  sky: "bg-sky-50 text-sky-700",
  teal: "bg-teal-50 text-teal-700",
  rose: "bg-rose-50 text-rose-700",
  violet: "bg-violet-50 text-violet-700",
  cyan: "bg-cyan-50 text-cyan-700",
  slate: "bg-slate-100 text-slate-700"
};

const cardPresets: Record<DashboardSummaryCardsVariant, SummaryCardConfig[]> = {
  default: baseCards,
  accountant: [
    baseCards[0],
    baseCards[1],
    baseCards[2],
    baseCards[3],
    baseCards[4],
    { key: "cashBalance", label: "Liquidity", icon: ReceiptIndianRupee, tone: "cyan", subKey: "bankBalance", subLabel: "Bank" }
  ],
  staff: [baseCards[0], baseCards[1], baseCards[7]],
  auditor: [baseCards[0], baseCards[1], baseCards[2], baseCards[3], baseCards[4], baseCards[5]]
};

export const DashboardSummaryCards = ({ summary, range, loading = false, variant = "default" }: Props) => {
  const comparisonLabel = getComparisonLabel(range);
  const cards = cardPresets[variant].map((card) =>
    card.key === "monthSales" || card.key === "monthPurchase"
      ? { ...card, subLabel: comparisonLabel }
      : card
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const primary = summary?.[card.key];
        const secondary = summary?.[card.subKey];

        return (
          <Card key={card.key} className="p-4">
            {loading || !summary ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-24 rounded bg-slate-100" />
                <div className="h-7 w-32 rounded bg-slate-100" />
                <div className="h-4 w-20 rounded bg-slate-100" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                  <div className={cn("flex size-9 items-center justify-center rounded-xl", toneStyles[card.tone])}>
                    <Icon className="size-4" />
                  </div>
                </div>
                <div>
                  {typeof primary === "number" ? (
                    <p className="text-2xl font-semibold text-slate-900">{primary}</p>
                  ) : (
                    <AmountText value={primary} className="text-2xl font-semibold text-slate-900" tone="default" />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{card.subLabel}</span>
                  {typeof secondary === "number" ? <span>{secondary}</span> : <AmountText value={secondary} className="text-xs" tone="default" />}
                </div>
                {card.key === "totalProducts" ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <PackageSearch className="size-3.5" />
                    <span>{summary.expiringCount} expiring</span>
                  </div>
                ) : null}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};
