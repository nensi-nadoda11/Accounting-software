import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import type { AttendancePayload, Employee } from "../../../types/payroll";
import { attendanceFormSchema } from "../payrollSchemas";

type BulkRow = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string;
  workingDays: string;
  presentDays: string;
  paidLeaveDays: string;
  unpaidLeaveDays: string;
  halfDays: string;
  overtimeHours: string;
};

const buildRows = (employees: Employee[]) =>
  employees.map<BulkRow>((employee) => ({
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    department: employee.department || "-",
    workingDays: "",
    presentDays: "",
    paidLeaveDays: "",
    unpaidLeaveDays: "",
    halfDays: "",
    overtimeHours: "",
  }));

export const AttendanceBulkEntryDrawer = ({
  open,
  employees,
  departments,
  submitting,
  defaultMonth,
  onClose,
  onSubmit,
}: {
  open: boolean;
  employees: Employee[];
  departments: string[];
  submitting: boolean;
  defaultMonth: string;
  onClose: () => void;
  onSubmit: (payloads: AttendancePayload[]) => Promise<void> | void;
}) => {
  const [payrollMonth, setPayrollMonth] = useState(defaultMonth);
  const [department, setDepartment] = useState("");
  const [rows, setRows] = useState<BulkRow[]>(buildRows(employees));
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setPayrollMonth(defaultMonth);
      setDepartment("");
      setRows(buildRows(employees));
      setError("");
    }
  }, [defaultMonth, employees, open]);

  const visibleRows = useMemo(
    () => rows.filter((row) => !department || row.department === department),
    [department, rows],
  );

  const updateRow = (employeeId: string, field: keyof Omit<BulkRow, "employeeId" | "employeeCode" | "fullName" | "department">, value: string) => {
    setRows((current) =>
      current.map((row) => (row.employeeId === employeeId ? { ...row, [field]: value } : row)),
    );
  };

  const handleSubmit = async () => {
    const populatedRows = rows.filter((row) => Number(row.workingDays) > 0);
    if (populatedRows.length === 0) {
      setError("Enter at least one attendance row.");
      return;
    }

    const payloads: AttendancePayload[] = [];

    for (const row of populatedRows) {
      const parsed = attendanceFormSchema.safeParse({
        employeeId: row.employeeId,
        payrollMonth,
        workingDays: row.workingDays,
        presentDays: row.presentDays || 0,
        absentDays: 0,
        paidLeaveDays: row.paidLeaveDays || 0,
        unpaidLeaveDays: row.unpaidLeaveDays || 0,
        halfDays: row.halfDays || 0,
        overtimeHours: row.overtimeHours || 0,
        remarks: null,
      });

      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Invalid attendance row.");
        return;
      }

      payloads.push({
        employeeId: row.employeeId,
        payrollMonth,
        workingDays: Number(row.workingDays),
        presentDays: Number(row.presentDays || 0),
        absentDays: 0,
        paidLeaveDays: Number(row.paidLeaveDays || 0),
        unpaidLeaveDays: Number(row.unpaidLeaveDays || 0),
        halfDays: Number(row.halfDays || 0),
        overtimeHours: Number(row.overtimeHours || 0),
        remarks: null,
      });
    }

    setError("");
    await onSubmit(payloads);
  };

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title="Bulk Attendance Entry"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submitting} onClick={() => void handleSubmit()}>
            Save Attendance
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Payroll Month" type="month" value={payrollMonth} onChange={(event) => setPayrollMonth(event.target.value)} />
          <Select label="Department" value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="">All departments</option>
            {departments.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Employee</th>
                <th className="px-3 py-3 text-left font-semibold">Working</th>
                <th className="px-3 py-3 text-left font-semibold">Present</th>
                <th className="px-3 py-3 text-left font-semibold">Paid Leave</th>
                <th className="px-3 py-3 text-left font-semibold">Unpaid Leave</th>
                <th className="px-3 py-3 text-left font-semibold">Half Days</th>
                <th className="px-3 py-3 text-left font-semibold">Overtime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row) => (
                <tr key={row.employeeId}>
                  <td className="px-3 py-3">
                    <div className="font-medium text-slate-900">{row.fullName}</div>
                    <div className="text-xs text-slate-500">
                      {row.employeeCode} · {row.department}
                    </div>
                  </td>
                  {(["workingDays", "presentDays", "paidLeaveDays", "unpaidLeaveDays", "halfDays", "overtimeHours"] as const).map((field) => (
                    <td key={field} className="px-3 py-3">
                      <input
                        type="number"
                        step="0.5"
                        value={row[field]}
                        onChange={(event) => updateRow(row.employeeId, field, event.target.value)}
                        className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SideSheet>
  );
};
