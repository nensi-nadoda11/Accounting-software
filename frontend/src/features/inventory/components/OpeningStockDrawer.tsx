import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { SectionGrid } from "../../../components/ui/SectionGrid";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import type { OpeningStockInput, ProductBatch } from "../../../types/inventory";
import { openingStockFormSchema, type OpeningStockFormInputValues, type OpeningStockFormValues } from "../inventorySchemas";
import {
  ensureIntegerQuantity,
  quantityStepFor,
  quantityValueFrom,
  toInputDateValue,
  type InventoryProductSettings,
  type LookupOption,
} from "../inventoryUtils";
import { InventoryLookupField } from "./InventoryLookupField";

const buildDefaults = (seed?: {
  productId?: string;
  warehouseId?: string;
  batchId?: string | null;
  batchNumber?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  quantity?: string | number;
  rate?: string | number;
}): OpeningStockFormInputValues => ({
  productId: seed?.productId ?? "",
  warehouseId: seed?.warehouseId ?? "",
  batchId: seed?.batchId ?? "",
  batchNumber: seed?.batchNumber ?? "",
  manufacturingDate: toInputDateValue(seed?.manufacturingDate),
  expiryDate: toInputDateValue(seed?.expiryDate),
  quantity: Number(seed?.quantity ?? 0) || 0,
  rate: Number(seed?.rate ?? 0) || 0,
  movementDate: "",
  remarks: "",
});

const toPayload = (values: OpeningStockFormValues): OpeningStockInput => ({
  productId: values.productId,
  warehouseId: values.warehouseId,
  batchId: values.batchId || null,
  batchNumber: values.batchNumber || null,
  manufacturingDate: values.manufacturingDate || null,
  expiryDate: values.expiryDate || null,
  quantity: values.quantity,
  rate: values.rate,
  purchaseRate: values.rate,
  saleRate: 0,
  movementDate: values.movementDate || undefined,
  remarks: values.remarks,
});

