import {
  CheckCircle2,
  FileText,
  Mail,
  MessageCircle,
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
import { formatAddress, formatDate, formatDateTime } from "../../customers/customerUtils";
import type { SalesInvoice } from "../../../types/sales";
import {
  SALES_INVOICE_TYPE_LABELS,
  SALES_PAYMENT_STATUS_LABELS,
  SALES_STATUS_LABELS,
} from "../salesOptions";
import {
  canAddPayment,
  canCancelSales,
  canCreateReturn,
  canEditSales,
  canPostSales,
  formatQty,
} from "../salesUtils";

export const SalesDetailDrawer = ({
  open,
  invoice,
  loading,
  canUpdate,
  canPost,
  canPaymentManage,
  canReturnManage,
  canSend,
  onClose,
  onEdit,
  onPost,
  onCancel,
  onPayment,
  onReturn,
  onPdf,
  onEmail,
  onWhatsapp,
}: {
  open: boolean;
  invoice: SalesInvoice | null;
  loading?: boolean;
  canUpdate: boolean;
  canPost: boolean;
  canPaymentManage: boolean;
  canReturnManage: boolean;
  canSend: boolean;
  onClose: () => void;
  onEdit: (invoice: SalesInvoice) => void;
  onPost: (invoice: SalesInvoice) => void;
  onCancel: (invoice: SalesInvoice) => void;
  onPayment: (invoice: SalesInvoice) => void;
  onReturn: (invoice: SalesInvoice) => void;
  onPdf: (invoice: SalesInvoice) => void;
  onEmail: (invoice: SalesInvoice) => void;
  onWhatsapp: (invoice: SalesInvoice) => void;
}) => (
  <SideSheet
    open={open}
    onClose={onClose}
    title={invoice ? invoice.invoiceNumber : "Sales Detail"}
    className="max-w-5xl"
    footer={
      invoice ? (
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canUpdate && canEditSales(invoice) ? (
            <Button type="button" variant="secondary" onClick={() => onEdit(invoice)}>
              <Pencil className="mr-2 size-4" />
              Edit Draft
            </Button>
          ) : null}
          {canPost && canPostSales(invoice) ? (
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
          {canPost && canCancelSales(invoice) ? (
            <Button type="button" variant="secondary" onClick={() => onCancel(invoice)}>
              <XCircle className="mr-2 size-4" />
              Cancel
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => onPdf(invoice)}>
            <FileText className="mr-2 size-4" />
            PDF / Print
          </Button>
          {canSend ? (
            <>
              <Button type="button" variant="secondary" onClick={() => onEmail(invoice)}>
                <Mail className="mr-2 size-4" />
                Email
              </Button>
              <Button type="button" variant="secondary" onClick={() => onWhatsapp(invoice)}>
                <MessageCircle className="mr-2 size-4" />
                WhatsApp
              </Button>
            </>
          ) : null}
        </>
      ) : undefined
    }
  >
    {loading && !invoice ? (
      <LoadingState label="Loading sales invoice..." />
    ) : invoice ? (
      <div className="space-y-5">
        <Card>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Customer</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {invoice.customer?.name ?? invoice.walkInName ?? "Walk-in Customer"}
              </p>
              <p className="mt-1 text-xs text-slate-500">{invoice.customer?.mobile ?? invoice.walkInMobile ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Warehouse</p>
              <p className="mt-1 text-sm text-slate-900">{invoice.warehouse?.name ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Invoice Date</p>
              <p className="mt-1 text-sm text-slate-900">{formatDate(invoice.invoiceDate)}</p>
            </div>
            <div className="space-y-2">
              <StatusBadge status={invoice.invoiceStatus} label={SALES_STATUS_LABELS[invoice.invoiceStatus]} />
              <StatusBadge status={invoice.paymentStatus} label={SALES_PAYMENT_STATUS_LABELS[invoice.paymentStatus]} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Header" />
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Invoice Type</p>
              <p className="mt-1 text-sm text-slate-900">{SALES_INVOICE_TYPE_LABELS[invoice.invoiceType]}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Place of Supply</p>
              <p className="mt-1 text-sm text-slate-900">{invoice.placeOfSupply}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Due Date</p>
              <p className="mt-1 text-sm text-slate-900">{invoice.dueDate ? formatDate(invoice.dueDate) : "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Billing Address</p>
              <p className="mt-1 text-sm text-slate-900">
                {formatAddress([
                  invoice.billingAddressSnapshot?.line1,
                  invoice.billingAddressSnapshot?.line2,
                  invoice.billingAddressSnapshot?.city,
                  invoice.billingAddressSnapshot?.state,
                ])}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Shipping Address</p>
              <p className="mt-1 text-sm text-slate-900">
                {formatAddress([
                  invoice.shippingAddressSnapshot?.line1,
                  invoice.shippingAddressSnapshot?.line2,
                  invoice.shippingAddressSnapshot?.city,
                  invoice.shippingAddressSnapshot?.state,
                ])}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Notes</p>
              <p className="mt-1 text-sm text-slate-900">{invoice.notes || "-"}</p>
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
                    {["Product", "Qty", "Rate", "MRP", "Taxable", "GST", "Total"].map((head) => (
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
                      <td className="px-4 py-4 whitespace-nowrap">
                        <AmountText value={item.saleRate} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <AmountText value={item.mrp} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <AmountText value={item.taxableAmount} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <AmountText value={Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount) + Number(item.cessAmount)} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <AmountText value={item.lineTotal} />
                      </td>
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
              <div className="flex items-center justify-between"><span>Posted</span><span className="text-slate-900">{invoice.postedAt ? formatDateTime(invoice.postedAt) : "-"}</span></div>
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

        {invoice.sendLogs?.length ? (
          <Card>
            <CardHeader title="Send Logs" />
            <CardContent className="space-y-3">
              {invoice.sendLogs.map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{log.channel.toUpperCase()} · {log.sentTo}</p>
                    <p className="text-xs text-slate-500">{log.sentAt ? formatDateTime(log.sentAt) : log.errorMessage ?? "Pending"}</p>
                  </div>
                  <StatusBadge status={log.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    ) : null}
  </SideSheet>
);
