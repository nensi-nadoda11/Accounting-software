import { cn } from "../../lib/utils";
import { formatInr } from "../../features/customers/customerUtils";

export const AmountText = ({
  value,
  className,
  tone = "default",
}: {
  value: string | number | null | undefined;
  className?: string;
  tone?: "default" | "success" | "danger" | "warning";
}) => {
  const numericValue = Number(value ?? 0);
  const resolvedTone =
    tone === "default" ? (numericValue < 0 ? "danger" : numericValue > 0 ? "success" : "default") : tone;

  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        resolvedTone === "default" && "text-slate-900",
        resolvedTone === "success" && "text-emerald-700",
        resolvedTone === "danger" && "text-rose-700",
        resolvedTone === "warning" && "text-amber-700",
        className,
      )}
    >
      {formatInr(numericValue)}
    </span>
  );
};
