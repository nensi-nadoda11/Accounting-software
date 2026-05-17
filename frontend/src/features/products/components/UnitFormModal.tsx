import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, type UseFormSetError } from "react-hook-form";
import { Save } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { ProductUnit, ProductUnitFormInput } from "../../../types/product";
import { FORM_UNIT_STATUS_OPTIONS } from "../productOptions";
import { unitFormSchema, type UnitFormValues } from "../productSchemas";

export const UnitFormModal = ({
  open,
  onClose,
  initialUnit,
  baseUnitOptions,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initialUnit?: ProductUnit | null;
  baseUnitOptions: ProductUnit[];
  submitting?: boolean;
  onSubmit: (values: ProductUnitFormInput, setError: UseFormSetError<UnitFormValues>) => Promise<void>;
}) => {
  const form = useForm<UnitFormValues, undefined, ProductUnitFormInput>({
    resolver: zodResolver(unitFormSchema),
    defaultValues: {
      name: initialUnit?.name ?? "",
      symbol: initialUnit?.symbol ?? "",
      decimalAllowed: initialUnit?.decimalAllowed ?? false,
      baseUnitId: initialUnit?.baseUnitId ?? null,
      conversionRate: initialUnit?.conversionRate ? Number(initialUnit.conversionRate) : null,
      status: initialUnit?.status === "inactive" ? "inactive" : "active",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      name: initialUnit?.name ?? "",
      symbol: initialUnit?.symbol ?? "",
      decimalAllowed: initialUnit?.decimalAllowed ?? false,
      baseUnitId: initialUnit?.baseUnitId ?? null,
      conversionRate: initialUnit?.conversionRate ? Number(initialUnit.conversionRate) : null,
      status: initialUnit?.status === "inactive" ? "inactive" : "active",
    });
  }, [form, initialUnit, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialUnit ? "Edit Unit" : "Add Unit"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            onClick={form.handleSubmit(async (values) => {
              await onSubmit(values, form.setError);
            })}
          >
            <Save className="mr-2 size-4" />
            Save
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <Input label="Name" {...form.register("name")} error={form.formState.errors.name?.message} />
        <Input label="Symbol" {...form.register("symbol")} error={form.formState.errors.symbol?.message} />
        <Controller
          control={form.control}
          name="decimalAllowed"
          render={({ field }) => (
            <ToggleSwitch checked={Boolean(field.value)} onCheckedChange={field.onChange} label="Decimal Allowed" />
          )}
        />
        <Select label="Base Unit" {...form.register("baseUnitId")} error={form.formState.errors.baseUnitId?.message}>
          <option value="">No Base Unit</option>
          {baseUnitOptions
            .filter((unit) => unit.id !== initialUnit?.id)
            .map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.symbol})
              </option>
            ))}
        </Select>
        <Input
          label="Conversion Rate"
          type="number"
          step="0.0001"
          min="0"
          {...form.register("conversionRate")}
          value={(form.watch("conversionRate") as number | null | undefined) ?? ""}
          error={form.formState.errors.conversionRate?.message}
        />
        <Select label="Status" {...form.register("status")} error={form.formState.errors.status?.message}>
          {FORM_UNIT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </form>
    </Modal>
  );
};
