import { Badge } from "../../../components/ui/Badge";
import type { StockCheckItemStatus, StockCheckStatus } from "../../../types/stockCheck";

const STOCK_CHECK_STATUS_LABELS: Record<StockCheckStatus, string> = {
  draft: "Draft",
  completed: "Completed",
  approved: "Approved",
  cancelled: "Cancelled",
};

const ITEM_STATUS_LABELS: Record<StockCheckItemStatus, string> = {
  matched: "Matched",
  short: "Short",
  excess: "Excess",
};

export const StatusBadge = ({ status }: { status: StockCheckStatus | StockCheckItemStatus }) => {
  const tone =
    status === "approved" || status === "matched"
      ? "success"
      : status === "short" || status === "cancelled"
        ? "danger"
        : status === "excess" || status === "completed"
          ? "warning"
          : "neutral";

  return <Badge tone={tone}>{status in STOCK_CHECK_STATUS_LABELS ? STOCK_CHECK_STATUS_LABELS[status as StockCheckStatus] : ITEM_STATUS_LABELS[status as StockCheckItemStatus]}</Badge>;
};
