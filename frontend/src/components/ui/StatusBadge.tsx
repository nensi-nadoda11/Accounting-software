import { Badge } from "./Badge";

const statusToneMap = {
  active: "success",
  inactive: "neutral",
  locked: "warning",
  default: "info",
  completed: "success",
  pending: "warning",
} as const;

export const StatusBadge = ({
  status,
  label,
}: {
  status: keyof typeof statusToneMap;
  label?: string;
}) => <Badge tone={statusToneMap[status]}>{label ?? status}</Badge>;
