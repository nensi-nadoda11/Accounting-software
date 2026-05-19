import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import type { PayrollItem } from "../../../types/payroll";
import { BONUS_DEDUCTION_TYPE_OPTIONS } from "../payrollOptions";
import { bonusDeductionFormSchema, type BonusDeductionFormValues } from "../payrollSchemas";
import { calculateBonusDeductionTotals } from "../payrollUtils";

export const BonusDeductionDrawer = ({
  open,
  item,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  item: PayrollItem | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: BonusDeductionFormValues) => Promise<void> | void;
}) => {
  const form = useForm<z.input<typeof bonusDeductionFormSchema>, undefined, BonusDeductionFormValues>({
    resolver: zodResolver(bonusDeductionFormSchema),
    defaultValues: {
      entries:
        item?.bonusDeductions?.map((entry) => ({
          type: entry.type,
          name: entry.name,
          amount: Number(entry.amount),
          taxable: entry.taxable,
          notes: entry.notes ?? "",
        })) ?? [],
    },
  });

  const fieldArray = useFieldArray({
    control: form.control,
    name: "entries",
  });

  useEffect(() => {
    form.reset({
      entries:
        item?.bonusDeductions?.map((entry) => ({
          type: entry.type,
          name: entry.name,
          amount: Number(entry.amount),
          taxable: entry.taxable,
          notes: entry.notes ?? "",
        })) ?? [],
    });
  }, [form, item, open]);

  const watchedEntries = (form.watch("entries") ?? []).map((entry) => ({
    type: entry.type,
    name: entry.name,
    amount: Number(entry.amount ?? 0),
    taxable: entry.taxable,
    notes: entry.notes ?? null,
  }));
  const totals = item
    ? calculateBonusDeductionTotals(item, watchedEntries)
    : { bonus: 0, deductions: 0, gross: 0, net: 0 };

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={item ? `Bonus & Deductions · ${item.employeeName}` : "Bonus & Deductions"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={submitting} onClick={form.handleSubmit(async (values) => onSubmit(values))}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Adjusted Gross</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totals.gross.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Adjusted Deductions</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totals.deductions.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Adjusted Net</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{totals.net.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={() =>
              fieldArray.append({
                type: "bonus",
                name: "",
                amount: 0,
                taxable: true,
                notes: "",
              })
            }
          >
            <Plus className="mr-2 size-4" />
            Add Row
          </Button>
        </div>

        <div className="space-y-3">
          {fieldArray.fields.map((field, index) => (
            <Card key={field.id}>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Select
                    label="Type"
                    {...form.register(`entries.${index}.type`)}
                    error={form.formState.errors.entries?.[index]?.type?.message}
                  >
                    {BONUS_DEDUCTION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Name"
                    {...form.register(`entries.${index}.name`)}
                    error={form.formState.errors.entries?.[index]?.name?.message}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    label="Amount"
                    {...form.register(`entries.${index}.amount`)}
                    error={form.formState.errors.entries?.[index]?.amount?.message}
                  />
                  <Select
                    label="Taxable"
                    value={String(form.watch(`entries.${index}.taxable`) ?? true)}
                    onChange={(event) => form.setValue(`entries.${index}.taxable`, event.target.value === "true")}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </Select>
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Textarea label="Notes" rows={2} {...form.register(`entries.${index}.notes`)} />
                  </div>
                  <Button variant="secondary" onClick={() => fieldArray.remove(index)}>
                    <Trash2 className="mr-2 size-4" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </SideSheet>
  );
};
