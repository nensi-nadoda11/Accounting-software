import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { Account } from "../../../types/accounting";
import type { CompanyBankAccount, CompanyTaxSettings } from "../../../types/company";
import type { ExpenseCategory, RecurringExpense } from "../../../types/expense";
import {
  BANK_LINKED_PAYMENT_MODES,
  EXPENSE_GST_RATE_OPTIONS,
  EXPENSE_PAYMENT_MODE_OPTIONS,
  EXPENSE_PRICE_TAX_TYPE_OPTIONS,
  RECURRING_CREATE_STATUS_OPTIONS,
  RECURRING_FREQUENCY_OPTIONS,
} from "../expenseOptions";
import { recurringExpenseSchema, type RecurringExpenseInputValues, type RecurringExpenseValues } from "../expenseSchemas";
import { buildRecurringFormDefaults } from "../expenseUtils";

export const RecurringExpenseDrawer = ({
  open,
  recurring,
  categories,
  accounts,
  bankAccounts,
  taxSettings,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  recurring: RecurringExpense | null;
  categories: ExpenseCategory[];
  accounts: Account[];
  bankAccounts: CompanyBankAccount[];
  taxSettings: CompanyTaxSettings | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: RecurringExpenseValues) => Promise<void>;
}) => {
  const form = useForm<RecurringExpenseInputValues, undefined, RecurringExpenseValues>({
    resolver: zodResolver(recurringExpenseSchema),
    defaultValues: buildRecurringFormDefaults(recurring, taxSettings),
  });

  useEffect(() => {
    form.reset(buildRecurringFormDefaults(recurring, taxSettings));
  }, [form, open, recurring, taxSettings]);

  const paymentMode = form.watch("paymentMode");
  const requiresBankAccount = BANK_LINKED_PAYMENT_MODES.has(paymentMode ?? "cash");
  const gstApplicable = form.watch("gstApplicable");

  useEffect(() => {
    if (!gstApplicable) {
      form.setValue("gstRate", 0, { shouldDirty: true, shouldValidate: true });
    }
  }, [form, gstApplicable]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={recurring ? "Edit Recurring Expense" : "Add Recurring Expense"}
      className="max-w-4xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" loading={submitting} onClick={form.handleSubmit(onSubmit)}>
            Save Template
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input label="Template Name" {...form.register("templateName")} error={form.formState.errors.templateName?.message} />
          <Select label="Category" {...form.register("categoryId")} error={form.formState.errors.categoryId?.message}>
            <option value="">Select category</option>
            {categories.filter((item) => item.status === "active").map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <Select label="Expense Account" {...form.register("expenseAccountId")} error={form.formState.errors.expenseAccountId?.message}>
            <option value="">Use category default</option>
            {accounts.filter((item) => item.status === "active").map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountCode} • {account.accountName}
              </option>
            ))}
          </Select>
          <Input label="Payee" {...form.register("payeeName")} error={form.formState.errors.payeeName?.message} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input type="number" min="0" step="0.01" label="Amount" {...form.register("amount")} error={form.formState.errors.amount?.message} />
          <Select label="Payment Mode" {...form.register("paymentMode")} error={form.formState.errors.paymentMode?.message}>
            {EXPENSE_PAYMENT_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {requiresBankAccount ? (
            <Select label="Bank Account" {...form.register("bankAccountId")} error={form.formState.errors.bankAccountId?.message}>
              <option value="">Select bank account</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bankName} • {account.accountNumber}
                </option>
              ))}
            </Select>
          ) : (
            <div />
          )}
          <Select label="Frequency" {...form.register("frequency")} error={form.formState.errors.frequency?.message}>
            {RECURRING_FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <Textarea label="Description" rows={3} {...form.register("description")} error={form.formState.errors.description?.message} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Controller
            control={form.control}
            name="gstApplicable"
            render={({ field }) => <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="GST Applicable" />}
          />
          <Select label="GST Rate" disabled={!gstApplicable} {...form.register("gstRate")} error={form.formState.errors.gstRate?.message}>
            {EXPENSE_GST_RATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select label="Price Tax Type" {...form.register("priceTaxType")} error={form.formState.errors.priceTaxType?.message}>
            {EXPENSE_PRICE_TAX_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select label="Create As" {...form.register("createAsStatus")} error={form.formState.errors.createAsStatus?.message}>
            {RECURRING_CREATE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Input type="date" label="Start Date" {...form.register("startDate")} error={form.formState.errors.startDate?.message} />
          <Input type="date" label="End Date" {...form.register("endDate")} error={form.formState.errors.endDate?.message} />
          <Input type="date" label="Next Run Date" {...form.register("nextRunDate")} error={form.formState.errors.nextRunDate?.message} />
          <Input
            type="number"
            min="0"
            step="1"
            label="Reminder Days"
            {...form.register("reminderDaysBefore")}
            error={form.formState.errors.reminderDaysBefore?.message}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Controller
            control={form.control}
            name="autoCreateEnabled"
            render={({ field }) => <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Auto Create Enabled" />}
          />
          <Select label="Status" {...form.register("status")} error={form.formState.errors.status?.message}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      </div>
    </SideSheet>
  );
};
