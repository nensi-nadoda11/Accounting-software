import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { SectionGrid } from "../../../components/ui/SectionGrid";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import type { BatchInput, ProductBatch } from "../../../types/inventory";
import { batchFormSchema, type BatchFormInputValues, type BatchFormValues } from "../inventorySchemas";
import type { InventoryProductSettings, LookupOption } from "../inventoryUtils";
import { BATCH_STATUS_OPTIONS, toInputDateValue } from "../inventoryUtils";
import { InventoryLookupField } from "./InventoryLookupField";

const buildDefaults = (batch?: ProductBatch | null): BatchFormInputValues => ({
  productId: batch?.productId ?? "",
  warehouseId: batch?.warehouseId ?? "",
  batchNumber: batch?.batchNumber ?? "",
  manufacturingDate: toInputDateValue(batch?.manufacturingDate),
  expiryDate: toInputDateValue(batch?.expiryDate),
  purchaseRate: Number(batch?.purchaseRate ?? 0),
  status: batch?.status === "blocked" ? "blocked" : batch?.status === "expired" ? "expired" : "active",
});

const toPayload = (values: BatchFormValues): BatchInput => ({
  productId: values.productId,
  warehouseId: values.warehouseId,
  batchNumber: values.batchNumber,
  manufacturingDate: values.manufacturingDate || null,
  expiryDate: values.expiryDate || null,
  purchaseRate: values.purchaseRate,
  saleRate: 0,
  status: values.status,
});

export const BatchFormDrawer = ({
  open,
  onClose,
  initialBatch,
  submitting,
  onSubmit,
  loadProductOptions,
  loadWarehouseOptions,
  resolveProductSettings,
}: {
  open: boolean;
  onClose: () => void;
  initialBatch?: ProductBatch | null;
  submitting?: boolean;
  onSubmit: (values: BatchInput, setError: UseFormSetError<BatchFormInputValues>) => Promise<void>;
  loadProductOptions: (search: string) => Promise<LookupOption[]>;
  loadWarehouseOptions: (search: string) => Promise<LookupOption[]>;
  resolveProductSettings: (productId: string) => Promise<InventoryProductSettings>;
}) => {
  const form = useForm<BatchFormInputValues, undefined, BatchFormValues>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: buildDefaults(initialBatch),
  });
  const [productOption, setProductOption] = useState<LookupOption | null>(null);
  const [warehouseOption, setWarehouseOption] = useState<LookupOption | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(buildDefaults(initialBatch));
    setProductOption(
      initialBatch
        ? {
            id: initialBatch.productId,
            label: `${initialBatch.productCode ?? ""} - ${initialBatch.productName ?? ""}`.trim(),
          }
        : null,
    );
    setWarehouseOption(
      initialBatch
        ? {
            id: initialBatch.warehouseId,
            label: `${initialBatch.warehouseCode ?? ""} - ${initialBatch.warehouseName ?? ""}`.trim(),
          }
        : null,
    );
  }, [form, initialBatch, open]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={initialBatch ? "Edit Batch" : "Add Batch"}
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

              const productSettings = await resolveProductSettings(productOption.id);
              if (productSettings.productType !== "goods" || !productSettings.stockTrackingEnabled) {
                form.setError("productId", { type: "manual", message: "Select an active stock-tracked goods product" });
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
          <CardHeader title="Batch" />
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
                step="0.01"
                label="Purchase Rate"
                {...form.register("purchaseRate")}
                error={form.formState.errors.purchaseRate?.message}
              />
              <Select label="Status" {...form.register("status")} error={form.formState.errors.status?.message}>
                {BATCH_STATUS_OPTIONS.filter((item) => item.value).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </SectionGrid>
          </CardContent>
        </Card>
      </form>
    </SideSheet>
  );
};
