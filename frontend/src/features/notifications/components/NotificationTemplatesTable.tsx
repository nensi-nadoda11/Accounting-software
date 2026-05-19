import { Pencil } from "lucide-react";

import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { NotificationTemplate } from "../../../types/notification";
import { notificationChannelLabels, notificationTypeLabels } from "../notificationMeta";

export const NotificationTemplatesTable = ({
  items,
  onEdit,
  canEdit,
}: {
  items: NotificationTemplate[];
  onEdit: (template: NotificationTemplate) => void;
  canEdit: boolean;
}) => {
  if (!items.length) {
    return <EmptyState title="No templates found" />;
  }

  return (
    <TableWrapper>
      <Table>
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Template Key</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Channel</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Active</th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.templateKey}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{notificationTypeLabels[item.type]}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{notificationChannelLabels[item.channel]}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{item.subject || "-"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={item.isActive ? "active" : "inactive"} label={item.isActive ? "Active" : "Inactive"} />
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  {canEdit ? (
                    <TableActionIconButton
                      label="Edit template"
                      icon={<Pencil className="size-4" />}
                      onClick={() => onEdit(item)}
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  );
};
