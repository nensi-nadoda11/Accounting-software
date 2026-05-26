import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type {
  ProductCategory,
  ProductStatus,
  ProductType,
} from "../../../types/product";
import {
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  BOOLEAN_FILTER_OPTIONS,
} from "../productOptions";

type BooleanFilterValue = "" | "true" | "false";

export const ProductFilters = ({
  search,
  categories,
  values,
  onSearchChange,
  onChange,
}: {
  search: string;
  categories: ProductCategory[];
  values: {
    productType: ProductType | "";
    categoryId: string;
    status: ProductStatus | "";
    lowStock: BooleanFilterValue;
  };
  onSearchChange: (value: string) => void;
  onChange: (values: Partial<{
    productType: ProductType | "";
    categoryId: string;
    status: ProductStatus | "";
    lowStock: BooleanFilterValue;
  }>) => void;
}) => (
  <Card>
    <CardContent>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.15fr)_repeat(4,minmax(0,1fr))] xl:items-end">
        <Input
          label="Search"
          placeholder="Name, SKU, barcode, HSN, category"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full"
        />
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
      </div>
    </CardContent>
  </Card>
);
