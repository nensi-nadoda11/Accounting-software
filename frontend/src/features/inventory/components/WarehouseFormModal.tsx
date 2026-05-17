import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm, type UseFormSetError } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { SectionGrid } from "../../../components/ui/SectionGrid";
import { Select } from "../../../components/ui/Select";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { Warehouse, WarehouseInput } from "../../../types/inventory";
import { warehouseFormSchema, type WarehouseFormInputValues, type WarehouseFormValues } from "../inventorySchemas";
import { toNullableString, WAREHOUSE_STATUS_OPTIONS } from "../inventoryUtils";

const buildDefaults = (warehouse?: Warehouse | null): WarehouseFormInputValues => ({
  warehouseCode: warehouse?.warehouseCode ?? "",
  name: warehouse?.name ?? "",
  addressLine1: warehouse?.addressLine1 ?? "",
  addressLine2: warehouse?.addressLine2 ?? "",
  city: warehouse?.city ?? "",
  state: warehouse?.state ?? "",
  pincode: warehouse?.pincode ?? "",
  contactPerson: warehouse?.contactPerson ?? "",
  mobile: warehouse?.mobile ?? "",
  isDefault: warehouse?.isDefault ?? false,
  status: warehouse?.status === "inactive" ? "inactive" : "active",
});

const toPayload = (values: WarehouseFormValues): WarehouseInput => ({
  warehouseCode: values.warehouseCode || null,
  name: values.name,
  addressLine1: toNullableString(values.addressLine1 ?? ""),
  addressLine2: toNullableString(values.addressLine2 ?? ""),
  city: toNullableString(values.city ?? ""),
  state: toNullableString(values.state ?? ""),
  pincode: toNullableString(values.pincode ?? ""),
  contactPerson: toNullableString(values.contactPerson ?? ""),
  mobile: toNullableString(values.mobile ?? ""),
  isDefault: values.isDefault,
  status: values.status,
});

export const WarehouseFormModal = ({
  open,
  onClose,
  initialWarehouse,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initialWarehouse?: Warehouse | null;
  submitting?: boolean;
  onSubmit: (values: WarehouseInput, setError: UseFormSetError<WarehouseFormInputValues>) => Promise<void>;
}) => {
  const form = useForm<WarehouseFormInputValues, undefined, WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: buildDefaults(initialWarehouse),
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(buildDefaults(initialWarehouse));
  }, [form, initialWarehouse, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialWarehouse ? "Edit Warehouse" : "Add Warehouse"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            onClick={form.handleSubmit(async (values) => {
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
          <CardHeader title="Warehouse" />
          <CardContent>
            <SectionGrid>
              <Input label="Code" {...form.register("warehouseCode")} error={form.formState.errors.warehouseCode?.message} />
              <Input label="Name" {...form.register("name")} error={form.formState.errors.name?.message} />
              <Input label="City" {...form.register("city")} error={form.formState.errors.city?.message} />
              <Input label="State" {...form.register("state")} error={form.formState.errors.state?.message} />
              <Input
                label="Pincode"
                inputMode="numeric"
                {...form.register("pincode")}
                error={form.formState.errors.pincode?.message}
              />
              <Input
                label="Contact"
                {...form.register("contactPerson")}
                error={form.formState.errors.contactPerson?.message}
              />
              <Input
                label="Mobile"
                inputMode="numeric"
                {...form.register("mobile")}
                error={form.formState.errors.mobile?.message}
              />
              <Select label="Status" {...form.register("status")} error={form.formState.errors.status?.message}>
                {WAREHOUSE_STATUS_OPTIONS.filter((item) => item.value).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Address Line 1"
                {...form.register("addressLine1")}
                error={form.formState.errors.addressLine1?.message}
              />
              <Input
                label="Address Line 2"
                {...form.register("addressLine2")}
                error={form.formState.errors.addressLine2?.message}
              />
            </SectionGrid>
            <div className="mt-4">
              <Controller
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <ToggleSwitch checked={Boolean(field.value)} onCheckedChange={field.onChange} label="Default Warehouse" />
                )}
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </Modal>
  );
};
