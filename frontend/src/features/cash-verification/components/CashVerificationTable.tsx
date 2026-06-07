import { Download, Eye, Pencil, ShieldCheck } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { CashVerificationListItem, CashVerificationListResponse } from "../../../types/cashVerification";
import { StatusBadge } from "./StatusBadge";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const getDifferenceTone = (value: string) => {
  const numeric = Number(value);
  if (numeric < 0) {
    return "danger" as const;
  }
  if (numeric > 0) {
    return "warning" as const;
  }
  return "success" as const;
};

export const CashVerificationTable = ({
  items,
  pagination,
  loading,
  error,
  canCreate,
  canApprove,
  canExport,
  onView,
  onEdit,
  onApprove,
  onExport,
  onPageChange,
}: {
  items: CashVerificationListItem[];
  pagination: CashVerificationListResponse["pagination"] | null;
  loading: boolean;
  error: string | null;
  canCreate: boolean;
  canApprove: boolean;
  canExport: boolean;
  onView: (item: CashVerificationListItem) => void;
  onEdit: (item: CashVerificationListItem) => void;
  onApprove: (item: CashVerificationListItem) => void;
  onExport: (item: CashVerificationListItem) => void;
  onPageChange: (page: number) => void;
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
    return (
      <Card>
        <CardContent className="py-6 text-sm text-rose-700">{error}</CardContent>
      </Card>
    );
  }

  if (!items.length) {
    return <EmptyState title="No cash verifications found" />;
  }

  return (
    <Card>
      <TableWrapper className="border-none">
        <Table>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {["Verification No", "Date", "Expected Cash", "Actual Cash", "Difference", "Status", "Verified By", "Approved By", "Actions"].map((head) => (
                <th key={head} className="px-4 py-3 font-semibold">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-4 font-medium text-slate-900">{item.verificationNo}</td>
                <td className="whitespace-nowrap px-4 py-4">{formatDate(item.verificationDate)}</td>
                <td className="whitespace-nowrap px-4 py-4"><AmountText value={item.expectedCash} /></td>
                <td className="whitespace-nowrap px-4 py-4"><AmountText value={item.actualCash} /></td>
                <td className="whitespace-nowrap px-4 py-4">
                  <AmountText value={item.differenceAmount} tone={getDifferenceTone(item.differenceAmount)} />
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={item.status} />
                    <StatusBadge status={item.recordStatus} />
                  </div>
                </td>
                <td className="px-4 py-4">{item.verifiedBy.name ?? "-"}</td>
                <td className="px-4 py-4">{item.approvedBy?.name ?? "-"}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <TableActionIconButton label="View" icon={<Eye className="size-4" />} onClick={() => onView(item)} />
                    {canCreate && item.recordStatus === "draft" ? (
                      <TableActionIconButton label="Edit" icon={<Pencil className="size-4" />} onClick={() => onEdit(item)} />
                    ) : null}
                    {canApprove && item.recordStatus === "completed" ? (
                      <TableActionIconButton label="Approve" icon={<ShieldCheck className="size-4" />} onClick={() => onApprove(item)} />
                    ) : null}
                    {canExport ? (
                      <TableActionIconButton label="Export" icon={<Download className="size-4" />} onClick={() => onExport(item)} />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>
      {pagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <p className="text-sm text-slate-500">
            Showing {items.length} of {pagination.total} cash verifications
          </p>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} />
        </div>
      ) : null}
    </Card>
  );
};
