import { StatusBadge as SharedStatusBadge } from "../../../components/ui/StatusBadge";

const labelMap: Record<string, string> = {
  passed: "Passed",
  issues_found: "Issues Found",
  needs_review: "Needs Review",
  draft: "Draft",
  completed: "Completed",
  approved: "Approved",
  cancelled: "Cancelled",
  critical: "Critical",
};

export const StatusBadge = ({ status }: { status: string }) => <SharedStatusBadge status={status} label={labelMap[status] ?? status} />;
