import {
  CheckCircle2,
  FileText,
  Pencil,
  RotateCcw,
  Wallet,
  XCircle,
} from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { LoadingState } from "../../../components/ui/LoadingState";
import { SideSheet } from "../../../components/ui/SideSheet";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { formatDate } from "../../customers/customerUtils";
import type { PurchaseInvoice } from "../../../types/purchase";
import { PURCHASE_PAYMENT_STATUS_LABELS, PURCHASE_STATUS_LABELS } from "../purchaseOptions";
import {
  canAddPayment,
  canCancelPurchase,
  canCreateReturn,
  canEditPurchase,
  canPostPurchase,
  formatQty,
} from "../purchaseUtils";

export const PurchaseDetailDrawer = ({
  open,
  invoice,
  loading,
  onClose,
  onEdit,
  onPost,
  onCancel,
  onPayment,
  onReturn,
  onPdf,
  canUpdate,
  canApprove,
  canPaymentManage,
  canReturnManage,
  canExport,
}: {
  open: boolean;
  invoice: PurchaseInvoice | null;
  loading?: boolean;
  onClose: () => void;
  onEdit: (invoice: PurchaseInvoice) => void;
  onPost: (invoice: PurchaseInvoice) => void;
  onCancel: (invoice: PurchaseInvoice) => void;
  onPayment: (invoice: PurchaseInvoice) => void;
  onReturn: (invoice: PurchaseInvoice) => void;
  onPdf: (invoice: PurchaseInvoice) => void;
  canUpdate: boolean;
  canApprove: boolean;
  canPaymentManage: boolean;
  canReturnManage: boolean;
  canExport: boolean;
}) => (
  <SideSheet
    open={open}
    onClose={onClose}
    title={invoice ? invoice.purchaseNumber : "Purchase Detail"}
    className="max-w-5xl"
    footer={
      invoice ? (
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canUpdate && canEditPurchase(invoice) ? (
            <Button type="button" variant="secondary" onClick={() => onEdit(invoice)}>
              <Pencil className="mr-2 size-4" />
              Edit Draft
            </Button>
          ) : null}
          {canApprove && canPostPurchase(invoice) ? (
            <Button type="button" onClick={() => onPost(invoice)}>
              <CheckCircle2 className="mr-2 size-4" />
              Post
            </Button>
          ) : null}
          {canPaymentManage && canAddPayment(invoice) ? (
            <Button type="button" variant="secondary" onClick={() => onPayment(invoice)}>
              <Wallet className="mr-2 size-4" />
              Add Payment
            </Button>
          ) : null}
          {canReturnManage && canCreateReturn(invoice) ? (
            <Button type="button" variant="secondary" onClick={() => onReturn(invoice)}>
              <RotateCcw className="mr-2 size-4" />
              Create Return
            </Button>
          ) : null}
          {canApprove && canCancelPurchase(invoice) ? (
            <Button type="button" variant="secondary" onClick={() => onCancel(invoice)}>
              <XCircle className="mr-2 size-4" />
              Cancel
            </Button>
          ) : null}
          {canExport ? (
            <Button type="button" variant="secondary" onClick={() => onPdf(invoice)}>
              <FileText className="mr-2 size-4" />
              PDF
            </Button>
          ) : null}
        </>
      ) : undefined
    }
  >
    {loading && !invoice ? (
      <LoadingState label="Loading purchase..." />
    ) : invoice ? (
      <div className="space-y-5">
        <Card>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Supplier</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{invoice.supplier.name}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Warehouse</p>
              <p className="mt-1 text-sm text-slate-900">{invoice.warehouse?.name ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Invoice Date</p>
              <p className="mt-1 text-sm text-slate-900">{formatDate(invoice.invoiceDate)}</p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <StatusBadge status={invoice.purchaseStatus} label={PURCHASE_STATUS_LABELS[invoice.purchaseStatus]} />
              <StatusBadge status={invoice.paymentStatus} label={PURCHASE_PAYMENT_STATUS_LABELS[invoice.paymentStatus]} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Items" />
          <TableWrapper className="border-none">
            <div className="overflow-x-auto">
              <Table>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {["Product", "Qty", "Free", "Rate", "Taxable", "GST", "Total"].map((head) => (
                      <th key={head} className="px-4 py-3 font-semibold">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                  {invoice.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{item.productNameSnapshot}</p>
                          <p className="text-xs text-slate-500">{item.skuSnapshot || item.unitSnapshot || "-"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatQty(item.quantity)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatQty(item.freeQuantity)}</td>
                      <td className="px-4 py-4 whitespace-nowrap"><AmountText value={item.purchaseRate} /></td>
                      <td className="px-4 py-4 whitespace-nowrap"><AmountText value={item.taxableAmount} /></td>
                      <td className="px-4 py-4 whitespace-nowrap"><AmountText value={Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount) + Number(item.cessAmount)} /></td>
                      <td className="px-4 py-4 whitespace-nowrap"><AmountText value={item.lineTotal} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </TableWrapper>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card>
            <CardHeader title="Tax Breakup" />
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Taxable</span><AmountText value={invoice.taxableAmount} /></div>
              <div className="flex items-center justify-between"><span>CGST</span><AmountText value={invoice.cgstTotal} /></div>
              <div className="flex items-center justify-between"><span>SGST</span><AmountText value={invoice.sgstTotal} /></div>
              <div className="flex items-center justify-between"><span>IGST</span><AmountText value={invoice.igstTotal} /></div>
              <div className="flex items-center justify-between"><span>Cess</span><AmountText value={invoice.cessTotal} /></div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-semibold"><span>Grand Total</span><AmountText value={invoice.grandTotal} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Payment Summary" />
            <CardContent className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Paid</span><AmountText value={invoice.paidAmount} /></div>
              <div className="flex items-center justify-between"><span>Due</span><AmountText value={invoice.dueAmount} tone="danger" /></div>
              <div className="flex items-center justify-between"><span>Mode</span><span className="text-slate-900">{invoice.paymentMode ?? "-"}</span></div>
              <div className="flex items-center justify-between"><span>Reference</span><span className="text-slate-900">{invoice.paymentReference ?? "-"}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Payments" />
            <CardContent className="space-y-2">
              {invoice.payments?.length ? (
                invoice.payments.map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-900">{formatDate(payment.paymentDate)}</span>
                      <AmountText value={payment.amount} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{payment.referenceNumber || payment.paymentMode}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No payments yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    ) : null}
  </SideSheet>
);
