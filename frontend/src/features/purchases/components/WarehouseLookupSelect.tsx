import { useMemo, useState } from "react";

import type { Warehouse } from "../../../types/inventory";
import { AsyncLookupSelect, type LookupOption } from "./AsyncLookupSelect";

const buildWarehouseLookupOption = (warehouse: Warehouse): LookupOption => ({
  id: warehouse.id,
  label: warehouse.name,
  description: warehouse.warehouseCode ?? null,
  meta: warehouse.city ?? warehouse.state ?? null,
});

const matchesWarehouse = (warehouse: Warehouse, search: string) => {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return true;
  }

  return [warehouse.name, warehouse.warehouseCode, warehouse.city, warehouse.state]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedSearch));
};

export const WarehouseLookupSelect = ({
  label = "Warehouse",
  required,
  value,
  warehouses,
  error,
  placeholder = "Search warehouse",
  noResultsLabel = "No matching warehouses found",
  onChange,
}: {
  label?: string;
  required?: boolean;
  value: string | null | undefined;
  warehouses: Warehouse[];
  error?: string;
  placeholder?: string;
  noResultsLabel?: string;
  onChange: (value: string | null) => void;
}) => {
  const [options, setOptions] = useState<LookupOption[]>([]);

  const selectedOption = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === (value ?? "")) ?? null,
    [value, warehouses],
  );

  return (
    <AsyncLookupSelect
      label={label}
      required={required}
      value={selectedOption ? buildWarehouseLookupOption(selectedOption) : null}
      options={options}
      placeholder={placeholder}
      error={error}
      idleLabel="Select from warehouse list"
      noResultsLabel={noResultsLabel}
      onSearch={(searchValue) => {
        const matches = warehouses.filter((warehouse) => matchesWarehouse(warehouse, searchValue)).slice(0, 20).map(buildWarehouseLookupOption);
        setOptions(matches);
      }}
      onSelect={(option) => onChange(option.id)}
      onClear={() => onChange(null)}
    />
  );
};
