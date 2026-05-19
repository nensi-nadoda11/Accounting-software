import { Download, Eye } from "lucide-react";
import { format } from "date-fns";

import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { Select } from "../../../components/ui/Select";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { AuditFilters, AuditLog, PaginationMeta } from "../../../types/securityAdmin";

export const AuditLogsTable = ({
  filters,
  onFiltersChange,
  logs,
  pagination,
  loading,
  canExport,
  exporting,
  onExport,
  onOpen
}: {
  filters: AuditFilters;
  onFiltersChange: (value: Partial<AuditFilters>) => void;
  logs: AuditLog[];
  pagination: PaginationMeta | null;
  loading: boolean;
  canExport: boolean;
  exporting: boolean;
  onExport: () => void;
  onOpen: (log: AuditLog) => void;
}) => (
  <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
      <Input value={filters.module ?? ""} onChange={(event) => onFiltersChange({ module: event.target.value, page: 1 })} placeholder="Module" />
      <Input value={filters.action ?? ""} onChange={(event) => onFiltersChange({ action: event.target.value, page: 1 })} placeholder="Action" />
      <Input value={filters.user ?? ""} onChange={(event) => onFiltersChange({ user: event.target.value, page: 1 })} placeholder="User" />
      <Select value={filters.status ?? ""} onChange={(event) => onFiltersChange({ status: event.target.value as AuditFilters["status"], page: 1 })}>
        <option value="">All status</option>
        <option value="success">Success</option>
        <option value="failed">Failed</option>
      </Select>
      <Input
        value={filters.entityType ?? ""}
        onChange={(event) => onFiltersChange({ entityType: event.target.value, page: 1 })}
        placeholder="Entity type"
      />
      <Input type="date" value={filters.dateFrom ?? ""} onChange={(event) => onFiltersChange({ dateFrom: event.target.value, page: 1 })} />
      <Input type="date" value={filters.dateTo ?? ""} onChange={(event) => onFiltersChange({ dateTo: event.target.value, page: 1 })} />
    </div>

    <div className="flex justify-end">
      {canExport ? (
        <Button variant="secondary" loading={exporting} onClick={onExport}>
          <Download className="mr-2 size-4" />
          Export
        </Button>
      ) : null}
    </div>

    {loading ? <LoadingState label="Loading audit logs..." /> : null}

    {!loading && logs.length === 0 ? <EmptyState title="No audit logs found" /> : null}

    {!loading && logs.length > 0 ? (
      <>
        <TableWrapper>
          <Table>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{format(new Date(log.createdAt), "dd MMM yyyy, hh:mm a")}</td>
                  <td className="px-4 py-3">{log.userName}</td>
                  <td className="px-4 py-3">{log.userRole ?? "-"}</td>
                  <td className="px-4 py-3 capitalize">{log.module.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3">{log.entityType ? `${log.entityType}${log.entityId ? ` • ${log.entityId.slice(0, 8)}` : ""}` : "-"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-3">{log.ipAddress ?? "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <TableActionIconButton label="View details" icon={<Eye className="size-4" />} onClick={() => onOpen(log)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
        {pagination ? <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={(page) => onFiltersChange({ page })} /> : null}
      </>
    ) : null}
  </div>
);
