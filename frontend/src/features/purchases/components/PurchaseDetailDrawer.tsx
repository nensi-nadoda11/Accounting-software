import { CheckCircle2, FileText, Pencil, RotateCcw, Wallet, XCircle } from "lucide-react";

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
import { canAddPayment, canCancelPurchase, canCreateReturn, canEditPurchase, canPostPurchase, formatQty } from "../purchaseUtils";

type SummaryRow = {
  label: string;
  value: string | number;
  tone?: "default" | "danger";
  span?: string;
  emphasized?: boolean;
};

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
}) => {
  if (loading && !invoice) {
    return (
      <SideSheet open={open} onClose={onClose} title="Purchase Detail" className="max-w-5xl">
        <LoadingState label="Loading purchase..." />
      </SideSheet>
    );
  }

  if (!invoice) {
    return <SideSheet open={open} onClose={onClose} title="Purchase Detail" className="max-w-5xl" />;
  }

  const billSummaryRows: SummaryRow[] = [
    { label: "Subtotal", value: invoice.subtotal },
    { label: "Item Discount", value: invoice.itemDiscountTotal },
    { label: "Invoice Discount", value: invoice.invoiceDiscountTotal },
    { label: "Additional Charges", value: invoice.additionalCharges },
    { label: "Freight", value: invoice.freightCharges },
    { label: "Taxable", value: invoice.taxableAmount },
    { label: "CGST", value: invoice.cgstTotal },
    { label: "SGST", value: invoice.sgstTotal },
    { label: "IGST", value: invoice.igstTotal },
    { label: "Cess", value: invoice.cessTotal },
    { label: "GST Total", value: invoice.gstTotal },
    { label: "Round Off", value: invoice.roundOffAmount },
    { label: "Grand Total", value: invoice.grandTotal, emphasized: true, span: "sm:col-span-2" },
  ];

  const paymentSummaryRows: SummaryRow[] = [
    { label: "Paid", value: invoice.paidAmount },
    { label: "Due", value: invoice.dueAmount, tone: "danger" },
    { label: "Mode", value: invoice.paymentMode ?? "-" },
    { label: "Reference", value: invoice.paymentReference ?? "-" },
  ];

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={invoice.purchaseNumber}
      className="max-w-5xl"
      footer={
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
      }
    >
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
                      <td className="px-4 py-4 whitespace-nowrap">
                        <AmountText value={item.purchaseRate} />
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

        <Card>
          <CardHeader title="Bill Summary" />
          <CardContent className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
              <div>
                <p className="text-sm font-semibold text-slate-900">Tax Breakup</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {billSummaryRows.map((row) => (
                    <div
                      key={row.label}
                      className={[
                        "rounded-xl border border-slate-100 bg-slate-50 px-3 py-3",
                        row.span ?? "",
                      ].join(" ")}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                      <AmountText
                        value={row.value}
                        tone={row.tone ?? "default"}
                        className={row.emphasized ? "mt-1 text-base" : "mt-1"}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">Payment Summary</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {paymentSummaryRows.map((row) => (
                    <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                      {typeof row.value === "number" || /^-?\d+(?:\.\d+)?$/.test(String(row.value)) ? (
                        <AmountText value={row.value} tone={row.tone ?? "default"} className="mt-1" />
                      ) : (
                        <p className="mt-1 text-sm font-medium text-slate-900">{row.value}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Payments</p>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {invoice.payments?.length ? `${invoice.payments.length} record(s)` : "No payments"}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {invoice.payments?.length ? (
                  invoice.payments.map((payment) => (
                    <div key={payment.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900">{formatDate(payment.paymentDate)}</span>
                        <AmountText value={payment.amount} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{payment.referenceNumber || payment.paymentMode}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No payments yet.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SideSheet>
  );
};
