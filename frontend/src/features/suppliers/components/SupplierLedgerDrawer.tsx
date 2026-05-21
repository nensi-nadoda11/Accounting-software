import { useEffect, useState } from "react";
import { Download, FileText, RotateCcw } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
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
import type { SupplierLedgerTransactionType } from "../../../types/supplier";
import { SUPPLIER_LEDGER_TRANSACTION_LABELS, SUPPLIER_LEDGER_TRANSACTION_OPTIONS } from "../supplierOptions";
import { formatDate, formatDateTime, formatInr } from "../supplierUtils";

export const SupplierLedgerDrawer = ({
  open,
  supplierId,
  supplierName,
  onClose,
  onExport,
  canExport,
}: {
  open: boolean;
  supplierId: string | null;
  supplierName: string;
  onClose: () => void;
  onExport: (filters: {
    dateFrom?: string;
    dateTo?: string;
    transactionType?: SupplierLedgerTransactionType;
  }) => Promise<void>;
  canExport: boolean;
}) => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [transactionType, setTransactionType] = useState<SupplierLedgerTransactionType | "">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof suppliersApi.getLedger>>["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDateFrom("");
    setDateTo("");
    setTransactionType("");
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
        const response = await suppliersApi.getLedger(supplierId, {
          page,
          limit: 20,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          transactionType: transactionType || undefined,
        });

        if (!cancelled) {
          setData(response.data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Failed to load supplier ledger"));
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
  }, [dateFrom, dateTo, open, page, supplierId, transactionType]);

  const runningBalance = data?.items.at(-1)?.balance ?? "0.00";

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={supplierName ? `${supplierName} Ledger` : "Supplier Ledger"}
      className="max-w-[92rem]"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <FileText className="size-4 text-emerald-600" />
            <span className="text-slate-500">Running Balance</span>
            <AmountText value={runningBalance} className="text-base" tone={Number(runningBalance) >= 0 ? "success" : "danger"} />
          </div>
          {canExport ? (
            <Button
              type="button"
              variant="secondary"
              loading={exporting}
              onClick={async () => {
                try {
                  setExporting(true);
                  await onExport({
                    dateFrom: dateFrom || undefined,
                    dateTo: dateTo || undefined,
                    transactionType: transactionType || undefined,
                  });
                } finally {
                  setExporting(false);
                }
              }}
            >
              <Download className="mr-2 size-4" />
              Export Ledger
            </Button>
          ) : null}
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
              value={transactionType}
              onChange={(event) => {
                setPage(1);
                setTransactionType(event.target.value as SupplierLedgerTransactionType | "");
              }}
            >
              {SUPPLIER_LEDGER_TRANSACTION_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setTransactionType("");
                setPage(1);
              }}
            >
              <RotateCcw className="mr-2 size-4" />
              Reset
            </Button>
          </CardContent>
        </Card>

        {loading && !data ? (
          <LoadingState label="Loading ledger..." />
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div>
        ) : !data?.items.length ? (
          <EmptyState title="No ledger entries found" />
        ) : (
          <Card>
            <TableWrapper className="border-none">
              <div className="overflow-x-auto">
                <Table>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Sr", "Date & Time", "Type", "Reference No", "Description", "Debit", "Credit", "Balance", "Payment Mode", "Remarks"].map((head) => (
                        <th key={head} className="px-5 py-3 font-semibold">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                    {data.items.map((item, index) => (
                      <tr key={`${item.referenceNo ?? "ledger"}-${index}`}>
                        <td className="px-5 py-4 whitespace-nowrap font-medium text-slate-900">
                          {((data.pagination.page - 1) * data.pagination.limit) + index + 1}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div>{formatDate(item.date)}</div>
                          <div className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {SUPPLIER_LEDGER_TRANSACTION_LABELS[item.transactionType as keyof typeof SUPPLIER_LEDGER_TRANSACTION_LABELS] ??
                            item.transactionType.replaceAll("_", " ")}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.referenceNo || "-"}</td>
                        <td className="min-w-56 px-5 py-4">{item.description}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{formatInr(item.debit)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">{formatInr(item.credit)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <AmountText value={item.balance} tone={Number(item.balance) >= 0 ? "success" : "danger"} />
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">{item.paymentMode || "-"}</td>
                        <td className="min-w-48 px-5 py-4">{item.remarks || "-"}</td>
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
