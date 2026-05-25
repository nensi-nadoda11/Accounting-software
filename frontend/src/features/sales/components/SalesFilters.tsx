import { RotateCcw } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { InvoiceStatus, PaymentStatus } from "../../../types/sales";
import {
  SALES_PAYMENT_STATUS_OPTIONS,
  SALES_STATUS_OPTIONS,
} from "../salesOptions";

export const SalesFilters = ({
  search,
  values,
  onSearchChange,
  onChange,
  onReset,
}: {
  search: string;
  values: {
    invoiceStatus: InvoiceStatus | "";
    paymentStatus: PaymentStatus | "";
    dateFrom: string;
    dateTo: string;
  };
  onSearchChange: (value: string) => void;
  onChange: (
    value: Partial<{
      invoiceStatus: string;
      paymentStatus: string;
      dateFrom: string;
      dateTo: string;
    }>,
  ) => void;
  onReset: () => void;
}) => (
  <Card>
    <CardContent>
      <div className="grid gap-3 lg:grid-cols-[minmax(12rem,1.2fr)_minmax(9rem,0.85fr)_minmax(9.5rem,0.95fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
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
        <Input type="date" value={values.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} />
        <Input type="date" value={values.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} />
        <Button
          type="button"
          variant="secondary"
          className="w-11 px-0"
          onClick={onReset}
          aria-label="Reset filters"
          title="Reset filters"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </CardContent>
  </Card>
);
