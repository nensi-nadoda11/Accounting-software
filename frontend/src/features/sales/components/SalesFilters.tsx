import { RotateCcw } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import { Select } from "../../../components/ui/Select";
import type { CustomerListItem } from "../../../types/customer";
import type { Warehouse } from "../../../types/inventory";
import type { InvoiceStatus, InvoiceType, PaymentStatus } from "../../../types/sales";
import {
  SALES_INVOICE_TYPE_OPTIONS,
  SALES_PAYMENT_STATUS_OPTIONS,
  SALES_STATUS_OPTIONS,
} from "../salesOptions";

export const SalesFilters = ({
  search,
  values,
  customers,
  warehouses,
  onSearchChange,
  onChange,
  onReset,
}: {
  search: string;
  values: {
    invoiceStatus: InvoiceStatus | "";
    paymentStatus: PaymentStatus | "";
    customerId: string;
    warehouseId: string;
    invoiceType: InvoiceType | "";
    dateFrom: string;
    dateTo: string;
  };
  customers: CustomerListItem[];
  warehouses: Warehouse[];
  onSearchChange: (value: string) => void;
  onChange: (
    value: Partial<{
      invoiceStatus: string;
      paymentStatus: string;
      customerId: string;
      warehouseId: string;
      invoiceType: string;
      dateFrom: string;
      dateTo: string;
    }>,
  ) => void;
  onReset: () => void;
}) => (
  <Card>
    <CardContent className="grid gap-3 lg:grid-cols-[2fr_repeat(6,minmax(0,1fr))_auto]">
      <Input
        value={search}
        placeholder="Search invoice no, customer, mobile"
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <Select value={values.invoiceStatus} onChange={(event) => onChange({ invoiceStatus: event.target.value })}>
        {SALES_STATUS_OPTIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select value={values.paymentStatus} onChange={(event) => onChange({ paymentStatus: event.target.value })}>
        {SALES_PAYMENT_STATUS_OPTIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select value={values.invoiceType} onChange={(event) => onChange({ invoiceType: event.target.value })}>
        {SALES_INVOICE_TYPE_OPTIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select value={values.customerId} onChange={(event) => onChange({ customerId: event.target.value })}>
        <option value="">All Customers</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </Select>
      <SearchableSelect
        value={values.warehouseId}
        options={warehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name, description: warehouse.warehouseCode ?? null }))}
        placeholder="All Warehouses"
        searchPlaceholder="Search warehouse"
        onChange={(value) => onChange({ warehouseId: value })}
        allowClear
      />
      <Input type="date" value={values.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} />
      <Input type="date" value={values.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} />
      <Button type="button" variant="secondary" onClick={onReset} aria-label="Reset filters" title="Reset filters">
        <RotateCcw className="size-4" />
      </Button>
    </CardContent>
  </Card>
);
