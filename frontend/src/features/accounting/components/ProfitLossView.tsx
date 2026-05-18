import { AmountText } from "../../../components/ui/AmountText";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { ProfitLossReport } from "../../../types/accounting";

const SectionTable = ({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "success" | "danger";
  rows: ProfitLossReport["items"];
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Badge tone={tone}>{title}</Badge>
      <AmountText value={rows.reduce((sum, row) => sum + Number(row.amount), 0)} tone={tone === "success" ? "success" : "danger"} />
    </div>
    <TableWrapper>
      <Table>
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {["Code", "Account", "Amount"].map((head) => (
              <th key={head} className="px-4 py-3 font-semibold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
          {rows.map((row) => (
            <tr key={row.accountId}>
              <td className="px-4 py-3 font-medium text-slate-900">{row.accountCode}</td>
              <td className="px-4 py-3">{row.accountName}</td>
              <td className="px-4 py-3"><AmountText value={row.amount} /></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  </div>
);

export const ProfitLossView = ({ data, loading }: { data: ProfitLossReport | null; loading: boolean }) => {
  if (loading) {
    return <LoadingState label="Loading profit & loss..." />;
  }

  if (!data) {
    return <EmptyState title="Select a financial year or date range." />;
  }

  const incomeRows = data.items.filter((item) => item.accountType === "income");
  const expenseRows = data.items.filter((item) => item.accountType === "expense");

  return (
    <div className="space-y-4">
      <SectionTable title="Income" tone="success" rows={incomeRows} />
      <SectionTable title="Expenses" tone="danger" rows={expenseRows} />
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Net Profit / Loss</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {Number(data.totals.netProfitLoss) >= 0 ? "Profit" : "Loss"}
            </p>
          </div>
          <AmountText value={data.totals.netProfitLoss} tone={Number(data.totals.netProfitLoss) >= 0 ? "success" : "danger"} />
        </div>
      </div>
    </div>
  );
};