export const OpeningStockDrawer = ({
  open,
  onClose,
  initialValues,
  submitting,
  onSubmit,
  loadProductOptions,
  loadWarehouseOptions,
  loadBatchOptions,
  resolveProductSettings,
}: {
  open: boolean;
  onClose: () => void;
  initialValues?: {
    productId?: string;
    productLabel?: string;
    warehouseId?: string;
    warehouseLabel?: string;
    batchId?: string | null;
    batchNumber?: string | null;
    manufacturingDate?: string | null;
    expiryDate?: string | null;
    quantity?: string | number;
    rate?: string | number;
  } | null;
  submitting?: boolean;
  onSubmit: (values: OpeningStockInput, setError: UseFormSetError<OpeningStockFormInputValues>) => Promise<void>;
  loadProductOptions: (search: string) => Promise<LookupOption[]>;
  loadWarehouseOptions: (search: string) => Promise<LookupOption[]>;
  loadBatchOptions: (productId: string, warehouseId: string) => Promise<ProductBatch[]>;
  resolveProductSettings: (productId: string) => Promise<InventoryProductSettings>;
}) => {
  const form = useForm<OpeningStockFormInputValues, undefined, OpeningStockFormValues>({
    resolver: zodResolver(openingStockFormSchema),
    defaultValues: buildDefaults(initialValues ?? undefined),
  });
  const [productOption, setProductOption] = useState<LookupOption | null>(null);
  const [warehouseOption, setWarehouseOption] = useState<LookupOption | null>(null);
  const [productSettings, setProductSettings] = useState<InventoryProductSettings | null>(null);
  const [batchOptions, setBatchOptions] = useState<ProductBatch[]>([]);
  const selectedBatchId = form.watch("batchId") ?? "";
  const quantity = Number(form.watch("quantity") ?? 0);
  const rate = Number(form.watch("rate") ?? 0);
  const computedValue = useMemo(() => quantityValueFrom(quantity, rate), [quantity, rate]);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(buildDefaults(initialValues ?? undefined));
    setProductOption(
      initialValues?.productId && initialValues.productLabel
        ? { id: initialValues.productId, label: initialValues.productLabel }
        : null,
    );
    setWarehouseOption(
      initialValues?.warehouseId && initialValues.warehouseLabel
        ? { id: initialValues.warehouseId, label: initialValues.warehouseLabel }
        : null,
    );
  }, [form, initialValues, open]);

  useEffect(() => {
    if (!productOption?.id) {
      setProductSettings(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const settings = await resolveProductSettings(productOption.id);
        if (!cancelled) {
          setProductSettings(settings);
          if (!form.getValues("rate")) {
            form.setValue("rate", Number(settings.purchasePrice), { shouldDirty: false });
          }
        }
      } catch {
        if (!cancelled) {
          setProductSettings(null);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [form, productOption?.id, resolveProductSettings]);

  useEffect(() => {
    if (!productOption?.id || !warehouseOption?.id) {
      setBatchOptions([]);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const items = await loadBatchOptions(productOption.id, warehouseOption.id);
        if (!cancelled) {
          setBatchOptions(items);
        }
      } catch {
        if (!cancelled) {
          setBatchOptions([]);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [loadBatchOptions, productOption?.id, warehouseOption?.id]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title="Opening Stock"
      className="max-w-4xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            onClick={form.handleSubmit(async (values) => {
              if (!productOption) {
                form.setError("productId", { type: "manual", message: "Product is required" });
                return;
              }

              if (!warehouseOption) {
                form.setError("warehouseId", { type: "manual", message: "Warehouse is required" });
                return;
              }

              const settings = productSettings ?? (await resolveProductSettings(productOption.id));
              if (settings.productType !== "goods" || !settings.stockTrackingEnabled) {
                form.setError("productId", { type: "manual", message: "Select an active stock-tracked goods product" });
                return;
              }

              if (settings.batchTrackingEnabled && !values.batchId && !values.batchNumber.trim()) {
                form.setError("batchNumber", { type: "manual", message: "Batch number is required" });
                return;
              }

              if (settings.expiryTrackingEnabled && !values.expiryDate) {
                form.setError("expiryDate", { type: "manual", message: "Expiry date is required" });
                return;
              }

              if (!settings.unit.decimalAllowed && !ensureIntegerQuantity(values.quantity)) {
                form.setError("quantity", { type: "manual", message: "Quantity must be a whole number" });
                return;
              }

              form.setValue("productId", productOption.id, { shouldValidate: true });
              form.setValue("warehouseId", warehouseOption.id, { shouldValidate: true });
              await onSubmit(toPayload(values), form.setError);
            })}
          >
            <Save className="mr-2 size-4" />
            Save
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <Card>
          <CardHeader title="Opening Stock Entry" />
          <CardContent>
            <SectionGrid>
              <InventoryLookupField
                label="Product"
                value={productOption}
                onChange={(option) => {
                  setProductOption(option);
                  form.setValue("productId", option?.id ?? "", { shouldValidate: true });
                }}
                loadOptions={loadProductOptions}
                error={form.formState.errors.productId?.message}
                placeholder="Search product"
              />
              <InventoryLookupField
                label="Warehouse"
                value={warehouseOption}
                onChange={(option) => {
                  setWarehouseOption(option);
                  form.setValue("warehouseId", option?.id ?? "", { shouldValidate: true });
                }}
                loadOptions={loadWarehouseOptions}
                error={form.formState.errors.warehouseId?.message}
                placeholder="Search warehouse"
              />
              <Select
                label="Existing Batch"
                value={selectedBatchId}
                onChange={(event) => {
                  const batchId = event.target.value;
                  form.setValue("batchId", batchId, { shouldValidate: true });
                  const batch = batchOptions.find((item) => item.id === batchId);
                  if (batch) {
                    form.setValue("batchNumber", batch.batchNumber, { shouldDirty: true });
                    form.setValue("manufacturingDate", toInputDateValue(batch.manufacturingDate), { shouldDirty: true });
                    form.setValue("expiryDate", toInputDateValue(batch.expiryDate), { shouldDirty: true });
                  }
                }}
              >
                <option value="">Create / use manual batch</option>
                {batchOptions.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchNumber}
                  </option>
                ))}
              </Select>
              <Input label="Batch No" {...form.register("batchNumber")} error={form.formState.errors.batchNumber?.message} />
              <Input
                type="date"
                label="MFG Date"
                {...form.register("manufacturingDate")}
                error={form.formState.errors.manufacturingDate?.message}
              />
              <Input
                type="date"
                label="Expiry Date"
                {...form.register("expiryDate")}
                error={form.formState.errors.expiryDate?.message}
              />
              <Input
                type="number"
                min="0"
                step={quantityStepFor(productSettings?.unit.decimalAllowed ?? true)}
                label="Quantity"
                {...form.register("quantity")}
                error={form.formState.errors.quantity?.message}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                label="Rate"
                {...form.register("rate")}
                error={form.formState.errors.rate?.message}
              />
              <FormField label="Value">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900">
                  {computedValue}
                </div>
              </FormField>
              <Input
                type="date"
                label="Date"
                {...form.register("movementDate")}
                error={form.formState.errors.movementDate?.message}
              />
            </SectionGrid>
            <div className="mt-4">
              <Textarea label="Remarks" rows={3} {...form.register("remarks")} error={form.formState.errors.remarks?.message} />
            </div>
          </CardContent>
        </Card>
      </form>
    </SideSheet>
  );
};
