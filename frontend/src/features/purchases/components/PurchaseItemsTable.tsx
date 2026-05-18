import { Plus, Trash2 } from "lucide-react";
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
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

export const PurchaseItemsTable = ({
  form,
  fields,
  warehouses,
  productLookupOptions,
  productLookupLoading,
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
      <CardContent className="space-y-3">
        {fields.map((field, index) => {
          const productId = form.watch(`items.${index}.productId`);
          const product = productId ? productDetails[productId] : undefined;
          const linePreview = preview.lines[index];

          return (
            <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="grid gap-3 lg:grid-cols-[2fr_repeat(6,minmax(0,1fr))_auto]">
                <AsyncLookupSelect
                  value={getLookupValue(index)}
                  loading={productLookupLoading}
                  options={productLookupOptions}
                  placeholder="Search product / SKU / barcode"
                  error={form.formState.errors.items?.[index]?.productId?.message}
                  onSearch={onProductSearch}
                  onSelect={(option) => onProductSelect(index, option)}
                  onClear={() => {
                    form.setValue(`items.${index}.productId`, "", { shouldDirty: true, shouldValidate: true });
                  }}
                />
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
                <button
                  type="button"
                  className="mt-8 inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 px-3 text-rose-600 transition hover:bg-rose-50"
                  onClick={() => remove(index)}
                  aria-label="Remove row"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                {product?.productType === "goods" ? (
                  <Select label="Warehouse" {...form.register(`items.${index}.warehouseId`)} error={form.formState.errors.items?.[index]?.warehouseId?.message}>
                    <option value="">Select Warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div />
                )}
                <Input
                  label="GST %"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register(`items.${index}.gstRate`)}
                  error={form.formState.errors.items?.[index]?.gstRate?.message}
                />
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
                  label="Expiry"
                  type="date"
                  {...form.register(`items.${index}.expiryDate`)}
                  error={form.formState.errors.items?.[index]?.expiryDate?.message}
                  disabled={product?.productType !== "goods"}
                />
                <div className="grid gap-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span>Taxable {linePreview?.taxableAmount ?? "0.00"}</span>
                  <span>GST {linePreview?.gstAmount ?? "0.00"}</span>
                  <span className="font-semibold text-slate-900">Total {linePreview?.lineTotal ?? "0.00"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
