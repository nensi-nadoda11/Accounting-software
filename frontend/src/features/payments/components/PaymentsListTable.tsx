import { BadgeCheck, CheckCircle2, Eye, FileDown, FileText, Mail, Pencil, XCircle } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import { formatDate } from "../../customers/customerUtils";
import type { Payment, PaymentListResponse } from "../../../types/payment";
import { PAYMENT_MODE_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from "../paymentOptions";

export const PaymentsListTable = ({
  data,
  loading,
  canUpdate,
  canCancel,
  canReceiptPrint,
  canChequeUpdate,
  canCompleteCustomer,
  canCompleteSupplier,
  onPageChange,
  onView,
  onEdit,
  onComplete,
  onCancel,
  onReceipt,
  onPdf,
  onSendReceipt,
  onChequeStatus,
}: {
  data: PaymentListResponse | null;
  loading?: boolean;
  canUpdate: boolean;
  canCancel: boolean;
  canReceiptPrint: boolean;
  canChequeUpdate: boolean;
  canCompleteCustomer: boolean;
  canCompleteSupplier: boolean;
  onPageChange: (page: number) => void;
  onView: (payment: Payment) => void;
  onEdit: (payment: Payment) => void;
  onComplete: (payment: Payment) => void;
  onCancel: (payment: Payment) => void;
  onReceipt: (payment: Payment) => void;
  onPdf: (payment: Payment) => void;
  onSendReceipt: (payment: Payment) => void;
  onChequeStatus: (payment: Payment) => void;
}) => {
  if (!loading && !data?.items.length) {
    return <EmptyState title="No payments found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <div className="overflow-x-auto">
          <Table>
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["Payment No", "Date", "Type", "Party", "Mode", "Amount", "Allocated", "Advance", "Status", "Actions"].map((head) => (
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
                      {Array.from({ length: 10 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-4">
                          <div className="h-4 rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.items.map((payment) => {
                    const canComplete =
                      payment.status === "draft" &&
                      canUpdate &&
                      ((payment.paymentType === "customer_receive" && canCompleteCustomer) ||
                        (payment.paymentType === "supplier_pay" && canCompleteSupplier));

                    return (
                      <tr key={payment.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-medium text-slate-900">{payment.paymentNumber}</td>
                        <td className="px-4 py-4 whitespace-nowrap">{formatDate(payment.paymentDate)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">{PAYMENT_TYPE_LABELS[payment.paymentType]}</td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{payment.party?.name ?? "-"}</p>
                            <p className="text-xs text-slate-500">{payment.referenceNumber || payment.receiptNumber || "-"}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">{PAYMENT_MODE_LABELS[payment.paymentMode]}</td>
                        <td className="px-4 py-4 whitespace-nowrap"><AmountText value={payment.amount} /></td>
                        <td className="px-4 py-4 whitespace-nowrap"><AmountText value={payment.allocatedAmount} /></td>
                        <td className="px-4 py-4 whitespace-nowrap"><AmountText value={payment.unallocatedAmount} tone="warning" /></td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <TableActionIconButton label="View payment" icon={<Eye className="size-4" />} onClick={() => onView(payment)} />
                            {canUpdate && payment.status === "draft" ? (
                              <TableActionIconButton label="Edit draft" icon={<Pencil className="size-4" />} onClick={() => onEdit(payment)} />
                            ) : null}
                            {canComplete ? (
                              <TableActionIconButton label="Complete payment" icon={<CheckCircle2 className="size-4" />} onClick={() => onComplete(payment)} />
                            ) : null}
                            {canCancel && payment.status !== "cancelled" && payment.status !== "reversed" && payment.status !== "bounced" ? (
                              <TableActionIconButton label="Cancel payment" icon={<XCircle className="size-4" />} onClick={() => onCancel(payment)} />
                            ) : null}
                            {canReceiptPrint && payment.status === "completed" ? (
                              <>
                                <TableActionIconButton label="View receipt" icon={<FileText className="size-4" />} onClick={() => onReceipt(payment)} />
                                <TableActionIconButton label="Print receipt" icon={<FileDown className="size-4" />} onClick={() => onPdf(payment)} />
                                <TableActionIconButton label="Send receipt" icon={<Mail className="size-4" />} onClick={() => onSendReceipt(payment)} />
                              </>
                            ) : null}
                            {canChequeUpdate && payment.paymentMode === "cheque" ? (
                              <TableActionIconButton label="Update cheque status" icon={<BadgeCheck className="size-4" />} onClick={() => onChequeStatus(payment)} />
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
            Showing {data.items.length} of {data.pagination.total} payments
          </p>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
