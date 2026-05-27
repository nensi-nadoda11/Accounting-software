import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { getErrorMessage } from "../../../lib/errors";
import { productsApi } from "../../../services/productsApi";
import type { ProductPriceHistoryResponse } from "../../../types/product";
import { PRODUCT_PRICE_HISTORY_CHANGE_TYPE_LABELS } from "../productOptions";
import { formatDateTime } from "../productUtils";

export const ProductPriceHistoryDrawer = ({
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
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ProductPriceHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPage(1);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !productId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await productsApi.getPriceHistory(productId, page, 20);

        if (!cancelled) {
          setData(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load price history"));
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
  }, [open, page, productId]);

  const rows = data?.items ?? [];

  return (
    <SideSheet open={open} onClose={onClose} title={productName ? `${productName} Price History` : "Price History"}>
      {loading && !data ? (
        <LoadingState label="Loading price history..." />
      ) : error ? (
        <div className="space-y-4">
          <div className="app-feedback-error rounded-2xl border px-4 py-4 text-sm">{error}</div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : !rows.length ? (
        <EmptyState title="No price history found" />
      ) : (
        <Card>
          <TableWrapper className="border-none">
            <Table>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Date", "Change Type", "Old Value", "New Value", "Changed By", "Reason"].map((head) => (
                    <th key={head} className="px-4 py-3 font-semibold">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3">{PRODUCT_PRICE_HISTORY_CHANGE_TYPE_LABELS[item.changeType]}</td>
                    <td className="px-4 py-3">{item.oldValue ?? "-"}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{item.newValue ?? "-"}</td>
                    <td className="px-4 py-3">{item.changedBy ?? "-"}</td>
                    <td className="px-4 py-3">{item.reason ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
          {data?.pagination ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <p className="text-sm text-slate-500">
                Showing {rows.length} of {data.pagination.total} entries
              </p>
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
            </div>
          ) : null}
        </Card>
      )}
    </SideSheet>
  );
};
