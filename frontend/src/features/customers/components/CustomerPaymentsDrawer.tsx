import { useEffect, useState } from "react";
import { ReceiptText, RotateCcw } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { getErrorMessage } from "../../../lib/errors";
import { customersApi } from "../../../services/customersApi";
import { formatDate } from "../customerUtils";
import { CustomerSideSheet } from "./CustomerSideSheet";

export const CustomerPaymentsDrawer = ({
  open,
  customerId,
  customerName,
  onClose,
}: {
  open: boolean;
  customerId: string | null;
  customerName: string;
  onClose: () => void;
}) => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof customersApi.getPayments>>["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDateFrom("");
    setDateTo("");
    setPage(1);
  }, [open, customerId]);

  useEffect(() => {
    if (!open || !customerId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await customersApi.getPayments(customerId, {
          page,
          limit: 20,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });

        if (!cancelled) {
          setData(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load payments"));
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
  }, [customerId, dateFrom, dateTo, open, page]);

  return (
    <CustomerSideSheet
      open={open}
      onClose={onClose}
      title={customerName ? `${customerName} Payments` : "Customer Payments"}
      className="max-w-[88rem]"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <ReceiptText className="size-4 text-emerald-600" />
          <span className="text-slate-500">Total Payments</span>
          <AmountText value={data?.totals.totalPayments ?? 0} className="text-base" tone="success" />
        </div>

        <Card>
          <CardContent className="grid gap-4 md:grid-cols-3">
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              <RotateCcw className="mr-2 size-4" />
              Reset
            </Button>
          </CardContent>
        </Card>

        {loading && !data ? (
          <LoadingState label="Loading payments..." />
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div>
        ) : !data?.items.length ? (
          <EmptyState title="No payments found" />
        ) : (
          <Card>
            <TableWrapper className="border-none">
              <div className="overflow-x-auto">
                <Table>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Date", "Amount", "Payment Mode", "Reference No", "Linked Invoice", "Receipt No", "Status", "Notes"].map((head) => (
                        <th key={head} className="px-5 py-3 font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-5 py-4 whitespace-nowrap">{formatDate(item.date)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <AmountText value={item.amount} tone="success" />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.paymentMode || "-"}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.referenceNo || "-"}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.linkedInvoice || "-"}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.receiptNo || "-"}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.status || "-"}</td>
                        <td className="px-5 py-4 min-w-56">{item.notes || item.remarks || "-"}</td>
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
    </CustomerSideSheet>
  );
};
