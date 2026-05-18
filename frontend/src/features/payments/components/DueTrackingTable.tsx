import { Bell, Wallet } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import { formatDate } from "../../customers/customerUtils";
import type { DueTrackingResponse, DueTrackingRow } from "../../../types/payment";

export const DueTrackingTable = ({
  data,
  loading,
  canWalletAction,
  canReminderAction,
  actionLabel,
  onPageChange,
  onWallet,
  onReminder,
}: {
  data: DueTrackingResponse | null;
  loading?: boolean;
  canWalletAction: boolean;
  canReminderAction: boolean;
  actionLabel: string;
  onPageChange: (page: number) => void;
  onWallet: (row: DueTrackingRow) => void;
  onReminder: (row: DueTrackingRow) => void;
}) => {
  if (!loading && !data?.items.length) {
    return <EmptyState title="No due items found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <div className="overflow-x-auto">
          <Table>
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["Party", "Reference No", "Date", "Due Date", "Due Amount", "Aging", "Status", "Actions"].map((head) => (
                  <th key={head} className="px-4 py-3 font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
              {loading && !data
                ? Array.from({ length: 8 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className="animate-pulse">
                      {Array.from({ length: 8 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-4">
                          <div className="h-4 rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.items.map((row) => {
                    const overdue = row.dueDate ? new Date(row.dueDate).getTime() < Date.now() : false;
                    const agingLabel =
                      row.agingBucket === "current"
                        ? "0-30"
                        : row.agingBucket === "91-180" || row.agingBucket === "181+"
                          ? "90+"
                          : row.agingBucket;

                    return (
                      <tr key={row.referenceId} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{row.partyName ?? "-"}</p>
                            <p className="text-xs text-slate-500">{row.partyCode ?? "-"}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-900">{row.referenceNumber}</td>
                        <td className="px-4 py-4 whitespace-nowrap">{formatDate(row.invoiceDate)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">{formatDate(row.dueDate)}</td>
                        <td className="px-4 py-4 whitespace-nowrap"><AmountText value={row.dueAmount} tone="danger" /></td>
                        <td className="px-4 py-4 whitespace-nowrap">{agingLabel}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <StatusBadge status={overdue ? "overdue" : "active"} label={overdue ? "Overdue" : "Open"} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {canWalletAction ? (
                              <TableActionIconButton label={actionLabel} icon={<Wallet className="size-4" />} onClick={() => onWallet(row)} />
                            ) : null}
                            {canReminderAction ? (
                              <TableActionIconButton label="Send reminder" icon={<Bell className="size-4" />} onClick={() => onReminder(row)} />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </Table>
        </div>
      </TableWrapper>
      {data?.pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4">
          <p className="text-sm text-slate-500">
            Showing {data.items.length} of {data.pagination.total} due items
          </p>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
