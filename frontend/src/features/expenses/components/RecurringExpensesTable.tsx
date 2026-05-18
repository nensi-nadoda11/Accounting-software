import { Pause, Pencil, Play, RefreshCw } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { RecurringExpense, RecurringExpenseListResponse } from "../../../types/expense";
import { EXPENSE_PAYMENT_MODE_LABELS, RECURRING_FREQUENCY_LABELS, RECURRING_STATUS_LABELS } from "../expenseOptions";

export const RecurringExpensesTable = ({
  data,
  loading,
  canManage,
  onPageChange,
  onEdit,
  onRun,
  onToggleStatus,
}: {
  data: RecurringExpenseListResponse | null;
  loading: boolean;
  canManage: boolean;
  onPageChange: (page: number) => void;
  onEdit: (item: RecurringExpense) => void;
  onRun: (item: RecurringExpense) => void;
  onToggleStatus: (item: RecurringExpense) => void;
}) => {
  if (loading) {
    return <LoadingState label="Loading recurring expenses..." />;
  }

  if (!data?.items.length) {
    return <EmptyState title="No recurring templates found." />;
  }

  return (
    <div className="space-y-4">
      <TableWrapper>
        <Table>
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Template Name", "Category", "Frequency", "Amount", "Next Run", "Status", "Actions"].map((head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {data.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <div className="min-w-[160px]">
                    <p className="font-medium text-slate-900">{item.templateName}</p>
                    <p className="text-xs text-slate-500">{item.payeeName ?? item.description}</p>
                  </div>
                </td>
                <td className="px-4 py-3">{item.categoryName ?? "-"}</td>
                <td className="px-4 py-3">
                  <div>
                    <p>{RECURRING_FREQUENCY_LABELS[item.frequency]}</p>
                    <p className="text-xs text-slate-500">{EXPENSE_PAYMENT_MODE_LABELS[item.paymentMode]}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <AmountText value={item.amount} />
                </td>
                <td className="px-4 py-3">{item.nextRunDate.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.status} label={RECURRING_STATUS_LABELS[item.status]} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <TableActionIconButton
                      label="Edit recurring template"
                      icon={<Pencil className="size-4" />}
                      onClick={() => onEdit(item)}
                      disabled={!canManage}
                    />
                    <TableActionIconButton
                      label="Run now"
                      icon={<Play className="size-4" />}
                      onClick={() => onRun(item)}
                      disabled={!canManage || item.status === "cancelled" || item.status === "completed"}
                    />
                    <TableActionIconButton
                      label={item.status === "paused" ? "Activate recurring template" : "Pause recurring template"}
                      icon={item.status === "paused" ? <RefreshCw className="size-4" /> : <Pause className="size-4" />}
                      onClick={() => onToggleStatus(item)}
                      disabled={!canManage || item.status === "completed" || item.status === "cancelled"}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>

      <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
    </div>
  );
};
