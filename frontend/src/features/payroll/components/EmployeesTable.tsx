import { CalendarDays, Eye, Pencil, ReceiptText, Trash2, WalletCards } from "lucide-react";

import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { Employee, PaginationMeta } from "../../../types/payroll";

export const EmployeesTable = ({
  items,
  pagination,
  loading,
  canManage,
  onView,
  onEdit,
  onDelete,
  onSalaryStructure,
  onAttendance,
  onPayrollHistory,
  onPageChange,
}: {
  items: Employee[];
  pagination: PaginationMeta | null;
  loading: boolean;
  canManage: boolean;
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onSalaryStructure: (employee: Employee) => void;
  onAttendance: (employee: Employee) => void;
  onPayrollHistory: (employee: Employee) => void;
  onPageChange: (page: number) => void;
}) => {
  if (!loading && items.length === 0) {
    return <EmptyState title="No payroll employees found." />;
  }

  return (
    <div className="space-y-4">
      <TableWrapper>
        <div className="overflow-x-auto">
          <Table className="text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee Code</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Mobile</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Designation</th>
                <th className="px-4 py-3 font-semibold">Salary Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    Loading employees...
                  </td>
                </tr>
              ) : (
                items.map((employee) => (
                  <tr key={employee.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-slate-700">{employee.employeeCode}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{employee.fullName}</div>
                      {employee.email ? <div className="text-xs text-slate-500">{employee.email}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{employee.mobile}</td>
                    <td className="px-4 py-3 text-slate-600">{employee.department || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{employee.designation || "-"}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{employee.salaryType}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={employee.status} label={employee.status.replace("_", " ")} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <TableActionIconButton label="View employee" icon={<Eye className="size-4" />} onClick={() => onView(employee)} />
                        {canManage ? (
                          <TableActionIconButton label="Edit employee" icon={<Pencil className="size-4" />} onClick={() => onEdit(employee)} />
                        ) : null}
                        <TableActionIconButton
                          label="Salary structure"
                          icon={<WalletCards className="size-4" />}
                          onClick={() => onSalaryStructure(employee)}
                        />
                        <TableActionIconButton
                          label="Attendance"
                          icon={<CalendarDays className="size-4" />}
                          onClick={() => onAttendance(employee)}
                        />
                        <TableActionIconButton
                          label="Payroll history"
                          icon={<ReceiptText className="size-4" />}
                          onClick={() => onPayrollHistory(employee)}
                        />
                        {canManage ? (
                          <TableActionIconButton
                            label="Deactivate employee"
                            icon={<Trash2 className="size-4" />}
                            tone="danger"
                            onClick={() => onDelete(employee)}
                          />
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
