import { AmountText } from "../../../components/ui/AmountText";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { BalanceSheetReport, BalanceSheetRow } from "../../../types/accounting";

const BalanceSection = ({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "info" | "warning" | "success";
  rows: BalanceSheetRow[];
}) => (
  <div className="space-y-2">
    <Badge tone={tone}>{title}</Badge>
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

export const BalanceSheetView = ({ data, loading }: { data: BalanceSheetReport | null; loading: boolean }) => {
  if (loading) {
    return <LoadingState label="Loading balance sheet..." />;
  }

  if (!data) {
    return <EmptyState title="Select financial year or as-of date." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Assets</p>
          <div className="mt-1"><AmountText value={data.totals.assets} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Liabilities</p>
          <div className="mt-1"><AmountText value={data.totals.liabilities} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Equity</p>
          <div className="mt-1"><AmountText value={data.totals.equity} /></div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Status</p>
          <div className="mt-1">
            <Badge tone={data.totals.isBalanced ? "success" : "danger"}>
              {data.totals.isBalanced ? "Balanced" : `Imbalance ${data.totals.imbalance}`}
            </Badge>
          </div>
        </div>
      </div>

      <BalanceSection title="Assets" tone="info" rows={data.assets} />
      <BalanceSection title="Liabilities" tone="warning" rows={data.liabilities} />
      <BalanceSection title="Equity" tone="success" rows={data.equity} />
    </div>
  );
};
