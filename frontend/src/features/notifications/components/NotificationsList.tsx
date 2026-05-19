import { Trash2, CheckCheck, Check } from "lucide-react";

import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { Notification, NotificationListResponse } from "../../../types/notification";
import {
  formatNotificationDateTime,
  notificationChannelLabels,
  notificationPriorityLabels,
  notificationTypeIcons,
  notificationTypeLabels,
} from "../notificationMeta";

export const NotificationsList = ({
  items,
  pagination,
  onPageChange,
  onMarkRead,
  onDelete,
  onOpen,
  onMarkAllRead,
  canDelete,
}: {
  items: Notification[];
  pagination: NotificationListResponse["pagination"];
  onPageChange: (page: number) => void;
  onMarkRead: (notification: Notification) => void;
  onDelete: (notification: Notification) => void;
  onOpen: (notification: Notification) => void;
  onMarkAllRead: () => void;
  canDelete: boolean;
}) => {
  if (!items.length) {
    return <EmptyState title="No notifications found" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onMarkAllRead}
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
        >
          <CheckCheck className="size-4" />
          Mark all read
        </button>
      </div>
      <TableWrapper>
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Notification</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Channel</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Created</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const Icon = notificationTypeIcons[item.type];

              return (
                <tr key={item.id} className={!item.isRead ? "bg-emerald-50/30" : undefined}>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <span className="mt-0.5 rounded-xl bg-slate-100 p-2 text-slate-700">
                        <Icon className="size-4" />
                      </span>
                      <span className="space-y-1">
                        <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                        <span className="block text-sm text-slate-600">{item.message}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      <StatusBadge status={item.isRead ? "read" : "unread"} label={item.isRead ? "Read" : "Unread"} />
                      <div className="text-sm text-slate-600">{notificationTypeLabels[item.type]}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.priority} label={notificationPriorityLabels[item.priority]} />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{notificationChannelLabels[item.channel]}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatNotificationDateTime(item.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {!item.isRead ? (
                        <TableActionIconButton
                          label="Mark read"
                          icon={<Check className="size-4" />}
                          onClick={() => onMarkRead(item)}
                        />
                      ) : null}
                      {canDelete ? (
                        <TableActionIconButton
                          label="Delete"
                          icon={<Trash2 className="size-4" />}
                          tone="danger"
                          onClick={() => onDelete(item)}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrapper>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} />
    </div>
  );
};
