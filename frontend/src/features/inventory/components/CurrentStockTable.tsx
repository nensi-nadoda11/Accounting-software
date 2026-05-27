import { Eye, History, SlidersHorizontal } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { QuantityText } from "../../../components/ui/QuantityText";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { InventoryPagination, StockBalance } from "../../../types/inventory";
import { getStockStatus } from "../inventoryUtils";

const CurrentStockTableSkeleton = () => (
  <Card>
    <TableWrapper className="border-none">
      <Table>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {["Product", "SKU", "Warehouse", "Batch", "Available", "Reserved", "Damaged", "Expired", "Avg Cost", "Stock Value", "Status", "Actions"].map(
              (head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {Array.from({ length: 8 }).map((_, rowIndex) => (
            <tr key={rowIndex} className="animate-pulse">
              {Array.from({ length: 12 }).map((__, cellIndex) => (
                <td key={cellIndex} className="px-4 py-4">
                  <div className="h-4 rounded bg-slate-100" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  </Card>
);

export const CurrentStockTable = ({
  items,
  pagination,
  loading,
  error,
  onRetry,
  onPageChange,
  onViewDetail,
  onAddAdjustment,
  onViewMovements,
  canAdjust,
}: {
  items: StockBalance[];
  pagination: InventoryPagination | null;
  loading?: boolean;
  error?: string | null;
  onRetry: () => void;
  onPageChange: (page: number) => void;
  onViewDetail: (row: StockBalance) => void;
  onAddAdjustment: (row: StockBalance) => void;
  onViewMovements: (row: StockBalance) => void;
  canAdjust: boolean;
}) => {
  if (loading && !items.length) {
    return <CurrentStockTableSkeleton />;
  }

  if (error && !items.length) {
    return (
      <Card className="p-5">
        <div className="space-y-4">
          <div className="app-feedback-error rounded-2xl border px-4 py-4 text-sm">{error}</div>
          <Button type="button" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!items.length) {
    return <EmptyState title="No stock records found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <Table>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {["Product", "SKU", "Warehouse", "Batch", "Available", "Reserved", "Damaged", "Expired", "Avg Cost", "Stock Value", "Status", "Actions"].map(
                (head) => (
                  <th key={head} className="px-4 py-3 font-semibold">
                    {head}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
            {items.map((item) => {
              const status = getStockStatus(item);

              return (
                <tr key={`${item.product.id}-${item.warehouse.id}-${item.batch?.id ?? "none"}`}>
                  <td className="px-4 py-4">
                    <div className="min-w-[180px]">
                      <p className="font-medium text-slate-900">{item.product.name}</p>
                      <p className="text-xs text-slate-500">{item.product.productCode}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">{item.product.sku ?? item.product.barcode ?? "-"}</td>
                  <td className="px-4 py-4">{item.warehouse.name ?? item.warehouse.warehouseCode ?? "-"}</td>
                  <td className="px-4 py-4">{item.batch?.batchNumber ?? "-"}</td>
                  <td className="px-4 py-4"><QuantityText value={item.availableQuantity} /></td>
                  <td className="px-4 py-4"><QuantityText value={item.reservedQuantity} tone="default" /></td>
                  <td className="px-4 py-4"><QuantityText value={item.damagedQuantity} tone="danger" /></td>
                  <td className="px-4 py-4"><QuantityText value={item.expiredQuantity} tone="danger" /></td>
                  <td className="px-4 py-4"><AmountText value={item.averageCost} tone="default" /></td>
                  <td className="px-4 py-4"><AmountText value={item.stockValue} tone="default" /></td>
                  <td className="px-4 py-4">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <TableActionIconButton label="View stock detail" icon={<Eye className="size-4" />} onClick={() => onViewDetail(item)} />
                      <TableActionIconButton
                        label="Add adjustment"
                        icon={<SlidersHorizontal className="size-4" />}
                        onClick={() => onAddAdjustment(item)}
                        disabled={!canAdjust}
                      />
                      <TableActionIconButton label="View movements" icon={<History className="size-4" />} onClick={() => onViewMovements(item)} />
                    </div>
                  </td>
                </tr>
              );
            })}
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
