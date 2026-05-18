import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import type { CompanyFinancialYear } from "../../../types/company";
import { JOURNAL_VOUCHER_TYPES, type Account, type JournalEntry } from "../../../types/accounting";
import {
  journalFormSchema,
  type JournalFormInputValues,
  type JournalFormValues,
} from "../accountingSchemas";
import { journalVoucherLabels } from "../accountingUtils";
import { JournalLinesGrid } from "./JournalLinesGrid";

const defaultLines = () => [
  { accountId: "", description: null, debit: 0, credit: 0 },
  { accountId: "", description: null, debit: 0, credit: 0 },
];

export const JournalFormDrawer = ({
  open,
  mode,
  loading,
  journal,
  accounts,
  financialYears,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit" | "view";
  loading: boolean;
  journal: JournalEntry | null;
  accounts: Account[];
  financialYears: CompanyFinancialYear[];
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: JournalFormValues, intent: "draft" | "posted") => Promise<void> | void;
}) => {
  const [intent, setIntent] = useState<"draft" | "posted">("draft");
  const form = useForm<JournalFormInputValues, undefined, JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: {
      financialYearId: null,
      journalNumber: null,
      entryDate: new Date().toISOString().slice(0, 10),
      voucherType: "journal",
      referenceType: null,
      referenceId: null,
      referenceNumber: null,
      description: "",
      lines: defaultLines(),
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      financialYearId: journal?.financialYearId ?? null,
      journalNumber: journal?.journalNumber ?? null,
      entryDate: journal?.entryDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      voucherType: journal?.voucherType ?? "journal",
      referenceType: journal?.referenceType ?? null,
      referenceId: journal?.referenceId ?? null,
      referenceNumber: journal?.referenceNumber ?? null,
      description: journal?.description ?? "",
      lines:
        journal?.lines.map((line) => ({
          accountId: line.accountId,
          description: line.description,
          debit: Number(line.debit),
          credit: Number(line.credit),
        })) ?? defaultLines(),
    });
  }, [form, journal, open]);

  const readOnly = mode === "view";
  const lineValues = form.watch("lines");
  const totalDebit = lineValues.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const totalCredit = lineValues.reduce((sum, line) => sum + Number(line.credit || 0), 0);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? "New Journal Entry" : mode === "edit" ? "Edit Journal Entry" : "Journal Entry"}
      className="max-w-5xl"
      footer={
        <>
          <div className="mr-auto flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Debit</span>
              <AmountText value={totalDebit} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Credit</span>
              <AmountText value={totalCredit} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Difference</span>
              <AmountText value={Math.abs(totalDebit - totalCredit)} tone={totalDebit === totalCredit ? "success" : "danger"} />
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {!readOnly ? (
            <>
              {mode === "create" ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={submitting && intent === "draft"}
                    onClick={form.handleSubmit(async (values) => {
                      setIntent("draft");
                      await onSubmit(values, "draft");
                    })}
                  >
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    loading={submitting && intent === "posted"}
                    onClick={form.handleSubmit(async (values) => {
                      setIntent("posted");
                      await onSubmit(values, "posted");
                    })}
                  >
                    Save & Post
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  loading={submitting}
                  onClick={form.handleSubmit(async (values) => {
                    setIntent("draft");
                    await onSubmit(values, "draft");
                  })}
                >
                  Save Changes
                </Button>
              )}
            </>
          ) : null}
        </>
      }
    >
      {loading ? (
        <LoadingState label="Loading journal..." />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Select
              label="Financial Year"
              disabled={readOnly}
              value={form.watch("financialYearId") ?? ""}
              onChange={(event) => form.setValue("financialYearId", event.target.value || null, { shouldValidate: true })}
              error={form.formState.errors.financialYearId?.message}
            >
              <option value="">Auto</option>
              {financialYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
            <Input type="date" label="Date" readOnly={readOnly} {...form.register("entryDate")} error={form.formState.errors.entryDate?.message} />
            <Select
              label="Voucher Type"
              disabled={readOnly}
              {...form.register("voucherType")}
              error={form.formState.errors.voucherType?.message}
            >
              {JOURNAL_VOUCHER_TYPES.map((voucherType) => (
                <option key={voucherType} value={voucherType}>
                  {journalVoucherLabels[voucherType]}
                </option>
              ))}
            </Select>
            <Input label="Journal No" readOnly {...form.register("journalNumber")} error={form.formState.errors.journalNumber?.message ?? undefined} />
            <Input label="Reference Type" readOnly={readOnly} {...form.register("referenceType")} error={form.formState.errors.referenceType?.message ?? undefined} />
            <Input label="Reference Number" readOnly={readOnly} {...form.register("referenceNumber")} error={form.formState.errors.referenceNumber?.message ?? undefined} />
            <div className="md:col-span-2">
              <Textarea label="Description" rows={3} readOnly={readOnly} {...form.register("description")} error={form.formState.errors.description?.message} />
            </div>
          </div>

          <div className="space-y-3">
            <JournalLinesGrid
              fields={fields}
              register={form.register}
              errors={form.formState.errors}
              accounts={accounts}
              readOnly={readOnly}
              onAddLine={() => append({ accountId: "", description: null, debit: 0, credit: 0 })}
              onRemoveLine={remove}
            />
            {form.formState.errors.lines?.root?.message ? (
              <p className="text-sm text-rose-600">{form.formState.errors.lines.root.message}</p>
            ) : null}
            {typeof form.formState.errors.lines?.message === "string" ? (
              <p className="text-sm text-rose-600">{form.formState.errors.lines.message}</p>
            ) : null}
          </div>

          {!readOnly ? (
            <div className="sticky bottom-0 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="text-slate-500">Total Debit</span>
                  <AmountText value={totalDebit} />
                  <span className="text-slate-500">Total Credit</span>
                  <AmountText value={totalCredit} />
                </div>
                <div className="text-sm font-medium text-slate-700">
                  {totalDebit === totalCredit ? "Balanced entry" : "Entry is not balanced"}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </SideSheet>
  );
};
