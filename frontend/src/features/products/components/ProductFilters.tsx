import { RotateCcw } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type {
  ProductCategory,
  ProductSortBy,
  ProductStatus,
  ProductType,
  ProductUnit,
  SortOrder,
  TaxType,
} from "../../../types/product";
import {
  BOOLEAN_FILTER_OPTIONS,
  GST_RATE_OPTIONS,
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  SORT_BY_OPTIONS,
  SORT_ORDER_OPTIONS,
  TAX_TYPE_OPTIONS,
} from "../productOptions";

type BooleanFilterValue = "" | "true" | "false";

export const ProductFilters = ({
  search,
  categories,
  units,
  values,
  onSearchChange,
  onChange,
  onReset,
}: {
  search: string;
  categories: ProductCategory[];
  units: ProductUnit[];
  values: {
    productType: ProductType | "";
    categoryId: string;
    unitId: string;
    gstRate: string;
    status: ProductStatus | "";
    stockTrackingEnabled: BooleanFilterValue;
    lowStock: BooleanFilterValue;
    taxType: TaxType | "";
    sortBy: ProductSortBy;
    sortOrder: SortOrder;
  };
  onSearchChange: (value: string) => void;
  onChange: (values: Partial<{
    productType: ProductType | "";
    categoryId: string;
    unitId: string;
    gstRate: string;
    status: ProductStatus | "";
    stockTrackingEnabled: BooleanFilterValue;
    lowStock: BooleanFilterValue;
    taxType: TaxType | "";
    sortBy: ProductSortBy;
    sortOrder: SortOrder;
  }>) => void;
  onReset: () => void;
}) => (
  <Card>
    <CardContent className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          label="Search"
          placeholder="Name, SKU, barcode, HSN, category, brand, product code"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="lg:flex-1"
        />
        <div className="flex items-end gap-2">
          <Button type="button" variant="secondary" onClick={onReset}>
            <RotateCcw className="mr-2 size-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Select
          label="Type"
          value={values.productType}
          onChange={(event) => onChange({ productType: event.target.value as ProductType | "" })}
        >
          {PRODUCT_TYPE_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select label="Category" value={values.categoryId} onChange={(event) => onChange({ categoryId: event.target.value })}>
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select label="Unit" value={values.unitId} onChange={(event) => onChange({ unitId: event.target.value })}>
          <option value="">All Units</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} ({unit.symbol})
            </option>
          ))}
        </Select>
        <Select label="GST %" value={values.gstRate} onChange={(event) => onChange({ gstRate: event.target.value })}>
          <option value="">All GST</option>
          {GST_RATE_OPTIONS.map((rate) => (
            <option key={rate} value={String(rate)}>
              {rate}%
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          value={values.status}
          onChange={(event) => onChange({ status: event.target.value as ProductStatus | "" })}
        >
          {PRODUCT_STATUS_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          label="Stock Tracking"
          value={values.stockTrackingEnabled}
          onChange={(event) =>
            onChange({ stockTrackingEnabled: event.target.value as BooleanFilterValue })
          }
        >
          {BOOLEAN_FILTER_OPTIONS.stockTracking.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          label="Low Stock"
          value={values.lowStock}
          onChange={(event) => onChange({ lowStock: event.target.value as BooleanFilterValue })}
        >
          {BOOLEAN_FILTER_OPTIONS.lowStock.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          label="Tax Type"
          value={values.taxType}
          onChange={(event) => onChange({ taxType: event.target.value as TaxType | "" })}
        >
          {TAX_TYPE_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select label="Sort By" value={values.sortBy} onChange={(event) => onChange({ sortBy: event.target.value as ProductSortBy })}>
          {SORT_BY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          label="Order"
          value={values.sortOrder}
          onChange={(event) => onChange({ sortOrder: event.target.value as SortOrder })}
        >
          {SORT_ORDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </CardContent>
  </Card>
);
