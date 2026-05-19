import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import type { CompanyBankAccount } from "../../../types/company";
import type { PayPayrollItemPayload, PayPayrollRunPayload, PayrollItem, PayrollRun } from "../../../types/payroll";
import { PAYROLL_PAYMENT_MODE_OPTIONS } from "../payrollOptions";
import {
  bulkSalaryPaymentFormSchema,
  salaryPaymentFormSchema,
  type BulkSalaryPaymentFormValues,
  type SalaryPaymentFormValues,
} from "../payrollSchemas";
import { buildSalaryPaymentDefaults, getUnpaidAmount, getTodayInput } from "../payrollUtils";

type PaymentScope =
  | { type: "item"; item: PayrollItem }
  | { type: "run"; run: PayrollRun; items: PayrollItem[] }
  | null;

export const SalaryPaymentDrawer = ({
  open,
  scope,
  bankAccounts,
  submitting,
  onClose,
  onPayItem,
  onPayRun,
}: {
  open: boolean;
  scope: PaymentScope;
  bankAccounts: CompanyBankAccount[];
  submitting: boolean;
  onClose: () => void;
  onPayItem: (payload: PayPayrollItemPayload) => Promise<void> | void;
  onPayRun: (payload: PayPayrollRunPayload) => Promise<void> | void;
}) => {
  const itemForm = useForm<z.input<typeof salaryPaymentFormSchema>, undefined, SalaryPaymentFormValues>({
    resolver: zodResolver(salaryPaymentFormSchema),
    defaultValues: buildSalaryPaymentDefaults(0),
  });
  const runForm = useForm<z.input<typeof bulkSalaryPaymentFormSchema>, undefined, BulkSalaryPaymentFormValues>({
    resolver: zodResolver(bulkSalaryPaymentFormSchema),
    defaultValues: {
      paymentDate: getTodayInput(),
      paymentMode: "bank",
      bankAccountId: "",
      referenceNumber: "",
      notes: "",
      payrollItemIds: [],
    },
  });
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const unpaidRunItems = useMemo(
    () =>
      scope?.type === "run"
        ? scope.items.filter((item) => item.paymentStatus !== "paid" && item.status !== "cancelled")
        : [],
    [scope],
  );

  useEffect(() => {
    if (scope?.type === "item") {
      itemForm.reset(buildSalaryPaymentDefaults(getUnpaidAmount(scope.item)));
    } else if (scope?.type === "run") {
      const itemIds = unpaidRunItems.map((item) => item.id);
      setSelectedItemIds(itemIds);
      runForm.reset({
        paymentDate: getTodayInput(),
        paymentMode: "bank",
        bankAccountId: "",
        referenceNumber: "",
        notes: "",
        payrollItemIds: itemIds,
      });
    }
  }, [itemForm, runForm, scope, unpaidRunItems]);

  const selectedTotal = useMemo(
    () =>
      unpaidRunItems
        .filter((item) => selectedItemIds.includes(item.id))
        .reduce((sum, item) => sum + getUnpaidAmount(item), 0),
    [selectedItemIds, unpaidRunItems],
  );

  const renderBankOptions = () => (
    <>
      <option value="">Select bank account</option>
      {bankAccounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.bankName} · {account.accountNumber.slice(-4)}
        </option>
      ))}
    </>
  );

  const title =
    scope?.type === "item"
      ? `Pay Salary · ${scope.item.employeeName}`
      : scope?.type === "run"
        ? `Bulk Payment · ${scope.run.runNumber}`
        : "Pay Salary";

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {scope?.type === "item" ? (
            <Button
              loading={submitting}
              onClick={itemForm.handleSubmit(async (values) =>
                onPayItem({
                  amount: values.amount,
                  paymentDate: values.paymentDate,
                  paymentMode: values.paymentMode,
                  bankAccountId: values.bankAccountId || null,
                  referenceNumber: values.referenceNumber || null,
                  notes: values.notes || null,
                }),
              )}
            >
              Record Payment
            </Button>
          ) : scope?.type === "run" ? (
            <Button
              loading={submitting}
              onClick={runForm.handleSubmit(async (values) =>
                onPayRun({
                  paymentDate: values.paymentDate,
                  paymentMode: values.paymentMode,
                  bankAccountId: values.bankAccountId || null,
                  referenceNumber: values.referenceNumber || null,
                  notes: values.notes || null,
                  payrollItemIds: selectedItemIds,
                }),
              )}
            >
              Pay Selected
            </Button>
          ) : null}
        </>
      }
    >
      {scope?.type === "item" ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Net Salary</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{scope.item.netSalary}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Paid</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{scope.item.paidAmount}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Unpaid</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{getUnpaidAmount(scope.item).toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Input type="number" step="0.01" label="Amount" {...itemForm.register("amount")} error={itemForm.formState.errors.amount?.message} />
            <Input
              type="date"
              label="Payment Date"
              {...itemForm.register("paymentDate")}
              error={itemForm.formState.errors.paymentDate?.message}
            />
            <Select
              label="Payment Mode"
              {...itemForm.register("paymentMode")}
              error={itemForm.formState.errors.paymentMode?.message}
            >
              {PAYROLL_PAYMENT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Bank Account"
              {...itemForm.register("bankAccountId")}
              error={itemForm.formState.errors.bankAccountId?.message}
            >
              {renderBankOptions()}
            </Select>
            <Input
              label="Reference"
              {...itemForm.register("referenceNumber")}
              error={itemForm.formState.errors.referenceNumber?.message}
            />
          </div>
          <Textarea label="Notes" rows={3} {...itemForm.register("notes")} />
        </div>
      ) : scope?.type === "run" ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Employees Selected</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{selectedItemIds.length}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Selected Amount</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{selectedTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Payroll Month</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{scope.run.payrollMonth}</p>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="date"
              label="Payment Date"
              {...runForm.register("paymentDate")}
              error={runForm.formState.errors.paymentDate?.message}
            />
            <Select
              label="Payment Mode"
              {...runForm.register("paymentMode")}
              error={runForm.formState.errors.paymentMode?.message}
            >
              {PAYROLL_PAYMENT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              label="Bank Account"
              {...runForm.register("bankAccountId")}
              error={runForm.formState.errors.bankAccountId?.message}
            >
              {renderBankOptions()}
            </Select>
            <Input
              label="Reference"
              {...runForm.register("referenceNumber")}
              error={runForm.formState.errors.referenceNumber?.message}
            />
          </div>
          <Textarea label="Notes" rows={3} {...runForm.register("notes")} />
          <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
            {unpaidRunItems.map((item) => (
              <label key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...selectedItemIds, item.id]
                        : selectedItemIds.filter((entry) => entry !== item.id);
                      setSelectedItemIds(next);
                      runForm.setValue("payrollItemIds", next);
                    }}
                    className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.employeeName}</p>
                    <p className="text-xs text-slate-500">{item.employeeCode}</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-slate-900">{getUnpaidAmount(item).toFixed(2)}</p>
              </label>
            ))}
          </div>
          {runForm.formState.errors.payrollItemIds?.message ? (
            <p className="text-sm text-rose-600">{runForm.formState.errors.payrollItemIds.message}</p>
          ) : null}
        </div>
      ) : null}
    </SideSheet>
  );
};
