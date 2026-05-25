import { RotateCcw, Search } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Select } from "../../../components/ui/Select";
import type { SortOrder, SupplierStatus, SupplierType, TaxType } from "../../../types/supplier";
import {
  BOOLEAN_FILTER_OPTIONS,
  SORT_ORDER_OPTIONS,
  SUPPLIER_STATUS_OPTIONS,
  SUPPLIER_TAX_TYPE_OPTIONS,
  SUPPLIER_TYPE_OPTIONS,
} from "../supplierOptions";

type SupplierFiltersValue = {
  status: SupplierStatus | "";
  supplierType: SupplierType | "";
  taxType: TaxType | "";
  isBlacklisted: "" | "true" | "false";
  sortOrder: SortOrder;
};

export const SupplierFilters = ({
  search,
  values,
  onSearchChange,
  onChange,
  onReset,
}: {
  search: string;
  values: SupplierFiltersValue;
  onSearchChange: (value: string) => void;
  onChange: (values: Partial<SupplierFiltersValue>) => void;
  onReset: () => void;
}) => (
  <Card>
    <CardContent className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,1fr))]">
        <label className="relative md:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name, mobile, email, GST, code, business"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
          />
        </label>
        <Select value={values.status} onChange={(event) => onChange({ status: event.target.value as SupplierStatus | "" })}>
          {SUPPLIER_STATUS_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={values.supplierType}
          onChange={(event) => onChange({ supplierType: event.target.value as SupplierType | "" })}
        >
          {SUPPLIER_TYPE_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select value={values.taxType} onChange={(event) => onChange({ taxType: event.target.value as TaxType | "" })}>
          {SUPPLIER_TAX_TYPE_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
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
        <Select value={values.sortOrder} onChange={(event) => onChange({ sortOrder: event.target.value as SortOrder })}>
          {SORT_ORDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <div className="flex items-end">
          <Button type="button" variant="secondary" className="w-full md:w-auto" onClick={onReset}>
            <RotateCcw className="mr-2 size-4" />
            Reset
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);
