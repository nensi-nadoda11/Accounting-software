import { Download } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Select } from "../../../components/ui/Select";
import type { ReportExportRecord, ReportFormat, ReportType } from "../../../types/report";
import { ReportTable } from "./ReportTable";
import { StatusBadge } from "./StatusBadge";
import { TableActionIconButton } from "./TableActionIconButton";

export const ReportExportCenter = ({
  reportType,
  format,
  onReportTypeChange,
  onFormatChange,
  onExport,
  exporting,
  exports,
}: {
  reportType: ReportType;
  format: ReportFormat;
  onReportTypeChange: (value: ReportType) => void;
  onFormatChange: (value: ReportFormat) => void;
  onExport: () => void;
  exporting?: boolean;
  exports: ReportExportRecord[];
}) => (
  <div className="space-y-4">
    <Card>
      <CardContent className="grid gap-3 p-4 md:grid-cols-3">
        <Select value={reportType} onChange={(event) => onReportTypeChange(event.target.value as ReportType)}>
          {REPORT_TYPE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        <Select value={format} onChange={(event) => onFormatChange(event.target.value as ReportFormat)}>
          <option value="xlsx">XLSX</option>
          <option value="pdf">PDF</option>
        </Select>
        <Button type="button" onClick={onExport} loading={exporting}>
          <Download className="mr-2 size-4" />
          Generate Export
        </Button>
      </CardContent>
    </Card>

    <ReportTable
      items={exports}
      columns={[
        { key: "reportType", label: "Report" },
        { key: "exportFormat", label: "Format" },
        { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
        { key: "createdAt", label: "Created At" },
        {
          key: "actions",
          label: "",
          render: (item) =>
            item.fileUrl ? (
              <TableActionIconButton label="Download" icon={<Download className="size-4" />} onClick={() => window.open(item.fileUrl!, "_blank", "noopener,noreferrer")} />
            ) : <span className="text-xs text-slate-400">Server download not stored</span>,
        },
      ]}
      emptyText="No export history yet"
    />
  </div>
);

const REPORT_TYPE_OPTIONS: Array<{ value: ReportType; label: string }> = [
  { value: "sales.detailed", label: "Sales Detailed" },
  { value: "sales.top-customers", label: "Sales Top Customers" },
  { value: "sales.top-products", label: "Sales Top Products" },
  { value: "purchases.detailed", label: "Purchase Detailed" },
  { value: "customers.outstanding", label: "Customer Outstanding" },
  { value: "customers.aging", label: "Customer Aging" },
  { value: "suppliers.outstanding", label: "Supplier Outstanding" },
  { value: "suppliers.aging", label: "Supplier Aging" },
  { value: "inventory.current-stock", label: "Inventory Current Stock" },
  { value: "inventory.valuation", label: "Inventory Valuation" },
  { value: "inventory.expiry", label: "Inventory Expiry" },
  { value: "inventory.movement", label: "Inventory Movement" },
  { value: "inventory.low-stock", label: "Inventory Low Stock" },
  { value: "expenses.category-wise", label: "Expense Category Wise" },
  { value: "expenses.monthly", label: "Expense Monthly" },
  { value: "expenses.payment-mode", label: "Expense Payment Mode" },
  { value: "income.monthly", label: "Income Monthly" },
  { value: "payroll.monthly", label: "Payroll Monthly" },
  { value: "payroll.employee", label: "Payroll Employee" },
  { value: "payroll.department", label: "Payroll Department" },
  { value: "gst.summary", label: "GST Summary" },
  { value: "gst.hsn", label: "GST HSN" },
  { value: "accounting.trial-balance", label: "Trial Balance" },
  { value: "accounting.profit-loss", label: "Profit & Loss" },
  { value: "accounting.balance-sheet", label: "Balance Sheet" },
  { value: "accounting.cash-book", label: "Cash Book" },
  { value: "accounting.bank-book", label: "Bank Book" },
];
