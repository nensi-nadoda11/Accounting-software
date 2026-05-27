import { useEffect, useState } from "react";

import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { QuantityText } from "../../../components/ui/QuantityText";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { getErrorMessage } from "../../../lib/errors";
import { inventoryApi } from "../../../services/inventoryApi";
import type { ProductStockDetail } from "../../../types/inventory";
import { formatDateTime } from "../inventoryUtils";

export const StockDetailDrawer = ({
  open,
  productId,
  productName,
  onClose,
}: {
  open: boolean;
  productId: string | null;
  productName: string;
  onClose: () => void;
}) => {
  const [data, setData] = useState<ProductStockDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !productId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await inventoryApi.getProductStock(productId);

        if (!cancelled) {
          setData(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load stock detail"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  return (
    <SideSheet open={open} onClose={onClose} title={productName || "Stock Detail"} className="max-w-5xl">
      {loading && !data ? (
        <LoadingState label="Loading stock detail..." />
      ) : error ? (
        <div className="app-feedback-error rounded-2xl border px-4 py-4 text-sm">{error}</div>
      ) : !data ? (
        <EmptyState title="No stock detail available" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Min Stock</p>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  <QuantityText value={data.product.minimumStockLevel} tone="default" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Reorder</p>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  <QuantityText value={data.product.reorderLevel} tone="default" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Max Stock</p>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  <QuantityText value={data.product.maximumStockLevel} tone="default" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Negative Stock</p>
                <div className="mt-1 text-lg font-semibold text-slate-900">{data.product.negativeStockAllowed ? "Allowed" : "Blocked"}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader title="Warehouse Balances" />
            <TableWrapper className="border-none">
              <Table>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Warehouse", "Batch", "Available", "Reserved", "Damaged", "Expired", "Avg Cost", "Stock Value", "Updated"].map((head) => (
                      <th key={head} className="px-4 py-3 font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                  {data.items.map((item) => (
                    <tr key={`${item.warehouse.id}-${item.batch?.id ?? "none"}`}>
                      <td className="px-4 py-4">{item.warehouse.name ?? item.warehouse.warehouseCode ?? "-"}</td>
                      <td className="px-4 py-4">{item.batch?.batchNumber ?? "-"}</td>
                      <td className="px-4 py-4"><QuantityText value={item.availableQuantity} tone="default" /></td>
                      <td className="px-4 py-4"><QuantityText value={item.reservedQuantity} tone="default" /></td>
                      <td className="px-4 py-4"><QuantityText value={item.damagedQuantity} tone="danger" /></td>
                      <td className="px-4 py-4"><QuantityText value={item.expiredQuantity} tone="danger" /></td>
                      <td className="px-4 py-4"><AmountText value={item.averageCost} tone="default" /></td>
                      <td className="px-4 py-4"><AmountText value={item.stockValue} tone="default" /></td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(item.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </Card>
        </div>
      )}
    </SideSheet>
  );
};
