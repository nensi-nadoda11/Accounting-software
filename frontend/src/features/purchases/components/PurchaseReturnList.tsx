import { Eye, FileText, Plus } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import { formatDate } from "../../customers/customerUtils";
import type { PurchaseReturn, PurchaseReturnsResponse } from "../../../types/purchase";

export const PurchaseReturnList = ({
  data,
  loading,
  onPageChange,
  onCreate,
  onView,
  onPdf,
  canCreate,
  canExport,
}: {
  data: PurchaseReturnsResponse | null;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onCreate: () => void;
  onView: (purchaseReturn: PurchaseReturn) => void;
  onPdf: (purchaseReturn: PurchaseReturn) => void;
  canCreate: boolean;
  canExport: boolean;
}) => {
  if (!loading && !data?.items.length) {
    return (
      <EmptyState
        title="No purchase returns found"
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
                {["Return No", "Purchase No", "Supplier", "Date", "Grand Total", "Actions"].map((head) => (
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
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-4 rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                data?.items.map((purchaseReturn) => (
                  <tr key={purchaseReturn.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-4 font-medium text-slate-900">{purchaseReturn.returnNumber}</td>
                    <td className="px-4 py-4">{purchaseReturn.purchaseNumber}</td>
                    <td className="px-4 py-4">{purchaseReturn.supplierName}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDate(purchaseReturn.returnDate)}</td>
                    <td className="px-4 py-4 whitespace-nowrap"><AmountText value={purchaseReturn.grandTotal} /></td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <TableActionIconButton label="View return" icon={<Eye className="size-4" />} onClick={() => onView(purchaseReturn)} />
                        {canExport ? (
                          <TableActionIconButton label="Download PDF" icon={<FileText className="size-4" />} onClick={() => onPdf(purchaseReturn)} />
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
            Showing {data.items.length} of {data.pagination.total} returns
          </p>
          <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
