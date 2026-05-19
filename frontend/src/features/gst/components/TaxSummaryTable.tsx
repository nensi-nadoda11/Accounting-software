import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { TaxSummaryRow } from "../../../types/gst";

export const TaxSummaryTable = ({ items }: { items: TaxSummaryRow[] }) => {
  if (!items.length) {
    return <EmptyState title="No tax summary rows found." />;
  }

  return (
    <TableWrapper>
      <Table>
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {["GST Rate", "Sales Taxable", "Output GST", "Purchase Taxable", "Input GST", "Net GST"].map((head) => (
              <th key={head} className="px-3 py-3 font-semibold">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
          {items.map((row) => (
            <tr key={row.gstRate}>
              <td className="px-3 py-3 whitespace-nowrap">{row.gstRate}%</td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.taxableSales} tone="default" /></td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.outputGst} tone="default" /></td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.taxablePurchases} tone="default" /></td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.inputGst} tone="default" /></td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.netGst} tone={Number(row.netGst) >= 0 ? "warning" : "success"} /></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  );
};
