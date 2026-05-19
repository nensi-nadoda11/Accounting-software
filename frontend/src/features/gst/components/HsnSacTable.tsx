import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { HsnSacSummaryRow } from "../../../types/gst";

export const HsnSacTable = ({ items }: { items: HsnSacSummaryRow[] }) => {
  if (!items.length) {
    return <EmptyState title="No HSN/SAC rows found." />;
  }

  return (
    <TableWrapper>
      <Table>
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {["HSN/SAC", "Description", "Unit", "Qty", "GST %", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total Tax"].map((head) => (
              <th key={head} className="px-3 py-3 font-semibold">{head}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
          {items.map((row) => (
            <tr key={`${row.hsnSacCode}-${row.description}-${row.gstRate}`}>
              <td className="px-3 py-3 whitespace-nowrap">{row.hsnSacCode || "-"}</td>
              <td className="px-3 py-3">{row.description || "-"}</td>
              <td className="px-3 py-3 whitespace-nowrap">{row.unit || "-"}</td>
              <td className="px-3 py-3 whitespace-nowrap">{row.quantity}</td>
              <td className="px-3 py-3 whitespace-nowrap">{row.gstRate}%</td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.taxableValue} tone="default" /></td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.cgstAmount} tone="default" /></td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.sgstAmount} tone="default" /></td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.igstAmount} tone="default" /></td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.cessAmount} tone="default" /></td>
              <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.totalTax} tone="default" /></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  );
};
