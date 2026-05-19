import { Save } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { Attendance, PaginationMeta } from "../../../types/payroll";

type EditableField =
  | "workingDays"
  | "presentDays"
  | "paidLeaveDays"
  | "unpaidLeaveDays"
  | "halfDays"
  | "overtimeHours";

export type AttendanceDraftMap = Record<string, Partial<Record<EditableField, string>>>;

const editableFields: EditableField[] = [
  "workingDays",
  "presentDays",
  "paidLeaveDays",
  "unpaidLeaveDays",
  "halfDays",
  "overtimeHours",
];

export const AttendanceTable = ({
  items,
  pagination,
  loading,
  drafts,
  canEdit,
  onFieldChange,
  onSave,
  onPageChange,
}: {
  items: Attendance[];
  pagination: PaginationMeta | null;
  loading: boolean;
  drafts: AttendanceDraftMap;
  canEdit: boolean;
  onFieldChange: (attendanceId: string, field: EditableField, value: string) => void;
  onSave: (attendance: Attendance) => void;
  onPageChange: (page: number) => void;
}) => {
  if (!loading && items.length === 0) {
    return <EmptyState title="No attendance records found." />;
  }

  const getValue = (attendance: Attendance, field: EditableField) => drafts[attendance.id]?.[field] ?? String(attendance[field]);

  const hasWarning = (attendance: Attendance) => {
    const workingDays = Number(getValue(attendance, "workingDays"));
    const total =
      Number(getValue(attendance, "presentDays")) +
      Number(attendance.absentDays) +
      Number(getValue(attendance, "paidLeaveDays")) +
      Number(getValue(attendance, "unpaidLeaveDays")) +
      Number(getValue(attendance, "halfDays"));
    return total > workingDays;
  };

  return (
    <div className="space-y-4">
      <TableWrapper>
        <div className="overflow-x-auto">
          <Table className="text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Working Days</th>
                <th className="px-4 py-3 font-semibold">Present</th>
                <th className="px-4 py-3 font-semibold">Paid Leave</th>
                <th className="px-4 py-3 font-semibold">Unpaid Leave</th>
                <th className="px-4 py-3 font-semibold">Half Days</th>
                <th className="px-4 py-3 font-semibold">Overtime</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                    Loading attendance...
                  </td>
                </tr>
              ) : (
                items.map((attendance) => (
                  <tr key={attendance.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{attendance.employee?.fullName ?? attendance.employeeId}</div>
                      <div className="text-xs text-slate-500">
                        {attendance.employee?.employeeCode} · {attendance.employee?.department || "-"}
                      </div>
                      {hasWarning(attendance) ? (
                        <div className="mt-2">
                          <Badge tone="warning">Totals exceed working days</Badge>
                        </div>
                      ) : null}
                    </td>
                    {editableFields.map((field) => (
                      <td key={field} className="px-4 py-3">
                        <input
                          type="number"
                          step="0.5"
                          disabled={!canEdit}
                          value={getValue(attendance, field)}
                          onChange={(event) => onFieldChange(attendance.id, field, event.target.value)}
                          className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 disabled:bg-slate-50"
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        {canEdit ? (
                          <TableActionIconButton
                            label="Save attendance"
                            icon={<Save className="size-4" />}
                            onClick={() => onSave(attendance)}
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
