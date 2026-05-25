import { RotateCcw, Search } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Select } from "../../../components/ui/Select";
import { BOOLEAN_FILTER_OPTIONS, CUSTOMER_STATUS_OPTIONS, CUSTOMER_TYPE_OPTIONS, SORT_BY_OPTIONS, SORT_ORDER_OPTIONS, TAX_TYPE_OPTIONS } from "../customerOptions";
import type { CustomerSortBy, CustomerStatus, CustomerType, SortOrder, TaxType } from "../../../types/customer";

type CustomerFiltersValue = {
  status: CustomerStatus | "";
  customerType: CustomerType | "";
  taxType: TaxType | "";
  hasOutstanding: "" | "true" | "false";
  isBlacklisted: "" | "true" | "false";
  sortBy: CustomerSortBy;
  sortOrder: SortOrder;
};

export const CustomerFilters = ({
  search,
  values,
  onSearchChange,
  onChange,
  onReset,
}: {
  search: string;
  values: CustomerFiltersValue;
  onSearchChange: (value: string) => void;
  onChange: (values: Partial<CustomerFiltersValue>) => void;
  onReset: () => void;
}) => (
  <Card>
    <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="relative md:col-span-2 xl:col-span-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search name, mobile, email, GST, code, business"
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
        />
      </label>
      <Select value={values.status} onChange={(event) => onChange({ status: event.target.value as CustomerStatus | "" })}>
        {CUSTOMER_STATUS_OPTIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        value={values.customerType}
        onChange={(event) => onChange({ customerType: event.target.value as CustomerType | "" })}
      >
        {CUSTOMER_TYPE_OPTIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select value={values.taxType} onChange={(event) => onChange({ taxType: event.target.value as TaxType | "" })}>
        {TAX_TYPE_OPTIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        value={values.hasOutstanding}
        onChange={(event) => onChange({ hasOutstanding: event.target.value as "" | "true" | "false" })}
      >
        {BOOLEAN_FILTER_OPTIONS.outstanding.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select
        value={values.isBlacklisted}
        onChange={(event) => onChange({ isBlacklisted: event.target.value as "" | "true" | "false" })}
      >
        {BOOLEAN_FILTER_OPTIONS.blacklisted.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select value={values.sortBy} onChange={(event) => onChange({ sortBy: event.target.value as CustomerSortBy })}>
        {SORT_BY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            Sort by {option.label}
          </option>
        ))}
      </Select>
      <div className="flex gap-3">
        <Select className="flex-1" value={values.sortOrder} onChange={(event) => onChange({ sortOrder: event.target.value as SortOrder })}>
          {SORT_ORDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" className="shrink-0" onClick={onReset}>
          <RotateCcw className="mr-2 size-4" />
          Reset
        </Button>
      </div>
    </CardContent>
  </Card>
);
