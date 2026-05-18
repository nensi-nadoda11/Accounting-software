import { Download } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Select } from "../../../components/ui/Select";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { ExpenseCategory } from "../../../types/expense";
import type {
  CategoryWiseExpenseReportRow,
  GstExpenseReportRow,
  MonthlyExpenseReportRow,
  PaymentModeExpenseReportRow,
} from "../../../types/expense";
import { EXPENSE_PAYMENT_MODE_OPTIONS, REPORT_TABS } from "../expenseOptions";
import { ExpenseTabs } from "./ExpenseTabs";
import { Input } from "../../../components/ui/Input";

type ReportTab = (typeof REPORT_TABS)[number]["id"];

type ReportFilters = {
  dateFrom: string;
  dateTo: string;
  categoryId: string;
  paymentMode: string;
  includeDrafts: boolean;
};

type ReportData = {
  categoryWise: CategoryWiseExpenseReportRow[];
  monthly: MonthlyExpenseReportRow[];
  paymentMode: PaymentModeExpenseReportRow[];
  gst: GstExpenseReportRow[];
};

export const ExpenseReportsView = ({
  activeTab,
  filters,
  categories,
  loading,
  data,
  summary,
  onTabChange,
  onFiltersChange,
  onResetFilters,
  onExport,
}: {
  activeTab: ReportTab;
  filters: ReportFilters;
  categories: ExpenseCategory[];
  loading: boolean;
  data: ReportData;
  summary: {
    count: number;
    taxableAmount: string;
    gstAmount: string;
    totalAmount: string;
  };
  onTabChange: (tab: ReportTab) => void;
  onFiltersChange: (updates: Partial<ReportFilters>) => void;
  onResetFilters: () => void;
  onExport: () => void;
}) => {
  const rows =
    activeTab === "category-wise"
      ? data.categoryWise
      : activeTab === "monthly"
        ? data.monthly
        : activeTab === "payment-mode"
          ? data.paymentMode
          : data.gst;

  return (
    <div className="space-y-4">
      <ExpenseTabs tabs={REPORT_TABS.map((item) => ({ id: item.id, label: item.label }))} activeTab={activeTab} onChange={onTabChange} />

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Input type="date" value={filters.dateFrom} onChange={(event) => onFiltersChange({ dateFrom: event.target.value })} />
          <Input type="date" value={filters.dateTo} onChange={(event) => onFiltersChange({ dateTo: event.target.value })} />
          <Select value={filters.categoryId} onChange={(event) => onFiltersChange({ categoryId: event.target.value })}>
            <option value="">All categories</option>
            {categories.filter((item) => item.status === "active").map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select value={filters.paymentMode} onChange={(event) => onFiltersChange({ paymentMode: event.target.value })}>
            <option value="">All payment modes</option>
            {EXPENSE_PAYMENT_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <ToggleSwitch checked={filters.includeDrafts} onCheckedChange={(checked) => onFiltersChange({ includeDrafts: checked })} label="Include Drafts" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onResetFilters}>
              Reset
            </Button>
            <Button type="button" variant="secondary" onClick={onExport}>
              <Download className="mr-2 size-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Expense Count</p><p className="mt-1 text-lg font-semibold text-slate-900">{summary.count}</p></div>
          <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Taxable</p><p className="mt-1 text-lg font-semibold text-slate-900">{summary.taxableAmount}</p></div>
          <div><p className="text-[11px] uppercase tracking-wide text-slate-500">GST</p><p className="mt-1 text-lg font-semibold text-slate-900">{summary.gstAmount}</p></div>
          <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p><p className="mt-1 text-lg font-semibold text-slate-900">{summary.totalAmount}</p></div>
        </CardContent>
      </Card>

      {loading ? (
        <LoadingState label="Loading reports..." />
      ) : !rows.length ? (
        <EmptyState title="No report rows found." />
      ) : activeTab === "category-wise" ? (
        <TableWrapper>
          <Table>
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["Category", "Count", "Taxable", "GST", "Amount"].map((head) => (
                  <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {data.categoryWise.map((item) => (
                <tr key={item.categoryId}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.categoryName}</td>
                  <td className="px-4 py-3">{item.expenseCount}</td>
                  <td className="px-4 py-3">{item.taxableAmount}</td>
                  <td className="px-4 py-3">{item.gstAmount}</td>
                  <td className="px-4 py-3">{item.totalAmount}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      ) : activeTab === "monthly" ? (
        <TableWrapper>
          <Table>
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["Month", "Count", "Taxable", "GST", "Amount"].map((head) => (
                  <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {data.monthly.map((item) => (
                <tr key={item.month}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.month}</td>
                  <td className="px-4 py-3">{item.expenseCount}</td>
                  <td className="px-4 py-3">{item.taxableAmount}</td>
                  <td className="px-4 py-3">{item.gstAmount}</td>
                  <td className="px-4 py-3">{item.totalAmount}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      ) : activeTab === "payment-mode" ? (
        <TableWrapper>
          <Table>
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["Payment Mode", "Count", "Amount"].map((head) => (
                  <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {data.paymentMode.map((item) => (
                <tr key={item.paymentMode}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.paymentMode}</td>
                  <td className="px-4 py-3">{item.expenseCount}</td>
                  <td className="px-4 py-3">{item.totalAmount}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      ) : (
        <TableWrapper>
          <Table>
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {["GST", "Rate", "Count", "Taxable", "CGST", "SGST", "IGST", "GST", "Amount"].map((head) => (
                  <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {data.gst.map((item, index) => (
                <tr key={`${item.gstApplicable}-${item.gstRate}-${index}`}>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.gstApplicable ? "Applicable" : "No"}</td>
                  <td className="px-4 py-3">{item.gstRate}%</td>
                  <td className="px-4 py-3">{item.expenseCount}</td>
                  <td className="px-4 py-3">{item.taxableAmount}</td>
                  <td className="px-4 py-3">{item.cgstAmount}</td>
                  <td className="px-4 py-3">{item.sgstAmount}</td>
                  <td className="px-4 py-3">{item.igstAmount}</td>
                  <td className="px-4 py-3">{item.gstAmount}</td>
                  <td className="px-4 py-3">{item.totalAmount}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
};
