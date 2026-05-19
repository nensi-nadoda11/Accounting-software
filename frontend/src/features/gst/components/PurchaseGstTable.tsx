import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { PaginationMeta, PurchaseGstRow } from "../../../types/gst";
import { formatGstDate } from "../gstUtils";

export const PurchaseGstTable = ({
  items,
  pagination,
  onPageChange,
}: {
  items: PurchaseGstRow[];
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}) => {
  if (!items.length) {
    return <EmptyState title="No purchase GST entries found." />;
  }

  return (
    <div className="space-y-3">
      <TableWrapper>
        <Table>
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Date", "Purchase No", "Supplier", "GSTIN", "Supplier Inv No", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total GST", "ITC", "Invoice Total"].map((head) => (
                <th key={head} className="px-3 py-3 font-semibold">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {items.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3 whitespace-nowrap">{formatGstDate(row.purchaseDate)}</td>
                <td className="px-3 py-3 whitespace-nowrap font-medium text-slate-900">{row.purchaseNumber}</td>
                <td className="px-3 py-3">{row.supplierName}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.gstin || "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.supplierInvoiceNumber || "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.taxableAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.cgstAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.sgstAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.igstAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.cessAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.totalGst} tone="default" /></td>
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <StatusBadge status={row.itcEligibility} label={row.itcEligibility} />
                    <StatusBadge status={row.claimStatus} label={row.claimStatus.replaceAll("_", " ")} />
                  </div>
                </td>
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
