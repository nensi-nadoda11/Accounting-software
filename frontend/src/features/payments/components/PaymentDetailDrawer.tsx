import { BadgeCheck, CheckCircle2, FileDown, FileText, Mail, Pencil, XCircle } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { LoadingState } from "../../../components/ui/LoadingState";
import { SideSheet } from "../../../components/ui/SideSheet";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { formatDate, formatDateTime } from "../../customers/customerUtils";
import type { Payment } from "../../../types/payment";
import {
  CHEQUE_STATUS_LABELS,
  PAYMENT_ALLOCATION_STATUS_LABELS,
  PAYMENT_MODE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from "../paymentOptions";

export const PaymentDetailDrawer = ({
  open,
  payment,
  loading,
  canUpdate,
  canCancel,
  canReceipt,
  canChequeUpdate,
  canCompleteCustomer,
  canCompleteSupplier,
  onClose,
  onEdit,
  onComplete,
  onCancel,
  onReceipt,
  onPdf,
  onSendReceipt,
  onChequeStatus,
}: {
  open: boolean;
  payment: Payment | null;
  loading?: boolean;
  canUpdate: boolean;
  canCancel: boolean;
  canReceipt: boolean;
  canChequeUpdate: boolean;
  canCompleteCustomer: boolean;
  canCompleteSupplier: boolean;
  onClose: () => void;
  onEdit: (payment: Payment) => void;
  onComplete: (payment: Payment) => void;
  onCancel: (payment: Payment) => void;
  onReceipt: (payment: Payment) => void;
  onPdf: (payment: Payment) => void;
  onSendReceipt: (payment: Payment) => void;
  onChequeStatus: (payment: Payment) => void;
}) => {
  const canComplete =
    payment &&
    payment.status === "draft" &&
    canUpdate &&
    ((payment.paymentType === "customer_receive" && canCompleteCustomer) ||
      (payment.paymentType === "supplier_pay" && canCompleteSupplier));

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={payment ? payment.paymentNumber : "Payment Detail"}
      className="max-w-3xl"
      footer={
        payment ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            {canUpdate && payment.status === "draft" ? (
              <Button type="button" variant="secondary" onClick={() => onEdit(payment)}>
                <Pencil className="mr-2 size-4" />
                Edit Draft
              </Button>
            ) : null}
            {canComplete ? (
              <Button type="button" onClick={() => onComplete(payment)}>
                <CheckCircle2 className="mr-2 size-4" />
                Complete
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      {loading && !payment ? (
        <LoadingState label="Loading payment..." />
      ) : payment ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Party</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{payment.party?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Type</p>
                <p className="mt-1 text-sm text-slate-700">{PAYMENT_TYPE_LABELS[payment.paymentType]}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Date</p>
                <p className="mt-1 text-sm text-slate-700">{formatDate(payment.paymentDate)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Amount</p>
                <div className="mt-1"><AmountText value={payment.amount} /></div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Allocated</p>
                <div className="mt-1"><AmountText value={payment.allocatedAmount} /></div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Advance</p>
                <div className="mt-1"><AmountText value={payment.unallocatedAmount} tone="warning" /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Payment Info" />
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Mode</p>
                <p className="mt-1 text-sm text-slate-700">{PAYMENT_MODE_LABELS[payment.paymentMode]}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Reference</p>
                <p className="mt-1 text-sm text-slate-700">{payment.referenceNumber ?? "-"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
                  <StatusBadge
                    status={payment.paymentAllocationStatus}
                    label={PAYMENT_ALLOCATION_STATUS_LABELS[payment.paymentAllocationStatus]}
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Receipt</p>
                <p className="mt-1 text-sm text-slate-700">{payment.receipt?.receiptNumber ?? payment.receiptNumber ?? "-"}</p>
              </div>
              {payment.notes ? (
                <div className="sm:col-span-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Notes</p>
                  <p className="mt-1 text-sm text-slate-700">{payment.notes}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Allocations" />
            <CardContent className="space-y-2">
              {payment.allocations?.length ? (
                payment.allocations.map((allocation) => (
                  <div key={allocation.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{allocation.referenceNumber ?? "-"}</p>
                      <p className="text-xs text-slate-500">{formatDate(allocation.allocationDate)}</p>
                    </div>
                    <AmountText value={allocation.allocatedAmount} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No allocations linked.</p>
              )}
            </CardContent>
          </Card>

          {payment.paymentMode === "cheque" ? (
            <Card>
              <CardHeader title="Cheque Info" />
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Cheque Number</p>
                  <p className="mt-1 text-sm text-slate-700">{payment.chequeNumber ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Cheque Date</p>
                  <p className="mt-1 text-sm text-slate-700">{formatDate(payment.chequeDate)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Bank Name</p>
                  <p className="mt-1 text-sm text-slate-700">{payment.chequeBankName ?? "-"}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Cheque Status</p>
                  <div className="mt-1">
                    <StatusBadge status={payment.chequeStatus ?? "pending"} label={payment.chequeStatus ? CHEQUE_STATUS_LABELS[payment.chequeStatus] : "Pending"} />
                  </div>
                </div>
                {payment.chequeTransactions?.length ? (
                  <div className="sm:col-span-2">
                    <div className="space-y-2">
                      {payment.chequeTransactions.map((transaction) => (
                        <div key={transaction.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <StatusBadge status={transaction.status} label={CHEQUE_STATUS_LABELS[transaction.status]} />
                            <p className="text-xs text-slate-500">{formatDateTime(transaction.statusDate)}</p>
                          </div>
                          {transaction.remarks ? <p className="mt-2 text-sm text-slate-600">{transaction.remarks}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {canCancel && payment.status !== "cancelled" && payment.status !== "reversed" && payment.status !== "bounced" ? (
              <Button type="button" variant="danger" onClick={() => onCancel(payment)}>
                <XCircle className="mr-2 size-4" />
                Cancel
              </Button>
            ) : null}
            {canReceipt && payment.status === "completed" ? (
              <>
                <Button type="button" variant="secondary" onClick={() => onReceipt(payment)}>
                  <FileText className="mr-2 size-4" />
                  Receipt
                </Button>
                <Button type="button" variant="secondary" onClick={() => onPdf(payment)}>
                  <FileDown className="mr-2 size-4" />
                  PDF
                </Button>
                <Button type="button" variant="secondary" onClick={() => onSendReceipt(payment)}>
                  <Mail className="mr-2 size-4" />
                  Send
                </Button>
              </>
            ) : null}
            {canChequeUpdate && payment.paymentMode === "cheque" ? (
              <Button type="button" variant="secondary" onClick={() => onChequeStatus(payment)}>
                <BadgeCheck className="mr-2 size-4" />
                Cheque Status
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </SideSheet>
  );
};
