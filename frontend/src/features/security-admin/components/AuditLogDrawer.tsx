import { format } from "date-fns";

import { SideSheet } from "../../../components/ui/SideSheet";
import type { AuditLog } from "../../../types/securityAdmin";

const JsonPanel = ({ title, value }: { title: string; value: Record<string, unknown> | null }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50">
    <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">{title}</div>
    <pre className="overflow-x-auto px-4 py-3 text-xs text-slate-700">{JSON.stringify(value ?? {}, null, 2)}</pre>
  </div>
);

export const AuditLogDrawer = ({
  log,
  open,
  onClose
}: {
  log: AuditLog | null;
  open: boolean;
  onClose: () => void;
}) => (
  <SideSheet open={open} onClose={onClose} title="Audit Log Details">
    {log ? (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">User</p>
            <p className="mt-2 text-sm text-slate-900">{log.userName}</p>
            <p className="mt-1 text-sm text-slate-500">{log.userRole ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Request</p>
            <p className="mt-2 text-sm text-slate-900">{log.requestMethod ?? "-"} {log.requestPath ?? ""}</p>
            <p className="mt-1 text-sm text-slate-500">{log.ipAddress ?? "-"} • {log.userAgent ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action</p>
            <p className="mt-2 text-sm text-slate-900">{log.action}</p>
            <p className="mt-1 text-sm text-slate-500">{log.module}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timestamps</p>
            <p className="mt-2 text-sm text-slate-900">{format(new Date(log.createdAt), "dd MMM yyyy, hh:mm:ss a")}</p>
          </div>
        </div>

        <JsonPanel title="Old Values" value={log.oldValues} />
        <JsonPanel title="New Values" value={log.newValues} />
        <JsonPanel title="Metadata" value={log.metadata} />
      </div>
    ) : null}
  </SideSheet>
);
