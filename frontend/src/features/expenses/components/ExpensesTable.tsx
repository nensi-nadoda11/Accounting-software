import { CheckCircle2, Eye, FileText, Paperclip, Pencil, Trash2, XCircle } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { ExpenseListResponse } from "../../../types/expense";
import { EXPENSE_PAYMENT_MODE_LABELS, EXPENSE_STATUS_LABELS } from "../expenseOptions";

export const ExpensesTable = ({
  data,
  loading,
  onPageChange,
  onView,
  onEdit,
  onPost,
  onCancel,
  onDelete,
  onAttachments,
  onPrint,
  canUpdate,
  canPost,
  canDelete,
}: {
  data: ExpenseListResponse | null;
  loading: boolean;
  onPageChange: (page: number) => void;
  onView: (expenseId: string) => void;
  onEdit: (expenseId: string) => void;
  onPost: (expenseId: string) => void;
  onCancel: (expenseId: string) => void;
  onDelete: (expenseId: string) => void;
  onAttachments: (expenseId: string) => void;
  onPrint: (expenseId: string) => void;
  canUpdate: boolean;
  canPost: boolean;
  canDelete: boolean;
}) => {
  if (loading) {
    return <LoadingState label="Loading expenses..." />;
  }

  if (!data?.items.length) {
    return <EmptyState title="No expenses found." />;
  }

  return (
    <div className="space-y-4">
      <TableWrapper>
        <Table>
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Expense No", "Date", "Category", "Payee", "Amount", "GST", "Payment Mode", "Status", "Actions"].map((head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {data.items.map((item) => {
              const isDraft = item.status === "draft";
              const isPosted = item.status === "posted";

              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.expenseNumber}</td>
                  <td className="px-4 py-3">{item.expenseDate.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="min-w-[140px]">
                      <p className="font-medium text-slate-900">{item.category.name}</p>
                      <p className="text-xs text-slate-500">{item.category.categoryCode}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{item.payeeName ?? "-"}</td>
                  <td className="px-4 py-3">
                    <AmountText value={item.totalAmount} />
                  </td>
                  <td className="px-4 py-3">
                    <AmountText value={item.gstAmount} />
                  </td>
                  <td className="px-4 py-3">{EXPENSE_PAYMENT_MODE_LABELS[item.paymentMode]}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} label={EXPENSE_STATUS_LABELS[item.status]} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <TableActionIconButton label="View expense" icon={<Eye className="size-4" />} onClick={() => onView(item.id)} />
                      <TableActionIconButton label="Edit draft" icon={<Pencil className="size-4" />} onClick={() => onEdit(item.id)} disabled={!canUpdate || !isDraft} />
                      <TableActionIconButton
                        label="Post expense"
                        icon={<CheckCircle2 className="size-4" />}
                        onClick={() => onPost(item.id)}
                        disabled={!canPost || !isDraft}
                      />
                      <TableActionIconButton
                        label="Cancel expense"
                        icon={<XCircle className="size-4" />}
                        onClick={() => onCancel(item.id)}
                        disabled={!canPost || !isPosted}
                        tone="danger"
                      />
                      <TableActionIconButton label="Attachments" icon={<Paperclip className="size-4" />} onClick={() => onAttachments(item.id)} />
                      <TableActionIconButton label="Print / PDF" icon={<FileText className="size-4" />} onClick={() => onPrint(item.id)} />
                      <TableActionIconButton
                        label="Delete draft"
                        icon={<Trash2 className="size-4" />}
                        onClick={() => onDelete(item.id)}
                        disabled={!canDelete || !isDraft}
                        tone="danger"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrapper>

      <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
    </div>
  );
};
