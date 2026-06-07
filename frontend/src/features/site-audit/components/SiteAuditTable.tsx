import { CheckCircle2, Download, Eye, Pencil, ShieldCheck } from "lucide-react";

import { Pagination } from "../../../components/ui/Pagination";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { SiteAuditListItem, SiteAuditListResponse } from "../../../types/siteAudit";
import { StatusBadge } from "./StatusBadge";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const SiteAuditTable = ({
  items,
  pagination,
  loading,
  error,
  canUpdate,
  canApprove,
  canExport,
  onView,
  onEdit,
  onComplete,
  onApprove,
  onExport,
  onPageChange,
}: {
  items: SiteAuditListItem[];
  pagination: SiteAuditListResponse["pagination"] | null;
  loading: boolean;
  error: string | null;
  canUpdate: boolean;
  canApprove: boolean;
  canExport: boolean;
  onView: (item: SiteAuditListItem) => void;
  onEdit: (item: SiteAuditListItem) => void;
  onComplete: (item: SiteAuditListItem) => void;
  onApprove: (item: SiteAuditListItem) => void;
  onExport: (item: SiteAuditListItem) => void;
  onPageChange: (page: number) => void;
}) => (
  <div className="space-y-3">
    <TableWrapper>
      <Table>
        <thead>
          <tr>
            <th>Audit No</th>
            <th>Date</th>
            <th>Warehouse</th>
            <th>Auditor</th>
            <th>Final Result</th>
            <th>Status</th>
            <th>Findings</th>
            <th className="w-44 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">Loading site audits...</td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-sm text-rose-600">{error}</td>
            </tr>
          ) : items.length ? (
            items.map((item) => (
              <tr key={item.id}>
                <td className="font-medium text-slate-900">{item.auditNo}</td>
                <td>{formatDate(item.auditDate)}</td>
                <td>{item.warehouse?.name ?? item.warehouse?.warehouseCode ?? "-"}</td>
                <td>{item.auditor.name ?? "-"}</td>
                <td><StatusBadge status={item.finalResult} /></td>
                <td><StatusBadge status={item.status} /></td>
                <td>
                  <span className={item.findings.critical ? "font-semibold text-rose-700" : undefined}>
                    {item.findings.total}
                  </span>
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <TableActionIconButton label="View" icon={<Eye className="size-4" />} onClick={() => onView(item)} />
                    {canUpdate && (item.status === "draft" || item.status === "completed") ? (
                      <TableActionIconButton label="Edit" icon={<Pencil className="size-4" />} onClick={() => onEdit(item)} />
                    ) : null}
                    {canUpdate && item.status === "draft" ? (
                      <TableActionIconButton label="Complete" icon={<CheckCircle2 className="size-4" />} onClick={() => onComplete(item)} />
                    ) : null}
                    {canApprove && item.status === "completed" ? (
                      <TableActionIconButton label="Approve" icon={<ShieldCheck className="size-4" />} onClick={() => onApprove(item)} />
                    ) : null}
                    {canExport ? (
                      <TableActionIconButton label="Export" icon={<Download className="size-4" />} onClick={() => onExport(item)} />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">No site audits found</td>
            </tr>
          )}
        </tbody>
      </Table>
    </TableWrapper>
    {pagination ? <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} /> : null}
  </div>
);
