import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { InlineErrorState } from "../../../components/ui/InlineErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Pagination } from "../../../components/ui/Pagination";
import { Badge } from "../../../components/ui/Badge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { LedgerResponse } from "../../../types/accounting";
import { balanceSideTone, formatAccountingDate, normalBalanceLabels } from "../accountingUtils";

export const LedgerTable = ({
  data,
  loading,
  error,
  onPageChange,
}: {
  data: LedgerResponse | null;
  loading: boolean;
  error?: string | null;
  onPageChange?: (page: number) => void;
}) => {
  if (loading) {
    return <LoadingState label="Loading ledger..." />;
  }

  if (error && !data) {
    return <InlineErrorState title={error} />;
  }

  if (!data) {
    return <EmptyState title="Select filters to view ledger." />;
  }

  if (!data.rows.length) {
    return <EmptyState title="No ledger rows found." />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Opening Balance</p>
          <div className="mt-1 flex items-center gap-2">
            <AmountText value={data.openingBalance.amount} />
            <Badge tone={balanceSideTone(data.openingBalance.side)}>{normalBalanceLabels[data.openingBalance.side]}</Badge>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Closing Balance</p>
          <div className="mt-1 flex items-center gap-2">
            <AmountText value={data.closingBalance.amount} />
            <Badge tone={balanceSideTone(data.closingBalance.side)}>{normalBalanceLabels[data.closingBalance.side]}</Badge>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Ledger</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{data.label}</p>
        </div>
      </div>

      <TableWrapper>
        <Table>
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Date", "Voucher No", "Type", "Description", "Debit", "Credit", "Balance"].map((head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {data.rows.map((row) => (
              <tr key={`${row.journalId}-${row.referenceId ?? row.journalNumber}`}>
                <td className="px-4 py-3">{formatAccountingDate(row.entryDate)}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.journalNumber}</td>
                <td className="px-4 py-3">{row.voucherType}</td>
                <td className="px-4 py-3">{row.description ?? "-"}</td>
                <td className="px-4 py-3"><AmountText value={row.debit} /></td>
                <td className="px-4 py-3"><AmountText value={row.credit} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AmountText value={row.runningBalance.amount} />
                    <Badge tone={balanceSideTone(row.runningBalance.side)}>{normalBalanceLabels[row.runningBalance.side]}</Badge>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>

      {onPageChange ? <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={onPageChange} /> : null}
    </div>
  );
};
