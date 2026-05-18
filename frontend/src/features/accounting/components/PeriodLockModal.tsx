import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import type { CompanyFinancialYear } from "../../../types/company";
import {
  periodLockFormSchema,
  type PeriodLockFormInputValues,
  type PeriodLockFormValues,
} from "../accountingSchemas";

export const PeriodLockModal = ({
  open,
  financialYears,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  financialYears: CompanyFinancialYear[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: PeriodLockFormValues) => Promise<void> | void;
}) => {
  const form = useForm<PeriodLockFormInputValues, undefined, PeriodLockFormValues>({
    resolver: zodResolver(periodLockFormSchema),
    defaultValues: {
      financialYearId: null,
      periodStart: "",
      periodEnd: "",
      lockType: "month",
      reason: null,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      financialYearId: null,
      periodStart: "",
      periodEnd: "",
      lockType: "month",
      reason: null,
    });
  }, [form, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Period Lock"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" loading={submitting} onClick={form.handleSubmit(onSubmit)}>
            Save Lock
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Financial Year"
          value={form.watch("financialYearId") ?? ""}
          onChange={(event) => form.setValue("financialYearId", event.target.value || null, { shouldValidate: true })}
          error={form.formState.errors.financialYearId?.message}
        >
          <option value="">Current / Auto</option>
          {financialYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </Select>
        <Select label="Lock Type" {...form.register("lockType")} error={form.formState.errors.lockType?.message}>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
        </Select>
        <Input type="date" label="Period Start" {...form.register("periodStart")} error={form.formState.errors.periodStart?.message} />
        <Input type="date" label="Period End" {...form.register("periodEnd")} error={form.formState.errors.periodEnd?.message} />
        <div className="md:col-span-2">
          <Textarea label="Reason" rows={3} {...form.register("reason")} error={form.formState.errors.reason?.message ?? undefined} />
        </div>
      </div>
    </Modal>
  );
};
