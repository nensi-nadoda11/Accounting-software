import { Card, CardContent } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { SideSheet } from "../../../components/ui/SideSheet";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { PayrollItem, PayrollRunDetailResponse } from "../../../types/payroll";
import { formatDate, formatDateTime } from "../../customers/customerUtils";
import { PayrollItemsTable } from "./PayrollItemsTable";

export const PayrollRunDrawer = ({
  open,
  detail,
  loading,
  canPay,
  canAdjust,
  canPrint,
  onClose,
  onPayItem,
  onAdjustItem,
  onSlip,
  onPdf,
  onEmail,
}: {
  open: boolean;
  detail: PayrollRunDetailResponse | null;
  loading: boolean;
  canPay: boolean;
  canAdjust: boolean;
  canPrint: boolean;
  onClose: () => void;
  onPayItem: (item: PayrollItem) => void;
  onAdjustItem: (item: PayrollItem) => void;
  onSlip: (item: PayrollItem) => void;
  onPdf: (item: PayrollItem) => void;
  onEmail: (item: PayrollItem) => void;
}) => {
  const paymentSummary = detail?.items.reduce(
    (summary, item) => {
      summary[item.paymentStatus] += 1;
      return summary;
    },
    { unpaid: 0, partial: 0, paid: 0 },
  );

  return (
    <SideSheet open={open} onClose={onClose} title={detail ? `Payroll Run · ${detail.run.runNumber}` : "Payroll Run"}>
      {loading ? (
        <LoadingState label="Loading payroll run..." />
      ) : !detail ? (
        <EmptyState title="Payroll run details are not available." />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Payroll Month</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{detail.run.payrollMonth}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Period</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDate(detail.run.periodStart)} to {formatDate(detail.run.periodEnd)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-1">
                  <StatusBadge status={detail.run.status} label={detail.run.status} />
                </div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Accounting Event</p>
                <div className="mt-1">
                  <StatusBadge
                    status={detail.run.accountingEventCreated ? "posted" : "draft"}
                    label={detail.run.accountingEventCreated ? "Created" : "Pending"}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Gross Total</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{detail.run.grossTotal}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Deductions</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{detail.run.deductionTotal}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Net Payable</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{detail.run.netPayableTotal}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Paid Total</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{detail.run.paidTotal}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Unpaid Employees</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{paymentSummary?.unpaid ?? 0}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Partial Payments</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{paymentSummary?.partial ?? 0}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Paid Employees</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{paymentSummary?.paid ?? 0}</p>
              </div>
            </CardContent>
          </Card>

          <PayrollItemsTable
            items={detail.items}
            canPay={canPay}
            canAdjust={canAdjust}
            canPrint={canPrint}
            onPay={onPayItem}
            onAdjust={onAdjustItem}
            onSlip={onSlip}
            onPdf={onPdf}
            onEmail={onEmail}
          />

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Payment Activity</h3>
                <p className="text-xs text-slate-500">{detail.payments.length} entries</p>
              </div>
              {detail.payments.length === 0 ? (
                <p className="text-sm text-slate-500">No payment activity recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.payments.slice(0, 8).map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{payment.amount}</p>
                        <p className="text-xs text-slate-500">
                          {payment.paymentMode} · {payment.referenceNumber || "No reference"}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">{formatDateTime(payment.paymentDate)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </SideSheet>
  );
};
