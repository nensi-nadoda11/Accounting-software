import { FilterX } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { ReportFilters } from "../../../types/report";
import { ReportExportButton } from "./ReportExportButton";

type Option = {
  value: string;
  label: string;
};

type FilterVisibility = {
  customer?: boolean;
  supplier?: boolean;
  product?: boolean;
  category?: boolean;
  employee?: boolean;
  department?: boolean;
  paymentMode?: boolean;
  gstRate?: boolean;
  status?: boolean;
  export?: boolean;
};

export const ReportFiltersPanel = ({
  filters,
  onChange,
  onReset,
  onExport,
  exportLoading,
  visibility,
  financialYears,
  customers,
  suppliers,
  products,
  categories,
  employees,
  departments,
  paymentModes,
  statuses,
}: {
  filters: ReportFilters;
  onChange: <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => void;
  onReset: () => void;
  onExport?: () => void;
  exportLoading?: boolean;
  visibility: FilterVisibility;
  financialYears: Option[];
  customers: Option[];
  suppliers: Option[];
  products: Option[];
  categories: Option[];
  employees: Option[];
  departments: Option[];
  paymentModes: Option[];
  statuses: Option[];
}) => (
  <Card>
    <CardContent className="space-y-3 p-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Input type="date" value={filters.dateFrom} onChange={(event) => onChange("dateFrom", event.target.value)} />
        <Input type="date" value={filters.dateTo} onChange={(event) => onChange("dateTo", event.target.value)} />
        <Select value={filters.financialYearId} onChange={(event) => onChange("financialYearId", event.target.value)}>
          <option value="">Financial Year</option>
          {financialYears.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
        {visibility.customer ? (
          <Select value={filters.customerId} onChange={(event) => onChange("customerId", event.target.value)}>
            <option value="">Customer</option>
            {customers.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        ) : null}
        {visibility.supplier ? (
          <Select value={filters.supplierId} onChange={(event) => onChange("supplierId", event.target.value)}>
            <option value="">Supplier</option>
            {suppliers.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        ) : null}
        {visibility.product ? (
          <Select value={filters.productId} onChange={(event) => onChange("productId", event.target.value)}>
            <option value="">Product</option>
            {products.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        ) : null}
        {visibility.category ? (
          <Select value={filters.categoryId} onChange={(event) => onChange("categoryId", event.target.value)}>
            <option value="">Category</option>
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        ) : null}
        {visibility.employee ? (
          <Select value={filters.employeeId} onChange={(event) => onChange("employeeId", event.target.value)}>
            <option value="">Employee</option>
            {employees.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        ) : null}
        {visibility.department ? (
          <Select value={filters.department} onChange={(event) => onChange("department", event.target.value)}>
            <option value="">Department</option>
            {departments.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        ) : null}
        {visibility.paymentMode ? (
          <Select value={filters.paymentMode} onChange={(event) => onChange("paymentMode", event.target.value)}>
            <option value="">Payment Mode</option>
            {paymentModes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        ) : null}
        {visibility.gstRate ? (
          <Input placeholder="GST Rate" value={filters.gstRate} onChange={(event) => onChange("gstRate", event.target.value)} />
        ) : null}
        {visibility.status ? (
          <Select value={filters.status} onChange={(event) => onChange("status", event.target.value)}>
            <option value="">Status</option>
            {statuses.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onReset}>
          <FilterX className="mr-2 size-4" />
          Reset
        </Button>
        {visibility.export && onExport ? <ReportExportButton onClick={onExport} loading={exportLoading} /> : null}
      </div>
    </CardContent>
  </Card>
);
