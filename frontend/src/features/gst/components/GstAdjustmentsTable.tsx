import { Eye, XCircle } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { GstAdjustment, PaginationMeta } from "../../../types/gst";
import { formatGstDate, GST_ADJUSTMENT_TYPE_LABELS, GST_TAX_COMPONENT_LABELS } from "../gstUtils";

export const GstAdjustmentsTable = ({
  items,
  pagination,
  onPageChange,
  canManage,
  onView,
  onCancel,
}: {
  items: GstAdjustment[];
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  canManage: boolean;
  onView: (row: GstAdjustment) => void;
  onCancel: (row: GstAdjustment) => void;
}) => {
  if (!items.length) {
    return <EmptyState title="No GST adjustments found." />;
  }

  return (
    <div className="space-y-3">
      <TableWrapper>
        <Table>
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Adjustment No", "Date", "Type", "Component", "Amount", "Reason", "Status", "Actions"].map((head) => (
                <th key={head} className="px-3 py-3 font-semibold">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {items.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3 whitespace-nowrap font-medium text-slate-900">{row.adjustmentNumber}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatGstDate(row.adjustmentDate)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{GST_ADJUSTMENT_TYPE_LABELS[row.adjustmentType]}</td>
                <td className="px-3 py-3 whitespace-nowrap">{GST_TAX_COMPONENT_LABELS[row.taxComponent]}</td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.amount} tone="default" /></td>
                <td className="px-3 py-3">
                  <div className="max-w-[320px] truncate" title={row.reason}>{row.reason}</div>
                </td>
                <td className="px-3 py-3"><StatusBadge status={row.status} label={row.status} /></td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <TableActionIconButton label="View adjustment" icon={<Eye className="size-4" />} onClick={() => onView(row)} />
                    {canManage && row.status === "active" ? (
                      <TableActionIconButton
                        label="Cancel adjustment"
                        icon={<XCircle className="size-4" />}
                        onClick={() => onCancel(row)}
                        tone="danger"
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} />
    </div>
  );
};
