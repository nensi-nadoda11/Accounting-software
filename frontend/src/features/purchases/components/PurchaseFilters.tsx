import { RotateCcw } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { PURCHASE_PAYMENT_STATUS_OPTIONS, PURCHASE_STATUS_OPTIONS } from "../purchaseOptions";
import type { PaymentStatus, PurchaseStatus } from "../../../types/purchase";

export const PurchaseFilters = ({
  search,
  values,
  showPurchaseStatus = true,
  showPaymentStatus = true,
  onSearchChange,
  onChange,
  onReset,
}: {
  search: string;
  values: {
    purchaseStatus: PurchaseStatus | "";
    paymentStatus: PaymentStatus | "";
    dateFrom: string;
    dateTo: string;
  };
  showPurchaseStatus?: boolean;
  showPaymentStatus?: boolean;
  onSearchChange: (value: string) => void;
  onChange: (value: Partial<{ purchaseStatus: string; paymentStatus: string; dateFrom: string; dateTo: string }>) => void;
  onReset: () => void;
}) => (
  <Card>
    <CardContent className="grid gap-4 xl:grid-cols-[minmax(16rem,1.55fr)_minmax(10rem,0.72fr)_minmax(10rem,0.72fr)_minmax(9rem,0.62fr)_minmax(9rem,0.62fr)_auto] xl:items-end">
      <div className="min-w-0">
        <Input
          label="Search"
          value={search}
          placeholder="Search purchase no, supplier, supplier invoice no, warehouse"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      {showPurchaseStatus ? (
        <div className="min-w-0">
          <Select
            label="Purchase Status"
            value={values.purchaseStatus}
            onChange={(event) => onChange({ purchaseStatus: event.target.value })}
          >
            {PURCHASE_STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      {showPaymentStatus ? (
        <div className="min-w-0">
          <Select
            label="Payment Status"
            value={values.paymentStatus}
            onChange={(event) => onChange({ paymentStatus: event.target.value })}
          >
            {PURCHASE_PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className="min-w-0">
        <Input
          label="From Date"
          type="date"
          value={values.dateFrom}
          onChange={(event) => onChange({ dateFrom: event.target.value })}
        />
      </div>
      <div className="min-w-0">
        <Input
          label="To Date"
          type="date"
          value={values.dateTo}
          onChange={(event) => onChange({ dateTo: event.target.value })}
        />
      </div>
      <div className="flex xl:justify-end">
        <Button type="button" variant="secondary" className="shrink-0" onClick={onReset} aria-label="Reset filters">
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </CardContent>
  </Card>
);
