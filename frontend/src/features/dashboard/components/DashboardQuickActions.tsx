import {
  HandCoins,
  Landmark,
  PackagePlus,
  ReceiptText,
  ShoppingCart,
  UserPlus,
  Wallet
} from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { cn } from "../../../lib/utils";
import type { DashboardQuickAction } from "../../../types/dashboard";

const iconMap = {
  "receipt-text": ReceiptText,
  "shopping-cart": ShoppingCart,
  wallet: Wallet,
  "hand-coins": HandCoins,
  landmark: Landmark,
  "user-plus": UserPlus,
  "package-plus": PackagePlus
} as const;

type Props = {
  actions: DashboardQuickAction[];
  className?: string;
  compact?: boolean;
};

export const DashboardQuickActions = ({ actions, className, compact = false }: Props) => (
  <Card className={cn("flex h-full min-h-0 flex-col", className)}>
    <CardHeader title="Quick Actions" />
    <CardContent className={cn("grid flex-1 min-h-0 content-start grid-cols-2 overflow-y-auto p-4", compact ? "gap-2 p-3" : "gap-3")}>
      {actions.map((action) => {
        const Icon = iconMap[action.icon as keyof typeof iconMap] ?? ReceiptText;

        return (
          <Link
            key={action.id}
            to={action.href}
            className={cn(
              "group rounded-2xl border border-slate-200 bg-slate-50 transition hover:border-[var(--app-accent)] hover:bg-white",
              compact ? "p-2.5" : "p-3"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-xl bg-white text-[var(--app-accent)] shadow-sm",
                compact ? "mb-2 size-8" : "mb-3 size-10"
              )}
            >
              <Icon className={compact ? "size-3.5" : "size-4"} />
            </div>
            <p className={cn("font-semibold text-slate-900", compact ? "text-xs leading-4" : "text-sm")}>{action.label}</p>
          </Link>
        );
      })}
    </CardContent>
  </Card>
);
