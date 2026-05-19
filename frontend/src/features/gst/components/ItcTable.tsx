import { CheckCheck, Pencil } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { ItcRow, PaginationMeta } from "../../../types/gst";
import { formatGstDate, GST_SOURCE_LABELS } from "../gstUtils";

export const ItcTable = ({
  items,
  pagination,
  onPageChange,
  canManage,
  onEdit,
}: {
  items: ItcRow[];
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  canManage: boolean;
  onEdit: (row: ItcRow) => void;
}) => {
  if (!items.length) {
    return <EmptyState title="No ITC rows found." />;
  }

  return (
    <div className="space-y-3">
      <TableWrapper>
        <Table>
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              {["Source", "Invoice No", "Date", "Supplier GSTIN", "Taxable", "CGST", "SGST", "IGST", "Cess", "Total GST", "Eligibility", "Claim Status", "Actions"].map((head) => (
                <th key={head} className="px-3 py-3 font-semibold">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
            {items.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900">{GST_SOURCE_LABELS[row.sourceType]}</div>
                    <div className="text-xs text-slate-500">{row.supplierName || row.sourceMeta?.reason || "-"}</div>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{row.sourceNumber || "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap">{formatGstDate(row.invoiceDate)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.supplierGstin || "-"}</td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.taxableAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.cgstAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.sgstAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.igstAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.cessAmount} tone="default" /></td>
                <td className="px-3 py-3 whitespace-nowrap"><AmountText value={row.totalGstAmount} tone="default" /></td>
                <td className="px-3 py-3"><StatusBadge status={row.eligibilityStatus} label={row.eligibilityStatus} /></td>
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <StatusBadge status={row.claimStatus} label={row.claimStatus.replaceAll("_", " ")} />
                    <div className="text-xs text-slate-500"><AmountText value={row.claimedAmount} tone="default" /></div>
                  </div>
                </td>
                <td className="px-3 py-3">
                  {canManage ? (
                    <TableActionIconButton
                      label="Update ITC status"
                      icon={row.claimStatus === "claimed" ? <CheckCheck className="size-4" /> : <Pencil className="size-4" />}
                      onClick={() => onEdit(row)}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>
      <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} />
    </div>
  );
};
