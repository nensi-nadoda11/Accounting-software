import { RotateCcw } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { Warehouse } from "../../../types/inventory";
import type { SupplierListItem } from "../../../types/supplier";
import { PURCHASE_PAYMENT_STATUS_OPTIONS, PURCHASE_STATUS_OPTIONS } from "../purchaseOptions";
import type { PaymentStatus, PurchaseStatus } from "../../../types/purchase";
import { WarehouseLookupSelect } from "./WarehouseLookupSelect";

export const PurchaseFilters = ({
  search,
  values,
  suppliers,
  warehouses,
  onSearchChange,
  onChange,
  onReset,
}: {
  search: string;
  values: {
    purchaseStatus: PurchaseStatus | "";
    paymentStatus: PaymentStatus | "";
    supplierId: string;
    warehouseId: string;
    dateFrom: string;
    dateTo: string;
  };
  suppliers: SupplierListItem[];
  warehouses: Warehouse[];
  onSearchChange: (value: string) => void;
  onChange: (value: Partial<{ purchaseStatus: string; paymentStatus: string; supplierId: string; warehouseId: string; dateFrom: string; dateTo: string }>) => void;
  onReset: () => void;
}) => (
  <Card>
    <CardContent className="grid gap-3 lg:grid-cols-[2fr_repeat(5,minmax(0,1fr))_auto]">
      <Input
        value={search}
        placeholder="Search purchase no, supplier, supplier invoice no"
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <Select value={values.purchaseStatus} onChange={(event) => onChange({ purchaseStatus: event.target.value })}>
        {PURCHASE_STATUS_OPTIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select value={values.paymentStatus} onChange={(event) => onChange({ paymentStatus: event.target.value })}>
        {PURCHASE_PAYMENT_STATUS_OPTIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select value={values.supplierId} onChange={(event) => onChange({ supplierId: event.target.value })}>
        <option value="">All Suppliers</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </Select>
      <WarehouseLookupSelect
        label={undefined}
        value={values.warehouseId}
        warehouses={warehouses}
        placeholder="All Warehouses"
        noResultsLabel="No matching warehouses found"
        onChange={(value) => onChange({ warehouseId: value ?? "" })}
      />
      <Input type="date" value={values.dateFrom} onChange={(event) => onChange({ dateFrom: event.target.value })} />
      <Input type="date" value={values.dateTo} onChange={(event) => onChange({ dateTo: event.target.value })} />
      <Button type="button" variant="secondary" onClick={onReset}>
        <RotateCcw className="size-4" />
      </Button>
    </CardContent>
  </Card>
);
