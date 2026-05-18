import { Eye, FileText, Wallet } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import { formatDate } from "../../customers/customerUtils";
import type { Payment, PaymentListResponse } from "../../../types/payment";
import { PAYMENT_MODE_LABELS, PAYMENT_STATUS_LABELS } from "../paymentOptions";

export const AdvancesTable = ({
  data,
  loading,
  canReceipt,
  canAllocate,
  onPageChange,
  onView,
  onAllocate,
  onReceipt,
}: {
  data: PaymentListResponse | null;
  loading?: boolean;
  canReceipt: boolean;
  canAllocate: boolean;
  onPageChange: (page: number) => void;
  onView: (payment: Payment) => void;
  onAllocate: (payment: Payment) => void;
  onReceipt: (payment: Payment) => void;
}) => {
  if (!loading && !data?.items.length) {
    return <EmptyState title="No advance payments found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <div className="overflow-x-auto">
          <Table>
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["Payment No", "Party", "Date", "Advance Amount", "Mode", "Status", "Actions"].map((head) => (
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
                      {Array.from({ length: 7 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-4">
                          <div className="h-4 rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.items.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-medium text-slate-900">{payment.paymentNumber}</td>
                      <td className="px-4 py-4">{payment.party?.name ?? "-"}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDate(payment.paymentDate)}</td>
                      <td className="px-4 py-4 whitespace-nowrap"><AmountText value={payment.unallocatedAmount} tone="warning" /></td>
                      <td className="px-4 py-4 whitespace-nowrap">{PAYMENT_MODE_LABELS[payment.paymentMode]}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <TableActionIconButton label="View payment" icon={<Eye className="size-4" />} onClick={() => onView(payment)} />
                          {canAllocate ? (
                            <TableActionIconButton label="Allocate advance" icon={<Wallet className="size-4" />} onClick={() => onAllocate(payment)} />
                          ) : null}
                          {canReceipt && payment.status === "completed" ? (
                            <TableActionIconButton label="View receipt" icon={<FileText className="size-4" />} onClick={() => onReceipt(payment)} />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </Table>
        </div>
      </TableWrapper>
      {data?.pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4">
          <p className="text-sm text-slate-500">
            Showing {data.items.length} of {data.pagination.total} advances
          </p>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
