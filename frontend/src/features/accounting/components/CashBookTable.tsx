import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { LedgerResponse } from "../../../types/accounting";
import { formatAccountingDate } from "../accountingUtils";

export const CashBookTable = ({
  data,
  loading,
  onPageChange,
}: {
  data: LedgerResponse | null;
  loading: boolean;
  onPageChange?: (page: number) => void;
}) => {
  if (loading) {
    return <LoadingState label="Loading cash book..." />;
  }

  if (!data) {
    return <EmptyState title="Select a date range to view cash book." />;
  }

  if (!data.rows.length) {
    return <EmptyState title="No cash book rows found." />;
  }

  return (
    <div className="space-y-3">
      <TableWrapper>
        <Table>
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Date", "Voucher No", "Description", "Received", "Paid", "Balance"].map((head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {data.rows.map((row) => (
              <tr key={`${row.journalId}-${row.journalNumber}-${row.description ?? ""}`}>
                <td className="px-4 py-3">{formatAccountingDate(row.entryDate)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.journalNumber}</td>
                <td className="px-4 py-3">{row.description ?? "-"}</td>
                <td className="px-4 py-3"><AmountText value={row.debit} /></td>
                <td className="px-4 py-3"><AmountText value={row.credit} /></td>
                <td className="px-4 py-3"><AmountText value={row.runningBalance.amount} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>
      {onPageChange ? <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} /> : null}
    </div>
  );
};
