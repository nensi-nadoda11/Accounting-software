import { AmountText } from "../../../components/ui/AmountText";
import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { PaginationMeta, SalesGstRow } from "../../../types/gst";
import { formatGstDate } from "../gstUtils";

export const SalesGstTable = ({
  items,
  pagination,
  onPageChange,
}: {
  items: SalesGstRow[];
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}) => {
  if (!items.length) {
    return <EmptyState title="No sales GST entries found." />;
  }

  return (
    <div className="space-y-3">
      <TableWrapper>
        <Table>
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Date", "Invoice No", "Customer", "GSTIN", "Place", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total GST", "Invoice Total"].map((head) => (
                <th key={head} className="px-3 py-3 font-semibold">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {items.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3 whitespace-nowrap">{formatGstDate(row.invoiceDate)}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900">{row.invoiceNumber}</div>
                    <Badge tone="neutral">{row.invoiceType === "pos" ? "POS" : "GST"}</Badge>
                  </div>
                </td>
                <td className="px-3 py-3">{row.customerName}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.gstin || "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.placeOfSupply}</td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.taxableAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.cgstAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.sgstAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.igstAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.cessAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.totalGst} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.invoiceTotal} tone="default" /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} />
    </div>
  );
};
