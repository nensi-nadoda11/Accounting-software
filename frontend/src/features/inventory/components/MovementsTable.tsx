import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { QuantityText } from "../../../components/ui/QuantityText";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { InventoryPagination, StockMovement } from "../../../types/inventory";
import { AmountText } from "../../../components/ui/AmountText";
import { formatDateTime, STOCK_MOVEMENT_TYPE_LABELS } from "../inventoryUtils";

export const MovementsTable = ({
  items,
  pagination,
  loading,
  error,
  onPageChange,
}: {
  items: StockMovement[];
  pagination: InventoryPagination | null;
  loading?: boolean;
  error?: string | null;
  onPageChange: (page: number) => void;
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
    return <EmptyState title="No movement records found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <Table>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {["Date", "Product", "Warehouse", "Batch", "Type", "In", "Out", "Balance", "Rate", "Value", "Reference"].map((head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(item.movementDate)}</td>
                <td className="px-4 py-4">
                  <div className="min-w-[180px]">
                    <p className="font-medium text-slate-900">{item.product.name}</p>
                    <p className="text-xs text-slate-500">{item.product.productCode}</p>
                  </div>
                </td>
                <td className="px-4 py-4">{item.warehouse.name ?? item.warehouse.warehouseCode ?? "-"}</td>
                <td className="px-4 py-4">{item.batch?.batchNumber ?? "-"}</td>
                <td className="px-4 py-4">{STOCK_MOVEMENT_TYPE_LABELS[item.movementType]}</td>
                <td className="px-4 py-4"><QuantityText value={item.inQuantity} /></td>
                <td className="px-4 py-4"><QuantityText value={item.outQuantity} tone="danger" /></td>
                <td className="px-4 py-4"><QuantityText value={item.balanceAfter} tone="default" /></td>
                <td className="px-4 py-4"><AmountText value={item.rate} tone="default" /></td>
                <td className="px-4 py-4"><AmountText value={item.value} tone="default" /></td>
                <td className="px-4 py-4">{item.referenceNumber ?? item.referenceType ?? "-"}</td>
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
