import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { Warehouse } from "../../../types/inventory";
import type { SalesFormInput } from "../../../types/sales";
import { SALES_PRICE_TAX_TYPE_OPTIONS } from "../salesOptions";
import type { SalesFormValues } from "../salesSchemas";
import { buildSalesItemDefaults, type SalesPreviewTotals } from "../salesUtils";
import { AsyncLookupSelect, type LookupOption } from "./AsyncLookupSelect";

type BatchOption = {
  id: string;
  label: string;
  expiryDate: string | null;
  status: string;
  availableQuantity: string;
};

const isNearExpiry = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }

  const expiry = new Date(value);
  const warningDate = new Date(expiry);
  warningDate.setDate(warningDate.getDate() - 7);
  return new Date() >= warningDate;
};

export const SalesItemsTable = ({
  form,
  fields,
  warehouses,
  productLookupOptions,
  productLookupLoading,
  productLookupNoResultsLabel,
  batchOptions,
  loadingBatchIndex,
  preview,
  compact = false,
  getLookupValue,
  onProductSearch,
  onProductSelect,
  onBatchLoad,
  onBatchSelect,
  append,
  remove,
}: {
  form: UseFormReturn<SalesFormValues, undefined, SalesFormInput>;
  fields: FieldArrayWithId<SalesFormValues, "items", "id">[];
  warehouses: Warehouse[];
  productLookupOptions: LookupOption[];
  productLookupLoading?: boolean;
  productLookupNoResultsLabel?: string;
  batchOptions: Record<number, BatchOption[]>;
  loadingBatchIndex: number | null;
  preview: SalesPreviewTotals;
  compact?: boolean;
  getLookupValue: (index: number) => LookupOption | null;
  onProductSearch: (value: string) => void;
  onProductSelect: (index: number, option: LookupOption) => void;
  onBatchLoad: (index: number) => void;
  onBatchSelect: (index: number, batchId: string | null) => void;
  append: UseFieldArrayAppend<SalesFormValues, "items">;
  remove: UseFieldArrayRemove;
}) => {
  const headerWarehouseId = form.watch("warehouseId");
  const invoiceType = form.watch("invoiceType");

  return (
    <Card>
      <CardHeader
        title="Items"
        action={
          <Button type="button" variant="secondary" onClick={() => append(buildSalesItemDefaults(headerWarehouseId || null, invoiceType))}>
            <Plus className="mr-2 size-4" />
            Add Row
          </Button>
        }
      />
      <CardContent className="space-y-3">
        {fields.map((field, index) => {
          const linePreview = preview.lines[index];
          const productType = form.watch(`items.${index}.productType`);
          const batchTrackingEnabled = form.watch(`items.${index}.batchTrackingEnabled`);
          const selectedBatchId = String((form.watch(`items.${index}.batchId`) as string | null | undefined) ?? "");
          const batchStatus = (form.watch(`items.${index}.batchStatus`) as string | null | undefined) ?? null;
          const batchExpiryDate = (form.watch(`items.${index}.batchExpiryDate`) as string | null | undefined) ?? null;
          const availableQuantity = (form.watch(`items.${index}.availableQuantity`) as number | undefined) ?? undefined;

          return (
            <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
              <div className={`grid gap-3 ${compact ? "lg:grid-cols-[2fr_repeat(4,minmax(0,1fr))_auto]" : "lg:grid-cols-[2.2fr_repeat(6,minmax(0,1fr))_auto]"}`}>
                <AsyncLookupSelect
                  value={getLookupValue(index)}
                  loading={productLookupLoading}
                  options={productLookupOptions}
                  placeholder={compact ? "Scan barcode / search product" : "Search product / SKU / barcode"}
                  error={form.formState.errors.items?.[index]?.productId?.message}
                  noResultsLabel={productLookupNoResultsLabel ?? "No matching active products found"}
                  onSearch={onProductSearch}
                  onSelect={(option) => onProductSelect(index, option)}
                  onClear={() => {
                    form.setValue(`items.${index}.productId`, "", { shouldDirty: true, shouldValidate: true });
                    form.setValue(`items.${index}.batchId`, null, { shouldDirty: true, shouldValidate: true });
                  }}
                />
                <Input type="number" min="0" step="0.001" label="Qty" {...form.register(`items.${index}.quantity`)} error={form.formState.errors.items?.[index]?.quantity?.message} />
                <Input type="number" min="0" step="0.01" label="Sale Rate" {...form.register(`items.${index}.saleRate`)} error={form.formState.errors.items?.[index]?.saleRate?.message} />
                <Input type="number" min="0" step="0.01" label="MRP" {...form.register(`items.${index}.mrp`)} error={form.formState.errors.items?.[index]?.mrp?.message} />
                <Input type="number" min="0" max="100" step="0.01" label="Disc %" {...form.register(`items.${index}.discountPercent`)} error={form.formState.errors.items?.[index]?.discountPercent?.message} />
                {!compact ? (
                  <>
                    <Input type="number" min="0" step="0.01" label="Disc Amt" {...form.register(`items.${index}.discountAmount`)} error={form.formState.errors.items?.[index]?.discountAmount?.message} />
                    <Select label="Tax Type" {...form.register(`items.${index}.priceTaxType`)} error={form.formState.errors.items?.[index]?.priceTaxType?.message}>
                      {SALES_PRICE_TAX_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </>
                ) : null}
                <button
                  type="button"
                  className="mt-8 inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 px-3 text-rose-600 transition hover:bg-rose-50"
                  onClick={() => remove(index)}
                  aria-label="Remove row"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className={`mt-3 grid gap-3 ${compact ? "md:grid-cols-4" : "md:grid-cols-6"}`}>
                {productType === "goods" ? (
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
                <Input type="number" min="0" step="0.01" label="GST %" {...form.register(`items.${index}.gstRate`)} error={form.formState.errors.items?.[index]?.gstRate?.message} />
                {!compact ? (
                  <Input type="number" min="0" step="0.01" label="Cess %" {...form.register(`items.${index}.cessRate`)} error={form.formState.errors.items?.[index]?.cessRate?.message} />
                ) : null}
                {productType === "goods" && batchTrackingEnabled ? (
                  <Select
                    label="Batch"
                    value={selectedBatchId}
                    onFocus={() => onBatchLoad(index)}
                    onChange={(event) => onBatchSelect(index, event.target.value || null)}
                    error={form.formState.errors.items?.[index]?.batchId?.message}
                  >
                    <option value="">{loadingBatchIndex === index ? "Loading batches..." : "Select Batch"}</option>
                    {(batchOptions[index] ?? []).map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.label}
                      </option>
                    ))}
                  </Select>
                ) : compact ? null : <div />}
                {productType === "goods" && availableQuantity !== undefined ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <p className="font-medium text-slate-700">Available Stock</p>
                    <p className="mt-1">{String(availableQuantity)}</p>
                  </div>
                ) : compact ? null : <div />}
                <div className="grid gap-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span>Taxable {linePreview?.taxableAmount ?? "0.00"}</span>
                  <span>GST {linePreview?.gstAmount ?? "0.00"}</span>
                  <span className="font-semibold text-slate-900">Total {linePreview?.lineTotal ?? "0.00"}</span>
                </div>
              </div>

              {batchStatus === "expired" ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertTriangle className="size-4" />
                  Expired batch is blocked for sale.
                </div>
              ) : batchExpiryDate && isNearExpiry(batchExpiryDate) ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <AlertTriangle className="size-4" />
                  Near expiry batch selected
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
