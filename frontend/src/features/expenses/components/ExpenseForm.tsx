import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import { getErrorMessage } from "../../../lib/errors";
import { useToast } from "../../../providers/useToast";
import type { CompanyBankAccount, CompanyTaxSettings } from "../../../types/company";
import type { Account } from "../../../types/accounting";
import type { ExpenseCategory, ExpenseFormInput } from "../../../types/expense";
import {
  EXPENSE_CHEQUE_STATUS_OPTIONS,
  EXPENSE_GST_RATE_OPTIONS,
  EXPENSE_PAYMENT_MODE_OPTIONS,
  EXPENSE_PRICE_TAX_TYPE_OPTIONS,
  BANK_LINKED_PAYMENT_MODES,
} from "../expenseOptions";
import { expenseFormSchema, type ExpenseFormInputValues, type ExpenseFormValues } from "../expenseSchemas";
import { applyExpenseFieldErrors, calculateExpensePreview, resolveIntraState } from "../expenseUtils";

export const ExpenseForm = ({
  initialValues,
  categories,
  accounts,
  bankAccounts,
  taxSettings,
  companyGstNumber,
  companyState,
  attachmentsContent,
  editing,
  loadingState,
  onSubmit,
  onBackToList,
}: {
  initialValues: ExpenseFormInput;
  categories: ExpenseCategory[];
  accounts: Account[];
  bankAccounts: CompanyBankAccount[];
  taxSettings: CompanyTaxSettings | null;
  companyGstNumber: string | null | undefined;
  companyState: string | null | undefined;
  attachmentsContent?: ReactNode;
  editing: boolean;
  loadingState: "draft" | "posted" | null;
  onSubmit: (values: ExpenseFormInput, status: "draft" | "posted") => Promise<void>;
  onBackToList: () => void;
}) => {
  const toast = useToast();
  const [submitIntent, setSubmitIntent] = useState<"draft" | "posted">("draft");
  const form = useForm<ExpenseFormInputValues, undefined, ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  const paymentMode = form.watch("paymentMode");
  const gstApplicable = form.watch("gstApplicable");
  const amount = form.watch("amount");
  const gstRate = form.watch("gstRate");
  const priceTaxType = form.watch("priceTaxType");
  const vendorGstNumber = form.watch("vendorGstNumber");
  const requiresBankAccount = BANK_LINKED_PAYMENT_MODES.has(paymentMode ?? "cash");

  useEffect(() => {
    if (!gstApplicable) {
      form.setValue("gstRate", 0, { shouldDirty: true, shouldValidate: true });
    } else if (!form.getValues("gstRate") && taxSettings?.defaultGstRate) {
      form.setValue("gstRate", taxSettings.defaultGstRate as ExpenseFormInput["gstRate"]);
    }
  }, [form, gstApplicable, taxSettings?.defaultGstRate]);

  useEffect(() => {
    if (!requiresBankAccount) {
      form.setValue("bankAccountId", null, { shouldDirty: true });
      form.setValue("referenceNumber", null, { shouldDirty: true });
    }

    if (paymentMode !== "cheque") {
      form.setValue("chequeNumber", null, { shouldDirty: true });
      form.setValue("chequeDate", null, { shouldDirty: true });
      form.setValue("chequeStatus", null, { shouldDirty: true });
    }
  }, [form, paymentMode, requiresBankAccount]);

  const preview = useMemo(
    () =>
      calculateExpensePreview({
        amount: Number(amount || 0),
        gstApplicable: Boolean(gstApplicable),
        gstRate: Number(gstRate || 0),
        priceTaxType: priceTaxType ?? "exclusive",
        intraState: resolveIntraState(companyGstNumber, companyState, typeof vendorGstNumber === "string" ? vendorGstNumber : null),
      }),
    [amount, companyGstNumber, companyState, gstApplicable, gstRate, priceTaxType, vendorGstNumber],
  );

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values, submitIntent);
    } catch (error) {
      if (!applyExpenseFieldErrors(error, form.setError)) {
        toast.error(getErrorMessage(error, "Failed to save expense"));
      }
    }
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <Card>
        <CardHeader title={editing ? "Edit Expense Draft" : "New Expense"} />
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input type="date" label="Expense Date" {...form.register("expenseDate")} error={form.formState.errors.expenseDate?.message} />
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
            <Input label="Payee / Vendor" {...form.register("payeeName")} error={form.formState.errors.payeeName?.message} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Vendor GST Number" {...form.register("vendorGstNumber")} error={form.formState.errors.vendorGstNumber?.message} />
            <Input label="Vendor PAN Number" {...form.register("vendorPanNumber")} error={form.formState.errors.vendorPanNumber?.message} />
            <Input label="HSN / SAC Code" {...form.register("hsnSacCode")} error={form.formState.errors.hsnSacCode?.message} />
            <Input
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              {...form.register("amount")}
              error={form.formState.errors.amount?.message}
            />
          </div>

          <Textarea label="Description" rows={3} {...form.register("description")} error={form.formState.errors.description?.message} />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <Select
              label="Price Tax Type"
              disabled={!gstApplicable}
              {...form.register("priceTaxType")}
              error={form.formState.errors.priceTaxType?.message}
            >
              {EXPENSE_PRICE_TAX_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select label="Payment Mode" {...form.register("paymentMode")} error={form.formState.errors.paymentMode?.message}>
              {EXPENSE_PAYMENT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
            <Input label="Reference Number" {...form.register("referenceNumber")} error={form.formState.errors.referenceNumber?.message} />
            {paymentMode === "cheque" ? (
              <>
                <Input label="Cheque Number" {...form.register("chequeNumber")} error={form.formState.errors.chequeNumber?.message} />
                <Input type="date" label="Cheque Date" {...form.register("chequeDate")} error={form.formState.errors.chequeDate?.message} />
              </>
            ) : (
              <>
                <div />
                <div />
              </>
            )}
          </div>

          {paymentMode === "cheque" ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Select label="Cheque Status" {...form.register("chequeStatus")} error={form.formState.errors.chequeStatus?.message}>
                <option value="">Select cheque status</option>
                {EXPENSE_CHEQUE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <Textarea label="Notes" rows={3} {...form.register("notes")} error={form.formState.errors.notes?.message} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Calculation Preview" />
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input label="Taxable Amount" value={preview.taxableAmount} readOnly />
          <Input label="CGST" value={preview.cgstAmount} readOnly />
          <Input label="SGST" value={preview.sgstAmount} readOnly />
          <Input label="IGST" value={preview.igstAmount} readOnly />
          <Input label="GST Total" value={preview.gstAmount} readOnly />
          <Input label="Total Amount" value={preview.totalAmount} readOnly className="md:col-span-2 xl:col-span-2" />
        </CardContent>
      </Card>

      {attachmentsContent ? (
        <Card>
          <CardHeader title="Receipts" />
          <CardContent>{attachmentsContent}</CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onBackToList}>
          <ArrowLeft className="mr-2 size-4" />
          Back to List
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => form.reset(initialValues)}
        >
          <RotateCcw className="mr-2 size-4" />
          Reset
        </Button>
        <Button
          type="submit"
          variant="secondary"
          loading={loadingState === "draft"}
          onClick={() => setSubmitIntent("draft")}
        >
          <Save className="mr-2 size-4" />
          Save Draft
        </Button>
        <Button
          type="submit"
          loading={loadingState === "posted"}
          onClick={() => setSubmitIntent("posted")}
        >
          <Save className="mr-2 size-4" />
          Save & Post
        </Button>
      </div>
    </form>
  );
};
