import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import { InlineErrorState } from "../../../components/ui/InlineErrorState";
import { RefreshCw } from "lucide-react";

export const SystemPolishPanel = () => (
  <div className="grid gap-4 xl:grid-cols-2">
    <Card>
      <CardHeader title="Shared State Standards" />
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {[
          "LoadingState",
          "EmptyState",
          "ErrorState",
          "ConfirmDialog",
          "StatusBadge",
          "TableActionIconButton",
          "Responsive tables",
          "Session expiry handling",
        ].map((item) => (
          <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            {item}
          </div>
        ))}
      </CardContent>
    </Card>
    <Card>
      <CardHeader title="Live Examples" />
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status="active" label="Active" />
          <StatusBadge status="pending" label="Pending" />
          <StatusBadge status="inactive" label="Inactive" />
          <TableActionIconButton label="Refresh" icon={<RefreshCw className="size-4" />} onClick={() => undefined} />
        </div>
        <InlineErrorState title="Session expired and permission-denied experiences now use consistent shared styling." />
        <div className="grid gap-4 md:grid-cols-2">
          <LoadingState label="Loading shared state..." />
          <EmptyState title="Empty state sample" />
        </div>
      </CardContent>
    </Card>
  </div>
);
