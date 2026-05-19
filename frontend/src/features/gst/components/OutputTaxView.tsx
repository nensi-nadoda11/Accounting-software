import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { OutputTaxSummary } from "../../../types/gst";

export const OutputTaxView = ({ summary }: { summary: OutputTaxSummary }) => {
  const cards = [
    { label: "Taxable Outward Supplies", value: summary.taxableSales },
    { label: "Output GST", value: summary.outputGst },
    { label: "Sales Return GST", value: summary.salesReturnGst },
    { label: "Output Adjustments", value: summary.outputAdjustments },
    { label: "Sales GST", value: summary.salesGst },
    { label: "Sales Return Taxable", value: summary.salesReturnsTaxable },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="rounded-xl">
            <div className="px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <AmountText value={card.value} className="mt-2 block text-base font-semibold text-slate-900" tone="default" />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Output Tax Breakdown" />
        <CardContent className="p-0">
          <TableWrapper className="rounded-none border-0">
            <Table>
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Metric</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                {[
                  ["Taxable Sales", summary.taxableSales],
                  ["Sales GST", summary.salesGst],
                  ["Sales Returns Taxable", summary.salesReturnsTaxable],
                  ["Sales Return GST", summary.salesReturnGst],
                  ["Output Adjustments", summary.outputAdjustments],
                  ["Net Output GST", summary.outputGst],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="px-4 py-3">{label}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><AmountText value={value} tone="default" /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </div>
  );
};
