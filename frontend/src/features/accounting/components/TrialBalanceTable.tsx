import { AmountText } from "../../../components/ui/AmountText";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { InlineErrorState } from "../../../components/ui/InlineErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { TrialBalanceResponse } from "../../../types/accounting";
import { accountTypeLabels } from "../accountingUtils";

const sideAmount = (amount: string, side: "debit" | "credit", expected: "debit" | "credit") =>
  side === expected ? amount : "0.00";

export const TrialBalanceTable = ({
  data,
  loading,
  error,
}: {
  data: TrialBalanceResponse | null;
  loading: boolean;
  error?: string | null;
}) => {
  if (loading) {
    return <LoadingState label="Loading trial balance..." />;
  }

  if (error && !data) {
    return <InlineErrorState title={error} />;
  }

  if (!data) {
    return <EmptyState title="Select a financial year or date range." />;
  }

  if (!data.items.length) {
    return <EmptyState title="No trial balance rows found." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm">
            <span className="text-slate-500">Debit Total</span>{" "}
            <AmountText value={data.totals.debit} />
          </div>
          <div className="text-sm">
            <span className="text-slate-500">Credit Total</span>{" "}
            <AmountText value={data.totals.credit} />
          </div>
        </div>
        {!data.totals.isBalanced ? (
          <Badge tone="danger">Imbalance {data.totals.imbalance}</Badge>
        ) : (
          <Badge tone="success">Balanced</Badge>
        )}
      </div>

      <TableWrapper>
        <Table>
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {[
                "Account Code",
                "Account Name",
                "Type",
                "Opening Debit",
                "Opening Credit",
                "Period Debit",
                "Period Credit",
                "Closing Debit",
                "Closing Credit",
              ].map((head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {data.items.map((row) => (
              <tr key={row.accountId}>
                <td className="px-4 py-3 font-medium text-slate-900">{row.accountCode}</td>
                <td className="px-4 py-3">{row.accountName}</td>
                <td className="px-4 py-3">{accountTypeLabels[row.accountType]}</td>
                <td className="px-4 py-3"><AmountText value={sideAmount(row.openingBalance.amount, row.openingBalance.side, "debit")} /></td>
                <td className="px-4 py-3"><AmountText value={sideAmount(row.openingBalance.amount, row.openingBalance.side, "credit")} /></td>
                <td className="px-4 py-3"><AmountText value={row.periodDebit} /></td>
                <td className="px-4 py-3"><AmountText value={row.periodCredit} /></td>
                <td className="px-4 py-3"><AmountText value={sideAmount(row.closingBalance.amount, row.closingBalance.side, "debit")} /></td>
                <td className="px-4 py-3"><AmountText value={sideAmount(row.closingBalance.amount, row.closingBalance.side, "credit")} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>
    </div>
  );
};
