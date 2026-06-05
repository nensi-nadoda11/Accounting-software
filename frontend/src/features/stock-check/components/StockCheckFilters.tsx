import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { InventoryFilters } from "../../inventory/components/InventoryFilters";
import { InventoryLookupField } from "../../inventory/components/InventoryLookupField";
import type { LookupOption } from "../../inventory/inventoryUtils";
import type { StockCheckStatus } from "../../../types/stockCheck";

export const StockCheckFilters = ({
  search,
  status,
  warehouse,
  dateFrom,
  dateTo,
  onSearchChange,
  onStatusChange,
  onWarehouseChange,
  onDateFromChange,
  onDateToChange,
  loadWarehouseOptions,
}: {
  search: string;
  status: StockCheckStatus | "";
  warehouse: LookupOption | null;
  dateFrom: string;
  dateTo: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StockCheckStatus | "") => void;
  onWarehouseChange: (value: LookupOption | null) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  loadWarehouseOptions: (search: string) => Promise<LookupOption[]>;
}) => (
  <InventoryFilters className="md:grid-cols-2 xl:grid-cols-5">
    <Input label="Search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Check no" />
    <Select label="Status" value={status} onChange={(event) => onStatusChange(event.target.value as StockCheckStatus | "")}>
      <option value="">All Status</option>
      <option value="draft">Draft</option>
      <option value="completed">Completed</option>
      <option value="approved">Approved</option>
      <option value="cancelled">Cancelled</option>
    </Select>
    <InventoryLookupField
      label="Warehouse"
      value={warehouse}
      onChange={onWarehouseChange}
      loadOptions={loadWarehouseOptions}
      placeholder="All warehouses"
    />
    <Input type="date" label="Date From" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
    <Input type="date" label="Date To" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
  </InventoryFilters>
);
