import { format } from "date-fns";

import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { Select } from "../../../components/ui/Select";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { PaginationMeta, RestoreLog, RestoreLogFilters } from "../../../types/securityAdmin";

export const RestoreLogsTable = ({
  filters,
  onFiltersChange,
  logs,
  pagination,
  loading
}: {
  filters: RestoreLogFilters;
  onFiltersChange: (value: Partial<RestoreLogFilters>) => void;
  logs: RestoreLog[];
  pagination: PaginationMeta | null;
  loading: boolean;
}) => (
  <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Select value={filters.status ?? ""} onChange={(event) => onFiltersChange({ status: event.target.value as RestoreLogFilters["status"], page: 1 })}>
        <option value="">All status</option>
        <option value="success">Success</option>
        <option value="failed">Failed</option>
      </Select>
      <Select value={filters.restoreMode ?? ""} onChange={(event) => onFiltersChange({ restoreMode: event.target.value as RestoreLogFilters["restoreMode"], page: 1 })}>
        <option value="">All modes</option>
        <option value="merge">Merge</option>
        <option value="replace">Replace</option>
      </Select>
      <Input type="date" value={filters.dateFrom ?? ""} onChange={(event) => onFiltersChange({ dateFrom: event.target.value, page: 1 })} />
      <Input type="date" value={filters.dateTo ?? ""} onChange={(event) => onFiltersChange({ dateTo: event.target.value, page: 1 })} />
    </div>

    {loading ? <LoadingState label="Loading restore logs..." /> : null}
    {!loading && logs.length === 0 ? <EmptyState title="No restore logs found" /> : null}

    {!loading && logs.length > 0 ? (
      <>
        <TableWrapper>
          <Table>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Backup</th>
                <th className="px-4 py-3">Restored By</th>
                <th className="px-4 py-3">Restore Mode</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3">{log.backupName}</td>
                  <td className="px-4 py-3">{log.restoredByName}</td>
                  <td className="px-4 py-3 capitalize">{log.restoreMode}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-3">{log.errorMessage ?? "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{format(new Date(log.createdAt), "dd MMM yyyy, hh:mm a")}</td>
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
