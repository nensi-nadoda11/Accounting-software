import { Plus, Trash2 } from "lucide-react";
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { AmountText } from "../../../components/ui/AmountText";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { Warehouse } from "../../../types/inventory";
import type { Product } from "../../../types/product";
import { PURCHASE_PRICE_TAX_TYPE_OPTIONS } from "../purchaseOptions";
import type { PurchaseFormValues } from "../purchaseSchemas";
import type { PurchasePreviewTotals } from "../purchaseUtils";
import type { PurchaseFormInput } from "../../../types/purchase";
import { AsyncLookupSelect, type LookupOption } from "./AsyncLookupSelect";
import { WarehouseLookupSelect } from "./WarehouseLookupSelect";

export const PurchaseItemsTable = ({
  form,
  fields,
  warehouses,
  productLookupOptions,
  productLookupLoading,
  productLookupNoResultsLabel,
  productDetails,
  preview,
  getLookupValue,
  onProductSearch,
  onProductSelect,
  append,
  remove,
}: {
  form: UseFormReturn<PurchaseFormValues, undefined, PurchaseFormInput>;
  fields: FieldArrayWithId<PurchaseFormValues, "items", "id">[];
  warehouses: Warehouse[];
  productLookupOptions: LookupOption[];
  productLookupLoading?: boolean;
  productLookupNoResultsLabel?: string;
  productDetails: Record<string, Product>;
  preview: PurchasePreviewTotals;
  getLookupValue: (index: number) => LookupOption | null;
  onProductSearch: (value: string) => void;
  onProductSelect: (index: number, option: LookupOption) => void;
  append: UseFieldArrayAppend<PurchaseFormValues, "items">;
  remove: UseFieldArrayRemove;
}) => {
  const headerWarehouseId = form.watch("warehouseId");

  return (
    <Card>
      <CardHeader
        title="Items"
        action={
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              append({
                productId: "",
                warehouseId: headerWarehouseId ?? null,
                batchId: null,
                batchNumber: null,
                quantity: 1,
                freeQuantity: 0,
                purchaseRate: 0,
                priceTaxType: "exclusive",
                discountPercent: 0,
                discountAmount: 0,
                gstRate: 0,
                cessRate: 0,
                manufacturingDate: null,
                expiryDate: null,
                remarks: null,
              })
            }
          >
            <Plus className="mr-2 size-4" />
            Add Row
          </Button>
        }
      />
      <CardContent className="space-y-5">
        {headerWarehouseId ? <p className="text-sm text-slate-500">Using the default warehouse for all item rows.</p> : null}
        {fields.map((field, index) => {
          const productId = form.watch(`items.${index}.productId`);
          const product = productId ? productDetails[productId] : undefined;
          const linePreview = preview.lines[index];
          const showItemWarehouse = product?.productType === "goods" && !headerWarehouseId;

          return (
            <div key={field.id} className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,2.8fr)_88px_100px_112px_132px] xl:items-start">
                <div className="min-w-0">
                  <AsyncLookupSelect
                    label="Product / SKU"
                    value={getLookupValue(index)}
                    loading={productLookupLoading}
                    options={productLookupOptions}
                    placeholder="Search product / SKU"
                    error={form.formState.errors.items?.[index]?.productId?.message}
                    noResultsLabel={productLookupNoResultsLabel ?? "No matching active products found"}
                    onSearch={onProductSearch}
                    onSelect={(option) => onProductSelect(index, option)}
                    onClear={() => {
                      form.setValue(`items.${index}.productId`, "", { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                </div>
                <Input
                  type="number"
                  min="0"
                  step={product?.unit?.id && product?.productType === "goods" && !product?.stockTrackingEnabled ? "0.001" : "0.001"}
                  label="Qty"
                  {...form.register(`items.${index}.quantity`)}
                  error={form.formState.errors.items?.[index]?.quantity?.message}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  label="Free Qty"
                  {...form.register(`items.${index}.freeQuantity`)}
                  error={form.formState.errors.items?.[index]?.freeQuantity?.message}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  label="Rate"
                  {...form.register(`items.${index}.purchaseRate`)}
                  error={form.formState.errors.items?.[index]?.purchaseRate?.message}
                />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-slate-700">Amount</span>
                  <div className="flex h-11 items-center justify-end rounded-xl border border-slate-200 bg-white px-3">
                    <AmountText value={linePreview?.lineTotal ?? 0} className="text-base" />
                  </div>
                </div>
              </div>

              <div
                className={`mt-4 grid gap-3 lg:grid-cols-2 ${
                  showItemWarehouse
                    ? "xl:grid-cols-[minmax(0,1.3fr)_96px_110px_120px_140px]"
                    : "xl:grid-cols-[minmax(0,1.4fr)_110px_120px_120px]"
                } xl:items-end`}
              >
                <Select
                  label="Tax Type"
                  {...form.register(`items.${index}.priceTaxType`)}
                  error={form.formState.errors.items?.[index]?.priceTaxType?.message}
                >
                  {PURCHASE_PRICE_TAX_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  label="Disc %"
                  {...form.register(`items.${index}.discountPercent`)}
                  error={form.formState.errors.items?.[index]?.discountPercent?.message}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  label="Disc Amt"
                  {...form.register(`items.${index}.discountAmount`)}
                  error={form.formState.errors.items?.[index]?.discountAmount?.message}
                />
                <Input
                  label="GST %"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register(`items.${index}.gstRate`)}
                  error={form.formState.errors.items?.[index]?.gstRate?.message}
                />
                {showItemWarehouse ? (
                  <div className="min-w-0">
                    <WarehouseLookupSelect
                      value={(form.watch(`items.${index}.warehouseId`) as string | null | undefined) ?? ""}
                      warehouses={warehouses}
                      error={form.formState.errors.items?.[index]?.warehouseId?.message}
                      onChange={(value) => form.setValue(`items.${index}.warehouseId`, value, { shouldDirty: true, shouldValidate: true })}
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_120px] xl:items-end">
                <Input
                  label="Batch No"
                  {...form.register(`items.${index}.batchNumber`)}
                  error={form.formState.errors.items?.[index]?.batchNumber?.message}
                  disabled={product?.productType !== "goods"}
                />
                <Input
                  label="MFG Date"
                  type="date"
                  {...form.register(`items.${index}.manufacturingDate`)}
                  error={form.formState.errors.items?.[index]?.manufacturingDate?.message}
                  disabled={product?.productType !== "goods"}
                />
                <Input
                  label="Expiry Date"
                  type="date"
                  {...form.register(`items.${index}.expiryDate`)}
                  error={form.formState.errors.items?.[index]?.expiryDate?.message}
                  disabled={product?.productType !== "goods"}
                />
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-rose-600 transition hover:bg-rose-50 xl:mb-[1px]"
                  onClick={() => remove(index)}
                  aria-label="Remove row"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
