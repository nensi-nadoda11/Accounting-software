import {
  CheckCircle2,
  Eye,
  FileText,
  Mail,
  MessageCircle,
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
import type { SalesInvoiceListItem, SalesListResponse } from "../../../types/sales";
import {
  SALES_INVOICE_TYPE_LABELS,
  SALES_PAYMENT_STATUS_LABELS,
  SALES_STATUS_LABELS,
} from "../salesOptions";
import {
  canAddPayment,
  canCancelSales,
  canCreateReturn,
  canDeleteSales,
  canEditSales,
  canPostSales,
} from "../salesUtils";

export const SalesListTable = ({
  data,
  loading,
  canUpdate,
  canDelete,
  canPost,
  canPaymentManage,
  canReturnManage,
  canSend,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  onPost,
  onCancel,
  onPayment,
  onReturn,
  onPdf,
  onEmail,
  onWhatsapp,
}: {
  data: SalesListResponse | null;
  loading?: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canPost: boolean;
  canPaymentManage: boolean;
  canReturnManage: boolean;
  canSend: boolean;
  onPageChange: (page: number) => void;
  onView: (invoice: SalesInvoiceListItem) => void;
  onEdit: (invoice: SalesInvoiceListItem) => void;
  onDelete: (invoice: SalesInvoiceListItem) => void;
  onPost: (invoice: SalesInvoiceListItem) => void;
  onCancel: (invoice: SalesInvoiceListItem) => void;
  onPayment: (invoice: SalesInvoiceListItem) => void;
  onReturn: (invoice: SalesInvoiceListItem) => void;
  onPdf: (invoice: SalesInvoiceListItem) => void;
  onEmail: (invoice: SalesInvoiceListItem) => void;
  onWhatsapp: (invoice: SalesInvoiceListItem) => void;
}) => {
  if (!loading && !data?.items.length) {
    return <EmptyState title="No sales invoices found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <div className="overflow-x-auto">
          <Table>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {[
                  "Invoice No",
                  "Customer",
                  "Date",
                  "Type",
                  "Grand Total",
                  "Paid",
                  "Due",
                  "GST",
                  "Invoice Status",
                  "Payment Status",
                  "Actions",
                ].map((head) => (
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
                      {Array.from({ length: 11 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-4">
                          <div className="h-4 rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.items.map((invoice) => (
                      <tr key={invoice.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-4 font-medium text-slate-900">{invoice.invoiceNumber}</td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <p className="font-medium text-slate-900">{invoice.customerName || invoice.walkInName || "Walk-in Customer"}</p>
                            <p className="text-xs text-slate-500">{invoice.warehouse.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">{formatDate(invoice.invoiceDate)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">{SALES_INVOICE_TYPE_LABELS[invoice.invoiceType]}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <AmountText value={invoice.grandTotal} />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <AmountText value={invoice.paidAmount} />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <AmountText value={invoice.dueAmount} tone="danger" />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-400">-</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <StatusBadge status={invoice.invoiceStatus} label={SALES_STATUS_LABELS[invoice.invoiceStatus]} />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <StatusBadge status={invoice.paymentStatus} label={SALES_PAYMENT_STATUS_LABELS[invoice.paymentStatus]} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <TableActionIconButton label="View invoice" icon={<Eye className="size-4" />} onClick={() => onView(invoice)} />
                            {canUpdate && canEditSales(invoice) ? (
                              <TableActionIconButton label="Edit draft" icon={<Pencil className="size-4" />} onClick={() => onEdit(invoice)} />
                            ) : null}
                            {canDelete && canDeleteSales(invoice) ? (
                              <TableActionIconButton label="Delete draft" tone="danger" icon={<Trash2 className="size-4" />} onClick={() => onDelete(invoice)} />
                            ) : null}
                            {canPost && canPostSales(invoice) ? (
                              <TableActionIconButton label="Post invoice" icon={<CheckCircle2 className="size-4" />} onClick={() => onPost(invoice)} />
                            ) : null}
                            {canPost && canCancelSales(invoice) ? (
                              <TableActionIconButton label="Cancel invoice" icon={<XCircle className="size-4" />} onClick={() => onCancel(invoice)} />
                            ) : null}
                            {canPaymentManage && canAddPayment(invoice) ? (
                              <TableActionIconButton label="Add payment" icon={<Wallet className="size-4" />} onClick={() => onPayment(invoice)} />
                            ) : null}
                            {canReturnManage && canCreateReturn(invoice) ? (
                              <TableActionIconButton label="Create return" icon={<RotateCcw className="size-4" />} onClick={() => onReturn(invoice)} />
                            ) : null}
                            <TableActionIconButton label="PDF / Print" icon={<FileText className="size-4" />} onClick={() => onPdf(invoice)} />
                            {canSend ? (
                              <>
                                <TableActionIconButton label="Send email" icon={<Mail className="size-4" />} onClick={() => onEmail(invoice)} />
                                <TableActionIconButton label="Send WhatsApp" icon={<MessageCircle className="size-4" />} onClick={() => onWhatsapp(invoice)} />
                              </>
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
            Showing {data.items.length} of {data.pagination.total} invoices
          </p>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
