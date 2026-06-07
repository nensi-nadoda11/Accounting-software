import { Badge } from "../../../components/ui/Badge";
import type { CashVerificationRecordStatus, CashVerificationStatus } from "../../../types/cashVerification";

const CASH_STATUS_LABELS: Record<CashVerificationStatus, string> = {
  matched: "Matched",
  short_cash: "Short Cash",
  excess_cash: "Excess Cash",
};

const RECORD_STATUS_LABELS: Record<CashVerificationRecordStatus, string> = {
  draft: "Draft",
  completed: "Completed",
  approved: "Approved",
  cancelled: "Cancelled",
};

export const StatusBadge = ({ status }: { status: CashVerificationStatus | CashVerificationRecordStatus }) => {
  const tone =
    status === "matched" || status === "approved"
      ? "success"
      : status === "short_cash" || status === "cancelled"
        ? "danger"
        : status === "excess_cash" || status === "completed"
          ? "warning"
          : "neutral";

  const label =
    status in CASH_STATUS_LABELS
      ? CASH_STATUS_LABELS[status as CashVerificationStatus]
      : RECORD_STATUS_LABELS[status as CashVerificationRecordStatus];

  return <Badge tone={tone}>{label}</Badge>;
};
