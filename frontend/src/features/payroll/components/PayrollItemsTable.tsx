import { Download, Eye, Mail, Pencil, Wallet } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { PayrollItem } from "../../../types/payroll";

export const PayrollItemsTable = ({
  items,
  canPay,
  canAdjust,
  canPrint,
  onPay,
  onAdjust,
  onSlip,
  onPdf,
  onEmail,
}: {
  items: PayrollItem[];
  canPay: boolean;
  canAdjust: boolean;
  canPrint: boolean;
  onPay: (item: PayrollItem) => void;
  onAdjust: (item: PayrollItem) => void;
  onSlip: (item: PayrollItem) => void;
  onPdf: (item: PayrollItem) => void;
  onEmail: (item: PayrollItem) => void;
}) => {
  if (items.length === 0) {
    return <EmptyState title="No payroll items generated." />;
  }

  return (
    <TableWrapper>
      <div className="overflow-x-auto">
        <Table className="text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Employee</th>
              <th className="px-4 py-3 font-semibold">Working Days</th>
              <th className="px-4 py-3 font-semibold">Payable Days</th>
              <th className="px-4 py-3 font-semibold">Basic</th>
              <th className="px-4 py-3 font-semibold">Allowances</th>
              <th className="px-4 py-3 font-semibold">Bonus</th>
              <th className="px-4 py-3 font-semibold">Gross</th>
              <th className="px-4 py-3 font-semibold">Deductions</th>
              <th className="px-4 py-3 font-semibold">Net</th>
              <th className="px-4 py-3 font-semibold">Paid</th>
              <th className="px-4 py-3 font-semibold">Payment Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{item.employeeName}</div>
                  <div className="text-xs text-slate-500">
                    {item.employeeCode} · {item.department || "-"}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.workingDays}</td>
                <td className="px-4 py-3 text-slate-600">{item.payableDays}</td>
                <td className="px-4 py-3"><AmountText value={item.basicSalary} tone="default" /></td>
                <td className="px-4 py-3"><AmountText value={item.allowancesTotal} tone="default" /></td>
                <td className="px-4 py-3"><AmountText value={item.bonusTotal} tone="default" /></td>
                <td className="px-4 py-3"><AmountText value={item.grossSalary} tone="default" /></td>
                <td className="px-4 py-3"><AmountText value={item.deductionsTotal} tone="default" /></td>
                <td className="px-4 py-3"><AmountText value={item.netSalary} tone="default" /></td>
                <td className="px-4 py-3"><AmountText value={item.paidAmount} tone="default" /></td>
                <td className="px-4 py-3">
                  <StatusBadge status={item.paymentStatus} label={item.paymentStatus} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {canPay ? (
                      <TableActionIconButton
                        label="Pay employee"
                        icon={<Wallet className="size-4" />}
                        onClick={() => onPay(item)}
                        disabled={item.paymentStatus === "paid" || item.status === "cancelled"}
                      />
                    ) : null}
                    {canAdjust ? (
                      <TableActionIconButton
                        label="Bonus deduction"
                        icon={<Pencil className="size-4" />}
                        onClick={() => onAdjust(item)}
                        disabled={item.status === "cancelled"}
                      />
                    ) : null}
                    {canPrint ? (
                      <>
                        <TableActionIconButton label="View slip" icon={<Eye className="size-4" />} onClick={() => onSlip(item)} />
                        <TableActionIconButton label="Download PDF" icon={<Download className="size-4" />} onClick={() => onPdf(item)} />
                        <TableActionIconButton label="Email slip" icon={<Mail className="size-4" />} onClick={() => onEmail(item)} />
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </TableWrapper>
  );
};
