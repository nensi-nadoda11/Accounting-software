import { CircleSlash, Download, Eye, IndianRupee, Play } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { PaginationMeta, PayrollRun } from "../../../types/payroll";
import { formatMonthLabel } from "../payrollUtils";

export const PayrollRunsTable = ({
  items,
  pagination,
  loading,
  canGenerate,
  canPay,
  canExport,
  onView,
  onGenerate,
  onPay,
  onCancel,
  onExport,
  onPageChange,
}: {
  items: PayrollRun[];
  pagination: PaginationMeta | null;
  loading: boolean;
  canGenerate: boolean;
  canPay: boolean;
  canExport: boolean;
  onView: (run: PayrollRun) => void;
  onGenerate: (run: PayrollRun) => void;
  onPay: (run: PayrollRun) => void;
  onCancel: (run: PayrollRun) => void;
  onExport: (run: PayrollRun) => void;
  onPageChange: (page: number) => void;
}) => {
  if (!loading && items.length === 0) {
    return <EmptyState title="No payroll runs found." />;
  }

  return (
    <div className="space-y-4">
      <TableWrapper>
        <div className="overflow-x-auto">
          <Table className="text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Run No</th>
                <th className="px-4 py-3 font-semibold">Payroll Month</th>
                <th className="px-4 py-3 font-semibold">Employees</th>
                <th className="px-4 py-3 font-semibold">Gross Total</th>
                <th className="px-4 py-3 font-semibold">Deduction Total</th>
                <th className="px-4 py-3 font-semibold">Net Payable</th>
                <th className="px-4 py-3 font-semibold">Paid Total</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                    Loading payroll runs...
                  </td>
                </tr>
              ) : (
                items.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{run.runNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{formatMonthLabel(run.payrollMonth)}</td>
                    <td className="px-4 py-3 text-slate-600">{run.totalEmployees}</td>
                    <td className="px-4 py-3"><AmountText value={run.grossTotal} tone="default" /></td>
                    <td className="px-4 py-3"><AmountText value={run.deductionTotal} tone="default" /></td>
                    <td className="px-4 py-3"><AmountText value={run.netPayableTotal} tone="default" /></td>
                    <td className="px-4 py-3"><AmountText value={run.paidTotal} tone="default" /></td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} label={run.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <TableActionIconButton label="View run" icon={<Eye className="size-4" />} onClick={() => onView(run)} />
                        {canGenerate ? (
                          <TableActionIconButton
                            label="Generate payroll"
                            icon={<Play className="size-4" />}
                            onClick={() => onGenerate(run)}
                            disabled={run.status === "paid" || run.status === "cancelled"}
                          />
                        ) : null}
                        {canPay ? (
                          <TableActionIconButton
                            label="Pay payroll"
                            icon={<IndianRupee className="size-4" />}
                            onClick={() => onPay(run)}
                            disabled={run.status === "draft" || run.status === "cancelled" || run.status === "paid"}
                          />
                        ) : null}
                        {canGenerate ? (
                          <TableActionIconButton
                            label="Cancel run"
                            icon={<CircleSlash className="size-4" />}
                            onClick={() => onCancel(run)}
                            disabled={run.status === "paid" || run.status === "cancelled"}
                          />
                        ) : null}
                        {canExport ? (
                          <TableActionIconButton label="Export run" icon={<Download className="size-4" />} onClick={() => onExport(run)} />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </TableWrapper>
      {pagination ? <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} /> : null}
    </div>
  );
};
