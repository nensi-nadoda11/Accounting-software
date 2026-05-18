import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import type { CompanyFinancialYear } from "../../../types/company";
import type { Account, OpeningBalance } from "../../../types/accounting";
import {
  openingBalanceFormSchema,
  type OpeningBalanceFormInputValues,
  type OpeningBalanceFormValues,
} from "../accountingSchemas";

export const OpeningBalanceDrawer = ({
  open,
  mode,
  item,
  accounts,
  financialYears,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  item: OpeningBalance | null;
  accounts: Account[];
  financialYears: CompanyFinancialYear[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: OpeningBalanceFormValues) => Promise<void> | void;
}) => {
  const form = useForm<OpeningBalanceFormInputValues, undefined, OpeningBalanceFormValues>({
    resolver: zodResolver(openingBalanceFormSchema),
    defaultValues: {
      accountId: "",
      financialYearId: null,
      openingDate: new Date().toISOString().slice(0, 10),
      debit: 0,
      credit: 0,
      description: null,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      accountId: item?.accountId ?? "",
      financialYearId: item?.financialYearId ?? null,
      openingDate: item?.openingDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      debit: Number(item?.debit ?? 0),
      credit: Number(item?.credit ?? 0),
      description: null,
    });
  }, [form, item, open]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add Opening Balance" : "Edit Opening Balance"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" loading={submitting} onClick={form.handleSubmit(onSubmit)}>
            {mode === "create" ? "Save Opening Balance" : "Update Opening Balance"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Account"
          disabled={mode === "edit"}
          value={form.watch("accountId")}
          onChange={(event) => form.setValue("accountId", event.target.value, { shouldValidate: true })}
          error={form.formState.errors.accountId?.message}
        >
          <option value="">Select account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.accountCode} - {account.accountName}
            </option>
          ))}
        </Select>
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
        <Input
          type="date"
          label="Opening Date"
          {...form.register("openingDate")}
          error={form.formState.errors.openingDate?.message}
        />
        <div />
        <Input type="number" min="0" step="0.01" label="Debit" {...form.register("debit", { valueAsNumber: true })} error={form.formState.errors.debit?.message} />
        <Input type="number" min="0" step="0.01" label="Credit" {...form.register("credit", { valueAsNumber: true })} error={form.formState.errors.credit?.message} />
        <div className="md:col-span-2">
          <Textarea label="Description" rows={3} {...form.register("description")} error={form.formState.errors.description?.message ?? undefined} />
        </div>
      </div>
    </SideSheet>
  );
};
