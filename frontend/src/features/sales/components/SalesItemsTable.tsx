import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn } from "react-hook-form";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
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
  const [pendingQuickAdd, setPendingQuickAdd] = useState<{ index: number; option: LookupOption } | null>(null);

  useEffect(() => {
    if (!pendingQuickAdd || !fields[pendingQuickAdd.index]) {
      return;
    }

    void onProductSelect(pendingQuickAdd.index, pendingQuickAdd.option);
    setPendingQuickAdd(null);
  }, [fields, onProductSelect, pendingQuickAdd]);

  const addBlankRow = () => append(buildSalesItemDefaults(headerWarehouseId || null, invoiceType));

  const handleQuickAddSelect = (option: LookupOption) => {
    const emptyIndex = fields.findIndex((_, index) => {
      const productId = form.getValues(`items.${index}.productId`);
      return !productId;
    });

    if (emptyIndex >= 0) {
      void onProductSelect(emptyIndex, option);
      return;
    }

    const nextIndex = fields.length;
    addBlankRow();
    setPendingQuickAdd({ index: nextIndex, option });
  };

  return (
    <Card>
      <CardHeader
        title={compact ? "Add Items" : "Items"}
        action={
          compact ? undefined : (
            <Button type="button" variant="secondary" onClick={addBlankRow}>
              <Plus className="mr-2 size-4" />
              Add Row
            </Button>
          )
        }
      />
      <CardContent className={compact ? "space-y-5" : "space-y-3"}>
        {compact ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="w-full md:flex-1 md:pr-4">
              <AsyncLookupSelect
                label="Product Search"
                placeholder="Scan barcode / search product"
                value={null}
                loading={productLookupLoading}
                options={productLookupOptions}
                noResultsLabel={productLookupNoResultsLabel ?? "No matching active products found"}
                onSearch={onProductSearch}
                onSelect={handleQuickAddSelect}
              />
            </div>
            <Button type="button" variant="secondary" className="shrink-0" onClick={addBlankRow}>
              <Plus className="mr-2 size-4" />
              Add Row
            </Button>
          </div>
        ) : null}

        {fields.map((field, index) => {
          const linePreview = preview.lines[index];
          const productType = form.watch(`items.${index}.productType`);
          const batchTrackingEnabled = form.watch(`items.${index}.batchTrackingEnabled`);
          const selectedBatchId = String((form.watch(`items.${index}.batchId`) as string | null | undefined) ?? "");
          const batchStatus = (form.watch(`items.${index}.batchStatus`) as string | null | undefined) ?? null;
          const batchExpiryDate = (form.watch(`items.${index}.batchExpiryDate`) as string | null | undefined) ?? null;
          const availableQuantity = (form.watch(`items.${index}.availableQuantity`) as number | undefined) ?? undefined;

          if (compact) {
            return (
              <div key={field.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,2.9fr)_88px_112px_88px_150px] xl:items-start">
                  <AsyncLookupSelect
                    label="Product"
                    value={getLookupValue(index)}
                    loading={productLookupLoading}
                    options={productLookupOptions}
                    placeholder="Scan barcode / search product"
                    error={form.formState.errors.items?.[index]?.productId?.message}
                    noResultsLabel={productLookupNoResultsLabel ?? "No matching active products found"}
                    onSearch={onProductSearch}
                    onSelect={(option) => onProductSelect(index, option)}
                    onClear={() => {
                      form.setValue(`items.${index}.productId`, "", { shouldDirty: true, shouldValidate: true });
                      form.setValue(`items.${index}.batchId`, null, { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.001"
                    label="Qty"
                    {...form.register(`items.${index}.quantity`)}
                    error={form.formState.errors.items?.[index]?.quantity?.message}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    label="Sale Rate"
                    {...form.register(`items.${index}.saleRate`)}
                    error={form.formState.errors.items?.[index]?.saleRate?.message}
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    label="Disc %"
                    {...form.register(`items.${index}.discountPercent`)}
                    error={form.formState.errors.items?.[index]?.discountPercent?.message}
                  />
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-700">Amount</span>
                    <div className="flex h-11 items-center justify-end rounded-xl border border-slate-200 bg-slate-50 px-3">
                      <AmountText value={linePreview?.lineTotal ?? "0.00"} className="text-base" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="min-w-0 grid gap-3 md:grid-cols-[88px_110px_minmax(0,1fr)_56px]">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      label="GST %"
                      {...form.register(`items.${index}.gstRate`)}
                      error={form.formState.errors.items?.[index]?.gstRate?.message}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      label="MRP"
                      {...form.register(`items.${index}.mrp`)}
                      error={form.formState.errors.items?.[index]?.mrp?.message}
                    />
                    {productType === "goods" ? (
                      <div className="min-w-0">
                        <SearchableSelect
                          label="Warehouse"
                          value={(form.watch(`items.${index}.warehouseId`) as string | null | undefined) ?? ""}
                          options={warehouses.map((warehouse) => ({
                            value: warehouse.id,
                            label: warehouse.name,
                            description: warehouse.warehouseCode ?? null,
                          }))}
                          placeholder="Select Warehouse"
                          searchPlaceholder="Search warehouse"
                          error={form.formState.errors.items?.[index]?.warehouseId?.message}
                          onChange={(value) => form.setValue(`items.${index}.warehouseId`, value || null, { shouldDirty: true, shouldValidate: true })}
                        />
                      </div>
                    ) : (
                      <div />
                    )}
                    <button
                      type="button"
                      className="md:mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl border border-rose-200 px-3 text-rose-600 transition hover:bg-rose-50"
                      onClick={() => remove(index)}
                      aria-label="Remove row"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {productType === "goods" && batchTrackingEnabled ? (
                    <div className="min-w-0 md:max-w-[280px]">
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
                    </div>
                  ) : null}

                  <div className="grid gap-3 text-sm md:grid-cols-3">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-600">
                      <span>Taxable</span>
                      <AmountText value={linePreview?.taxableAmount ?? "0.00"} />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-600">
                      <span>GST</span>
                      <AmountText value={linePreview?.gstAmount ?? "0.00"} />
                    </div>
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-600">
                      <span>Total Tax</span>
                      <AmountText
                        value={
                          Number(linePreview?.gstAmount ?? 0) + Number(linePreview?.cessAmount ?? 0)
                        }
                      />
                    </div>
                  </div>

                  {availableQuantity !== undefined ? (
                    <div className="text-xs text-slate-500">Available Stock: {String(availableQuantity)}</div>
                  ) : null}
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
          }

          return (
            <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="grid gap-3 lg:grid-cols-[2.2fr_repeat(6,minmax(0,1fr))_auto]">
                <AsyncLookupSelect
                  label="Product"
                  value={getLookupValue(index)}
                  loading={productLookupLoading}
                  options={productLookupOptions}
                  placeholder="Search product / SKU / barcode"
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
                <Input type="number" min="0" step="0.01" label="Disc Amt" {...form.register(`items.${index}.discountAmount`)} error={form.formState.errors.items?.[index]?.discountAmount?.message} />
                <Select label="Tax Type" {...form.register(`items.${index}.priceTaxType`)} error={form.formState.errors.items?.[index]?.priceTaxType?.message}>
                  {SALES_PRICE_TAX_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  className="mt-8 inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 px-3 text-rose-600 transition hover:bg-rose-50"
                  onClick={() => remove(index)}
                  aria-label="Remove row"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-6">
                {productType === "goods" ? (
                  <SearchableSelect
                    label="Warehouse"
                    value={(form.watch(`items.${index}.warehouseId`) as string | null | undefined) ?? ""}
                    options={warehouses.map((warehouse) => ({
                      value: warehouse.id,
                      label: warehouse.name,
                      description: warehouse.warehouseCode ?? null,
                    }))}
                    placeholder="Select Warehouse"
                    searchPlaceholder="Search warehouse"
                    error={form.formState.errors.items?.[index]?.warehouseId?.message}
                    onChange={(value) => form.setValue(`items.${index}.warehouseId`, value || null, { shouldDirty: true, shouldValidate: true })}
                  />
                ) : (
                  <div />
                )}
                <Input type="number" min="0" step="0.01" label="GST %" {...form.register(`items.${index}.gstRate`)} error={form.formState.errors.items?.[index]?.gstRate?.message} />
                <Input type="number" min="0" step="0.01" label="Cess %" {...form.register(`items.${index}.cessRate`)} error={form.formState.errors.items?.[index]?.cessRate?.message} />
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
                ) : (
                  <div />
                )}
                {productType === "goods" && availableQuantity !== undefined ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    <p className="font-medium text-slate-700">Available Stock</p>
                    <p className="mt-1">{String(availableQuantity)}</p>
                  </div>
                ) : (
                  <div />
                )}
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
