import { useEffect, useState } from "react";
import { Package, RotateCcw } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { getErrorMessage } from "../../../lib/errors";
import { suppliersApi } from "../../../services/suppliersApi";
import { formatDate, formatInr, getGenericStatusTone, getPurchaseInvoiceLabel, getPurchasePaidAmount, getPurchaseTotalAmount } from "../supplierUtils";

export const SupplierPurchasesDrawer = ({
  open,
  supplierId,
  supplierName,
  onClose,
}: {
  open: boolean;
  supplierId: string | null;
  supplierName: string;
  onClose: () => void;
}) => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof suppliersApi.getPurchases>>["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDateFrom("");
    setDateTo("");
    setStatus("");
    setPage(1);
  }, [open, supplierId]);

  useEffect(() => {
    if (!open || !supplierId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await suppliersApi.getPurchases(supplierId, {
          page,
          limit: 20,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          status: status || undefined,
        });

        if (!cancelled) {
          setData(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load purchase history"));
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
  }, [dateFrom, dateTo, open, page, status, supplierId]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={supplierName ? `${supplierName} Purchases` : "Purchase History"}
      className="max-w-[92rem]"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <Package className="size-4 text-emerald-600" />
            <span className="text-slate-500">Total Purchases</span>
            <AmountText value={data?.totals.totalPurchases ?? 0} className="text-base" />
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <Package className="size-4 text-amber-600" />
            <span className="text-slate-500">Purchase Returns</span>
            <span className="font-medium text-slate-900">{formatInr(data?.totals.totalPurchaseReturns ?? 0)}</span>
          </div>
        </div>

        <Card>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setPage(1);
                setDateFrom(event.target.value);
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              aria-label="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setPage(1);
                setDateTo(event.target.value);
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              aria-label="To date"
            />
            <Select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setStatus("");
                setPage(1);
              }}
            >
              <RotateCcw className="mr-2 size-4" />
              Reset
            </Button>
          </CardContent>
        </Card>

        {loading && !data ? (
          <LoadingState label="Loading purchase history..." />
        ) : error ? (
          <div className="app-feedback-error rounded-2xl border px-4 py-4 text-sm">{error}</div>
        ) : !data?.items.length ? (
          <EmptyState title="No purchase history found" />
        ) : (
          <Card>
            <TableWrapper className="border-none">
              <div className="overflow-x-auto">
                <Table>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Purchase Invoice No", "Supplier Invoice No", "Date", "Total Amount", "Paid Amount", "Due Amount", "Status", "Notes"].map((head) => (
                        <th key={head} className="px-5 py-3 font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-4 whitespace-nowrap">{getPurchaseInvoiceLabel(item)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.supplierInvoiceNo || "-"}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{formatDate(item.date)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {getPurchaseTotalAmount(item) ? <AmountText value={getPurchaseTotalAmount(item)} /> : "-"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {getPurchasePaidAmount(item) ? <AmountText value={getPurchasePaidAmount(item)} tone="success" /> : "-"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {item.dueAmount ? <AmountText value={item.dueAmount} tone={Number(item.dueAmount) > 0 ? "danger" : "default"} /> : "-"}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <Badge tone={getGenericStatusTone(item.status)}>{item.status || "-"}</Badge>
                        </td>
                        <td className="min-w-56 px-5 py-4">{item.remarks || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </TableWrapper>
            <div className="border-t border-slate-100 px-5 py-4">
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
            </div>
          </Card>
        )}
      </div>
    </SideSheet>
  );
};
