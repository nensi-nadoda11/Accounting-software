import { Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import type { CompanyFinancialYear } from "../../../types/company";
import { financialYearSchema } from "../companySchemas";
import { toDateInputValue } from "../companyUtils";

type FinancialYearValues = z.infer<typeof financialYearSchema>;

export const FinancialYearModal = ({
  open,
  onClose,
  onSubmit,
  initialValue,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: FinancialYearValues) => Promise<void>;
  initialValue?: CompanyFinancialYear | null;
  submitting?: boolean;
}) => {
  const isEditing = Boolean(initialValue);
  const form = useForm<FinancialYearValues>({
    resolver: zodResolver(financialYearSchema),
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
      isActive: false,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      name: initialValue?.name ?? "",
      startDate: initialValue ? toDateInputValue(initialValue.startDate) : "",
      endDate: initialValue ? toDateInputValue(initialValue.endDate) : "",
      isActive: initialValue?.isActive ?? false,
    });
  }, [form, initialValue, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit Financial Year" : "Add Financial Year"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            onClick={form.handleSubmit(async (values) => {
              await onSubmit(values);
            })}
          >
            <Save className="mr-2 size-4" />
            Save
          </Button>
        </>
      }
    >
      <form className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Input label="FY Name" {...form.register("name")} error={form.formState.errors.name?.message} />
        </div>
        <Input type="date" label="Start Date" {...form.register("startDate")} error={form.formState.errors.startDate?.message} />
        <Input type="date" label="End Date" {...form.register("endDate")} error={form.formState.errors.endDate?.message} />
        {!isEditing ? (
          <div className="md:col-span-2">
            <Checkbox
              label="Set as active financial year"
              checked={form.watch("isActive")}
              onChange={(event) => form.setValue("isActive", event.target.checked)}
            />
          </div>
        ) : null}
      </form>
    </Modal>
  );
};
