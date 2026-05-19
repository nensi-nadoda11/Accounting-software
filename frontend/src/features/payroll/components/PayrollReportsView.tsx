import { Download } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pagination } from "../../../components/ui/Pagination";
import { Select } from "../../../components/ui/Select";
import { Table, TableWrapper } from "../../../components/ui/Table";
import type { Employee, PaginationMeta, PayrollPaymentMode } from "../../../types/payroll";
import { PAYROLL_PAYMENT_MODE_OPTIONS, PAYROLL_REPORT_OPTIONS } from "../payrollOptions";

type ReportTab = (typeof PAYROLL_REPORT_OPTIONS)[number]["id"];

type SummaryMetric = { label: string; value: string | number };
type ReportRow = Record<string, unknown>;

export const PayrollReportsView = ({
  activeTab,
  employees,
  departments,
  filters,
  loading,
  summary,
  data,
  pagination,
  onTabChange,
  onFiltersChange,
  onResetFilters,
  onExport,
  onPageChange,
}: {
  activeTab: ReportTab;
  employees: Employee[];
  departments: string[];
  filters: {
    month: string;
    dateFrom: string;
    dateTo: string;
    employeeId: string;
    department: string;
    paymentMode: PayrollPaymentMode | "";
    includeCancelled: boolean;
  };
  loading: boolean;
  summary: SummaryMetric[];
  data: ReportRow[];
  pagination?: PaginationMeta | null;
  onTabChange: (tab: ReportTab) => void;
  onFiltersChange: (updates: Partial<{
    month: string;
    dateFrom: string;
    dateTo: string;
    employeeId: string;
    department: string;
    paymentMode: PayrollPaymentMode | "";
    includeCancelled: boolean;
  }>) => void;
  onResetFilters: () => void;
  onExport: () => void;
  onPageChange: (page: number) => void;
}) => {
  const headers = data[0] ? Object.keys(data[0]) : [];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-full gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {PAYROLL_REPORT_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={activeTab === tab.id ? "rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white" : "rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Select value={filters.month} onChange={(event) => onFiltersChange({ month: event.target.value })}>
            <option value="">All payroll months</option>
            {Array.from({ length: 12 }).map((_, index) => {
              const date = new Date();
              date.setMonth(date.getMonth() - index);
              const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
              return (
                <option key={value} value={value}>
                  {value}
                </option>
              );
            })}
          </Select>
          <Select value={filters.employeeId} onChange={(event) => onFiltersChange({ employeeId: event.target.value })}>
            <option value="">All employees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </Select>
          <Select value={filters.department} onChange={(event) => onFiltersChange({ department: event.target.value })}>
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </Select>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => onFiltersChange({ dateFrom: event.target.value })}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => onFiltersChange({ dateTo: event.target.value })}
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
          />
          <Select value={filters.paymentMode} onChange={(event) => onFiltersChange({ paymentMode: event.target.value as PayrollPaymentMode | "" })}>
            <option value="">All payment modes</option>
            {PAYROLL_PAYMENT_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={filters.includeCancelled}
              onChange={(event) => onFiltersChange({ includeCancelled: event.target.checked })}
              className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Include cancelled
          </label>
          <div className="flex justify-end gap-2 xl:col-span-5">
            <Button variant="secondary" onClick={onResetFilters}>
              Reset
            </Button>
            <Button variant="secondary" onClick={onExport}>
              <Download className="mr-2 size-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary.length > 0 ? (
        <Card>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {summary.map((metric) => (
              <div key={metric.label}>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{metric.label}</p>
                {typeof metric.value === "string" && /^-?\d+(\.\d+)?$/.test(metric.value) ? (
                  <p className="mt-1 text-lg font-semibold text-slate-900"><AmountText value={metric.value} tone="default" /></p>
                ) : (
                  <p className="mt-1 text-lg font-semibold text-slate-900">{metric.value}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {!loading && data.length === 0 ? (
        <EmptyState title="No report data found." />
      ) : (
        <TableWrapper>
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="px-4 py-3 font-semibold">
                      {header.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={Math.max(headers.length, 1)} className="px-4 py-10 text-center text-sm text-slate-500">
                      Loading report...
                    </td>
                  </tr>
                ) : (
                  data.map((row, index) => (
                    <tr key={index}>
                      {headers.map((header) => {
                        const value = row[header];
                        return (
                          <td key={header} className="px-4 py-3 text-slate-600">
                            {typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value) ? (
                              <AmountText value={value} tone="default" />
                            ) : (
                              String(value ?? "-")
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </TableWrapper>
      )}
      {pagination ? <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={onPageChange} /> : null}
    </div>
  );
};
