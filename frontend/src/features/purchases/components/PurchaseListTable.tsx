import {
  CheckCircle2,
  Eye,
  FileText,
  Pencil,
  RotateCcw,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import { formatDate } from "../../customers/customerUtils";
import { PURCHASE_PAYMENT_STATUS_LABELS, PURCHASE_STATUS_LABELS } from "../purchaseOptions";
import {
  canAddPayment,
  canCancelPurchase,
  canDeletePurchase,
  canCreateReturn,
  canEditPurchase,
  canPostPurchase,
} from "../purchaseUtils";
import type { PurchaseInvoiceListItem, PurchaseListResponse } from "../../../types/purchase";

export const PurchaseListTable = ({
  data,
  loading,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  onPost,
  onCancel,
  onPayment,
  onReturn,
  onPdf,
  canUpdate,
  canDelete,
  canApprove,
  canPaymentManage,
  canReturnManage,
  canExport,
}: {
  data: PurchaseListResponse | null;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onView: (invoice: PurchaseInvoiceListItem) => void;
  onEdit: (invoice: PurchaseInvoiceListItem) => void;
  onDelete: (invoice: PurchaseInvoiceListItem) => void;
  onPost: (invoice: PurchaseInvoiceListItem) => void;
  onCancel: (invoice: PurchaseInvoiceListItem) => void;
  onPayment: (invoice: PurchaseInvoiceListItem) => void;
  onReturn: (invoice: PurchaseInvoiceListItem) => void;
  onPdf: (invoice: PurchaseInvoiceListItem) => void;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canPaymentManage: boolean;
  canReturnManage: boolean;
  canExport: boolean;
}) => {
  if (!loading && !data?.items.length) {
    return <EmptyState title="No purchase invoices found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <div className="overflow-x-auto">
          <Table>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Purchase No", "Supplier", "Invoice Date", "Grand Total", "Paid", "Due", "GST", "Status", "Payment", "Actions"].map((head) => (
                  <th key={head} className="px-4 py-3 font-semibold">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
              {loading && !data ? (
                Array.from({ length: 8 }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="animate-pulse">
                    {Array.from({ length: 10 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-4 rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                data?.items.map((invoice) => (
                  <tr key={invoice.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{invoice.purchaseNumber}</td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{invoice.supplier.name}</p>
                        {invoice.supplierInvoiceNumber ? <p className="text-xs text-slate-500">{invoice.supplierInvoiceNumber}</p> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDate(invoice.invoiceDate)}</td>
                    <td className="px-4 py-4 whitespace-nowrap"><AmountText value={invoice.grandTotal} /></td>
                    <td className="px-4 py-4 whitespace-nowrap"><AmountText value={invoice.paidAmount} /></td>
                    <td className="px-4 py-4 whitespace-nowrap"><AmountText value={invoice.dueAmount} tone="danger" /></td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-400">-</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <StatusBadge status={invoice.purchaseStatus} label={PURCHASE_STATUS_LABELS[invoice.purchaseStatus]} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <StatusBadge status={invoice.paymentStatus} label={PURCHASE_PAYMENT_STATUS_LABELS[invoice.paymentStatus]} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <TableActionIconButton label="View invoice" icon={<Eye className="size-4" />} onClick={() => onView(invoice)} />
                        {canUpdate && canEditPurchase(invoice) ? (
                          <TableActionIconButton label="Edit draft" icon={<Pencil className="size-4" />} onClick={() => onEdit(invoice)} />
                        ) : null}
                        {canDelete && canDeletePurchase(invoice) ? (
                          <TableActionIconButton
                            label="Delete draft"
                            tone="danger"
                            icon={<Trash2 className="size-4" />}
                            onClick={() => onDelete(invoice)}
                          />
                        ) : null}
                        {canApprove && canPostPurchase(invoice) ? (
                          <TableActionIconButton label="Post invoice" icon={<CheckCircle2 className="size-4" />} onClick={() => onPost(invoice)} />
                        ) : null}
                        {canApprove && canCancelPurchase(invoice) ? (
                          <TableActionIconButton label="Cancel invoice" icon={<XCircle className="size-4" />} onClick={() => onCancel(invoice)} />
                        ) : null}
                        {canPaymentManage && canAddPayment(invoice) ? (
                          <TableActionIconButton label="Record payment" icon={<Wallet className="size-4" />} onClick={() => onPayment(invoice)} />
                        ) : null}
                        {canReturnManage && canCreateReturn(invoice) ? (
                          <TableActionIconButton label="Create return" icon={<RotateCcw className="size-4" />} onClick={() => onReturn(invoice)} />
                        ) : null}
                        {canExport ? (
                          <TableActionIconButton label="Download PDF" icon={<FileText className="size-4" />} onClick={() => onPdf(invoice)} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </TableWrapper>
      {data?.pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-4">
          <p className="text-sm text-slate-500">
            Showing {data.items.length} of {data.pagination.total} invoices
          </p>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
