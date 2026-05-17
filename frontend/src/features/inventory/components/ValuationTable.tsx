import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { InventoryValuationRow } from "../../../types/inventory";
import { AmountText } from "../../../components/ui/AmountText";
import { QuantityText } from "../../../components/ui/QuantityText";

export const ValuationTable = ({
  items,
  loading,
  error,
}: {
  items: InventoryValuationRow[];
  loading?: boolean;
  error?: string | null;
}) => {
  if (loading && !items.length) {
    return (
      <Card className="p-5">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 rounded bg-slate-100" />
          ))}
        </div>
      </Card>
    );
  }

  if (error && !items.length) {
    return <Card className="p-5 text-sm text-rose-700">{error}</Card>;
  }

  if (!items.length) {
    return <EmptyState title="No valuation rows found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <Table>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {["Product", "Category", "Warehouse Unit", "Quantity", "Average Cost", "Stock Value"].map((head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
            {items.map((item) => (
              <tr key={item.product.id}>
                <td className="px-4 py-4">
                  <div className="min-w-[180px]">
                    <p className="font-medium text-slate-900">{item.product.name}</p>
                    <p className="text-xs text-slate-500">{item.product.productCode}</p>
                  </div>
                </td>
                <td className="px-4 py-4">{item.category ?? "-"}</td>
                <td className="px-4 py-4">{item.unit ?? "-"}</td>
                <td className="px-4 py-4"><QuantityText value={item.quantity} tone="default" /></td>
                <td className="px-4 py-4"><AmountText value={item.averageCost} tone="default" /></td>
                <td className="px-4 py-4"><AmountText value={item.stockValue} tone="default" /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>
    </Card>
  );
};
