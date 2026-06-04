import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { Select } from "../../../components/ui/Select";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { formatPreferredDateTime } from "../../../lib/date-format";
import type { LoginLog, LoginLogFilters, PaginationMeta } from "../../../types/securityAdmin";

export const LoginLogsTable = ({
  filters,
  onFiltersChange,
  logs,
  pagination,
  loading
}: {
  filters: LoginLogFilters;
  onFiltersChange: (value: Partial<LoginLogFilters>) => void;
  logs: LoginLog[];
  pagination: PaginationMeta | null;
  loading: boolean;
}) => (
  <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <Input value={filters.email ?? ""} onChange={(event) => onFiltersChange({ email: event.target.value, page: 1 })} placeholder="Email" />
      <Select value={filters.loginType ?? ""} onChange={(event) => onFiltersChange({ loginType: event.target.value as LoginLogFilters["loginType"], page: 1 })}>
        <option value="">All types</option>
        <option value="login">Login</option>
        <option value="logout">Logout</option>
        <option value="failed_login">Failed Login</option>
        <option value="password_reset">Password Reset</option>
      </Select>
      <Select value={filters.success ?? ""} onChange={(event) => onFiltersChange({ success: event.target.value as LoginLogFilters["success"], page: 1 })}>
        <option value="">All results</option>
        <option value="true">Success</option>
        <option value="false">Failed</option>
      </Select>
      <Input type="date" value={filters.dateFrom ?? ""} onChange={(event) => onFiltersChange({ dateFrom: event.target.value, page: 1 })} />
      <Input type="date" value={filters.dateTo ?? ""} onChange={(event) => onFiltersChange({ dateTo: event.target.value, page: 1 })} />
    </div>

    {loading ? <LoadingState label="Loading login logs..." /> : null}
    {!loading && logs.length === 0 ? <EmptyState title="No login logs found" /> : null}

    {!loading && logs.length > 0 ? (
      <>
        <TableWrapper>
          <Table>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Success</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">User Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatPreferredDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3">{log.email}</td>
                  <td className="px-4 py-3">{log.loginType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={log.success ? "success" : "failed"} label={log.success ? "success" : "failed"} />
                  </td>
                  <td className="px-4 py-3">{log.ipAddress ?? "-"}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={log.userAgent ?? "-"}>{log.userAgent ?? "-"}</td>
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
