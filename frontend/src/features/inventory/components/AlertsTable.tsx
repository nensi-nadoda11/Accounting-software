import { CheckCheck } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { QuantityText } from "../../../components/ui/QuantityText";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { InventoryAlert, InventoryPagination } from "../../../types/inventory";
import {
  formatDateTime,
  formatDate,
  getAlertStatusLabel,
  getAlertTone,
  getSeverityTone,
  INVENTORY_ALERT_SEVERITY_LABELS,
  INVENTORY_ALERT_TYPE_LABELS,
} from "../inventoryUtils";

export const AlertsTable = ({
  items,
  pagination,
  loading,
  error,
  onPageChange,
  onMarkRead,
  markingId,
  canMarkRead,
}: {
  items: InventoryAlert[];
  pagination: InventoryPagination | null;
  loading?: boolean;
  error?: string | null;
  onPageChange: (page: number) => void;
  onMarkRead: (alert: InventoryAlert) => void;
  markingId?: string | null;
  canMarkRead: boolean;
}) => {
  if (loading && !items.length) {
    return (
      <Card className="p-5">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 rounded bg-slate-100" />
          ))}
        </div>
      </Card>
    );
  }

  if (error && !items.length) {
    return <Card className="p-5 text-sm text-rose-700">{error}</Card>;
  }

  if (!items.length) {
    return <EmptyState title="No alerts found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <Table>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {["Type", "Product", "Warehouse", "Batch", "Severity", "Current Qty", "Expiry Date", "Status", "Created", "Actions"].map((head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-4">
                  <Badge tone={getAlertTone(item.alertType)}>{INVENTORY_ALERT_TYPE_LABELS[item.alertType]}</Badge>
                </td>
                <td className="px-4 py-4">
                  <div className="min-w-[170px]">
                    <p className="font-medium text-slate-900">{item.product.name}</p>
                    <p className="text-xs text-slate-500">{item.product.productCode}</p>
                  </div>
                </td>
                <td className="px-4 py-4">{item.warehouse?.name ?? item.warehouse?.warehouseCode ?? "-"}</td>
                <td className="px-4 py-4">{item.batch?.batchNumber ?? "-"}</td>
                <td className="px-4 py-4">
                  <Badge tone={getSeverityTone(item.severity)}>{INVENTORY_ALERT_SEVERITY_LABELS[item.severity]}</Badge>
                </td>
                <td className="px-4 py-4">
                  {item.currentQuantity ? <QuantityText value={item.currentQuantity} tone="default" /> : "-"}
                </td>
                <td className="px-4 py-4">{formatDate(item.expiryDate)}</td>
                <td className="px-4 py-4">{getAlertStatusLabel(item)}</td>
                <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                <td className="px-4 py-4">
                  {canMarkRead && !item.isRead ? (
                    <div className="flex justify-end">
                      <TableActionIconButton
                        label="Mark read"
                        icon={<CheckCheck className="size-4" />}
                        onClick={() => onMarkRead(item)}
                        disabled={markingId === item.id}
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>
      {pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <p className="text-sm text-slate-500">
            Showing {items.length} of {pagination.total} records
          </p>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
