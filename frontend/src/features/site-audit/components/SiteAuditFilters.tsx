import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SearchableSelect, type SearchableSelectOption } from "../../../components/ui/SearchableSelect";
import type { SiteAuditFinalResult, SiteAuditStatus } from "../../../types/siteAudit";

export const SiteAuditFilters = ({
  search,
  status,
  finalResult,
  warehouseId,
  auditorId,
  dateFrom,
  dateTo,
  warehouseOptions,
  auditorOptions,
  onSearchChange,
  onStatusChange,
  onFinalResultChange,
  onWarehouseChange,
  onAuditorChange,
  onDateFromChange,
  onDateToChange,
}: {
  search: string;
  status: SiteAuditStatus | "";
  finalResult: SiteAuditFinalResult | "";
  warehouseId: string;
  auditorId: string;
  dateFrom: string;
  dateTo: string;
  warehouseOptions: SearchableSelectOption[];
  auditorOptions: SearchableSelectOption[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: SiteAuditStatus | "") => void;
  onFinalResultChange: (value: SiteAuditFinalResult | "") => void;
  onWarehouseChange: (value: string) => void;
  onAuditorChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}) => (
  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4 xl:grid-cols-6">
    <Input label="Search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Audit no" />
    <Select label="Status" value={status} onChange={(event) => onStatusChange(event.target.value as SiteAuditStatus | "")}>
      <option value="">All</option>
      <option value="draft">Draft</option>
      <option value="completed">Completed</option>
      <option value="approved">Approved</option>
      <option value="cancelled">Cancelled</option>
    </Select>
    <Select
      label="Final Result"
      value={finalResult}
      onChange={(event) => onFinalResultChange(event.target.value as SiteAuditFinalResult | "")}
    >
      <option value="">All</option>
      <option value="passed">Passed</option>
      <option value="issues_found">Issues Found</option>
      <option value="needs_review">Needs Review</option>
    </Select>
    <SearchableSelect
      label="Warehouse"
      value={warehouseId}
      options={warehouseOptions}
      onChange={onWarehouseChange}
      allowClear
    />
    <SearchableSelect label="Auditor" value={auditorId} options={auditorOptions} onChange={onAuditorChange} allowClear />
    <div className="grid grid-cols-2 gap-2 md:col-span-2 xl:col-span-1">
      <Input label="From" type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
      <Input label="To" type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
    </div>
  </div>
);
