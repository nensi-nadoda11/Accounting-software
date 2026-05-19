import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { Pagination } from "../../../components/ui/Pagination";
import { Select } from "../../../components/ui/Select";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { NotificationLog, NotificationLogsQuery, NotificationLogsResponse } from "../../../types/notification";
import { NOTIFICATION_LOG_STATUSES } from "../../../types/notification";
import { formatNotificationDateTime, notificationChannelOptions } from "../notificationMeta";

export const NotificationLogsTable = ({
  items,
  pagination,
  query,
  onQueryChange,
  onPageChange,
}: {
  items: NotificationLog[];
  pagination: NotificationLogsResponse["pagination"];
  query: NotificationLogsQuery;
  onQueryChange: (patch: Partial<NotificationLogsQuery>) => void;
  onPageChange: (page: number) => void;
}) => (
  <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-4">
      <Select
        label="Channel"
        value={query.channel ?? ""}
        onChange={(event) => onQueryChange({ channel: event.target.value as NotificationLogsQuery["channel"], page: 1 })}
      >
        <option value="">All</option>
        {notificationChannelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        label="Status"
        value={query.status ?? ""}
        onChange={(event) => onQueryChange({ status: event.target.value as NotificationLogsQuery["status"], page: 1 })}
      >
        <option value="">All</option>
        {NOTIFICATION_LOG_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </Select>
      <Input
        type="date"
        label="From"
        value={query.dateFrom ?? ""}
        onChange={(event) => onQueryChange({ dateFrom: event.target.value, page: 1 })}
      />
      <Input
        type="date"
        label="To"
        value={query.dateTo ?? ""}
        onChange={(event) => onQueryChange({ dateTo: event.target.value, page: 1 })}
      />
    </div>
    {!items.length ? (
      <EmptyState title="No notification logs found" />
    ) : (
      <>
        <TableWrapper>
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Channel</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Recipient</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Error</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Sent</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.channel}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{item.recipient}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{item.errorMessage || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatNotificationDateTime(item.sentAt)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatNotificationDateTime(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} />
      </>
    )}
  </div>
);
