import { Plus, Trash2 } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type { Account } from "../../../types/accounting";
import type { JournalFormInputValues } from "../accountingSchemas";

type JournalField = JournalFormInputValues["lines"][number] & { id?: string };

export const JournalLinesGrid = ({
  fields,
  register,
  errors,
  accounts,
  readOnly,
  onAddLine,
  onRemoveLine,
}: {
  fields: JournalField[];
  register: UseFormRegister<JournalFormInputValues>;
  errors: FieldErrors<JournalFormInputValues>;
  accounts: Account[];
  readOnly: boolean;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
}) => (
  <div className="space-y-3">
    <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(220px,1.6fr)_140px_140px_56px] gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 lg:grid">
      <span>Account</span>
      <span>Description</span>
      <span>Debit</span>
      <span>Credit</span>
      <span />
    </div>
    {fields.map((field, index) => (
      <div key={field.id ?? `${field.accountId}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 lg:grid-cols-[minmax(220px,1.4fr)_minmax(220px,1.6fr)_140px_140px_56px]">
        <Select
          label="Account"
          disabled={readOnly}
          {...register(`lines.${index}.accountId`)}
          error={errors.lines?.[index]?.accountId?.message}
        >
          <option value="">Select account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.accountCode} - {account.accountName}
            </option>
          ))}
        </Select>
        <Input
          label="Description"
          readOnly={readOnly}
          {...register(`lines.${index}.description`)}
          error={errors.lines?.[index]?.description?.message as string | undefined}
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          label="Debit"
          readOnly={readOnly}
          {...register(`lines.${index}.debit`, { valueAsNumber: true })}
          error={errors.lines?.[index]?.debit?.message}
        />
        <Input
          type="number"
          min="0"
          step="0.01"
          label="Credit"
          readOnly={readOnly}
          {...register(`lines.${index}.credit`, { valueAsNumber: true })}
          error={errors.lines?.[index]?.credit?.message}
        />
        <div className="flex items-end">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-center px-0 lg:size-11"
            disabled={readOnly || fields.length <= 2}
            onClick={() => onRemoveLine(index)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    ))}
    {!readOnly ? (
      <Button type="button" variant="secondary" onClick={onAddLine}>
        <Plus className="mr-2 size-4" />
        Add Line
      </Button>
    ) : null}
  </div>
);
