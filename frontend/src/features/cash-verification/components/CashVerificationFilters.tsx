import { Search } from "lucide-react";

import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { CashVerificationRecordStatus, CashVerificationStatus } from "../../../types/cashVerification";

export const CashVerificationFilters = ({
  search,
  status,
  recordStatus,
  dateFrom,
  dateTo,
  onSearchChange,
  onStatusChange,
  onRecordStatusChange,
  onDateFromChange,
  onDateToChange,
}: {
  search: string;
  status: CashVerificationStatus | "";
  recordStatus: CashVerificationRecordStatus | "";
  dateFrom: string;
  dateTo: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: CashVerificationStatus | "") => void;
  onRecordStatusChange: (value: CashVerificationRecordStatus | "") => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
}) => (
  <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
    <div className="relative md:col-span-1">
      <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search"
        className="pl-9"
      />
    </div>
    <Select value={status} onChange={(event) => onStatusChange(event.target.value as CashVerificationStatus | "")}>
      <option value="">All Status</option>
      <option value="matched">Matched</option>
      <option value="short_cash">Short Cash</option>
      <option value="excess_cash">Excess Cash</option>
    </Select>
    <Select
      value={recordStatus}
      onChange={(event) => onRecordStatusChange(event.target.value as CashVerificationRecordStatus | "")}
    >
      <option value="">All Records</option>
      <option value="draft">Draft</option>
      <option value="completed">Completed</option>
      <option value="approved">Approved</option>
      <option value="cancelled">Cancelled</option>
    </Select>
    <Input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
    <Input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
  </div>
);
