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
};

export const DashboardQuickActions = ({ actions }: Props) => (
  <Card className="flex h-full flex-col">
    <CardHeader title="Quick Actions" />
    <CardContent className="grid flex-1 grid-cols-2 gap-3 p-4">
      {actions.map((action) => {
        const Icon = iconMap[action.icon as keyof typeof iconMap] ?? ReceiptText;

        return (
          <Link
            key={action.id}
            to={action.href}
            className="group rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-[var(--app-accent)] hover:bg-white"
          >
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-white text-[var(--app-accent)] shadow-sm">
              <Icon className="size-4" />
            </div>
            <p className="text-sm font-semibold text-slate-900">{action.label}</p>
          </Link>
        );
      })}
    </CardContent>
  </Card>
);
