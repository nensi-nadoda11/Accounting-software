import { Eye, Plus } from "lucide-react";

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
  onCreate,
  onView,
  onPageChange,
}: {
  data: SalesReturnsResponse | null;
  loading?: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onView: (salesReturn: SalesReturn) => void;
  onPageChange: (page: number) => void;
}) => {
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
                {["Return No", "Invoice No", "Customer", "Date", "Grand Total", "Actions"].map((head) => (
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
                      {Array.from({ length: 6 }).map((__, cellIndex) => (
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
                      <td className="px-4 py-4">{salesReturn.customerName ?? "-"}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDate(salesReturn.returnDate)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <AmountText value={salesReturn.grandTotal} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <TableActionIconButton label="View return" icon={<Eye className="size-4" />} onClick={() => onView(salesReturn)} />
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
            Showing {data.items.length} of {data.pagination.total} returns
          </p>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
