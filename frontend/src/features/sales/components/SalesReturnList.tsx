import { Eye, Plus, Wallet } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import { formatDate } from "../../customers/customerUtils";
import type { SalesReturn, SalesReturnsResponse } from "../../../types/sales";

export const SalesReturnList = ({
  data,
  loading,
  canCreate,
  canManageRefund,
  onCreate,
  onRefund,
  onView,
  onPageChange,
}: {
  data: SalesReturnsResponse | null;
  loading?: boolean;
  canCreate: boolean;
  canManageRefund: boolean;
  onCreate: () => void;
  onRefund: (salesReturn: SalesReturn) => void;
  onView: (salesReturn: SalesReturn) => void;
  onPageChange: (page: number) => void;
}) => {
  const totalPending =
    data ? data.items.reduce((sum, item) => sum + Number(item.remainingRefundAmount), 0) : 0;

  if (!loading && !data?.items.length) {
    return (
      <EmptyState
        title="No sales returns found"
        action={
          canCreate ? (
            <Button type="button" onClick={onCreate}>
              <Plus className="mr-2 size-4" />
              New Return
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <div className="overflow-x-auto">
          <Table>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {["Return No", "Invoice No", "Customer", "Date", "Grand Total", "Adjusted", "Paid", "Pending", "Actions"].map((head) => (
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
                      {Array.from({ length: 9 }).map((__, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-4">
                          <div className="h-4 rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.items.map((salesReturn) => (
                    <tr key={salesReturn.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-4 font-medium text-slate-900">{salesReturn.returnNumber}</td>
                      <td className="px-4 py-4">{salesReturn.invoiceNumber}</td>
                      <td className="px-4 py-4">{salesReturn.customerName || "Walk-in Customer"}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDate(salesReturn.returnDate)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <AmountText value={salesReturn.grandTotal} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap"><AmountText value={salesReturn.adjustedAmount} tone="warning" /></td>
                      <td className="px-4 py-4 whitespace-nowrap"><AmountText value={salesReturn.refundedAmount} tone="success" /></td>
                      <td className="px-4 py-4 whitespace-nowrap"><AmountText value={salesReturn.remainingRefundAmount} tone="danger" /></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <TableActionIconButton label="View return" icon={<Eye className="size-4" />} onClick={() => onView(salesReturn)} />
                          {canManageRefund && Number(salesReturn.remainingRefundAmount) > 0 ? (
                            <TableActionIconButton label="Add refund entry" icon={<Wallet className="size-4" />} onClick={() => onRefund(salesReturn)} />
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
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <p>Showing {data.items.length} of {data.pagination.total} returns</p>
            <p>Total Return: {Number(data.summary.grandTotal).toFixed(2)}</p>
            <p>Refund Paid: {Number(data.summary.refundedAmount).toFixed(2)}</p>
            <p>Refund Pending: {totalPending.toFixed(2)}</p>
          </div>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
