import { Badge } from "./Badge";

const statusToneMap = {
  active: "success",
  inactive: "neutral",
  blocked: "danger",
  deleted: "danger",
  locked: "warning",
  default: "info",
  completed: "success",
  pending: "warning",
  suspended: "danger",
  disabled: "danger",
  invited: "info",
} as const;

export const StatusBadge = ({
  status,
  label,
}: {
  status: string;
  label?: string;
}) => <Badge tone={statusToneMap[status as keyof typeof statusToneMap] ?? statusToneMap.default}>{label ?? status}</Badge>;
