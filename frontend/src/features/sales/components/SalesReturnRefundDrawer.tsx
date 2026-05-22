import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import type { CompanyBankAccount } from "../../../types/company";
import type { SalesReturn, SalesReturnRefundInput } from "../../../types/sales";
import { SALES_PAYMENT_MODE_OPTIONS } from "../salesOptions";
import { salesReturnRefundSchema, type SalesReturnRefundValues } from "../salesSchemas";

export const SalesReturnRefundDrawer = ({
  open,
  salesReturn,
  bankAccounts,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  salesReturn: SalesReturn | null;
  bankAccounts: CompanyBankAccount[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: SalesReturnRefundInput) => Promise<void>;
}) => {
  const form = useForm<SalesReturnRefundValues, undefined, SalesReturnRefundInput>({
    resolver: zodResolver(salesReturnRefundSchema),
    defaultValues: {
      refundDate: new Date().toISOString().slice(0, 10),
      amount: 0,
      paymentMode: "cash",
      bankAccountId: null,
      referenceNumber: null,
      notes: null,
      maxAmount: 0,
    },
  });

  const paymentMode = form.watch("paymentMode");

  useEffect(() => {
    if (!open || !salesReturn) {
      return;
    }

    form.reset({
      refundDate: new Date().toISOString().slice(0, 10),
      amount: Number(salesReturn.remainingRefundAmount),
      paymentMode: "cash",
      bankAccountId: null,
      referenceNumber: null,
      notes: null,
      maxAmount: Number(salesReturn.remainingRefundAmount),
    });
  }, [form, open, salesReturn]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={salesReturn ? `Refund Entry · ${salesReturn.returnNumber}` : "Refund Entry"}
      className="max-w-3xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" loading={submitting} onClick={form.handleSubmit(async (values) => onSubmit(values))}>
            Save Refund
          </Button>
        </>
      }
    >
      {salesReturn ? (
        <div className="space-y-5">
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Customer</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{salesReturn.customerName || "Walk-in Customer"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Return Total</p>
                <div className="mt-1"><AmountText value={salesReturn.grandTotal} /></div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Adjusted</p>
                <div className="mt-1"><AmountText value={salesReturn.adjustedAmount} tone="warning" /></div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Refund Paid</p>
                <div className="mt-1"><AmountText value={salesReturn.refundedAmount} tone="success" /></div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Pending</p>
                <div className="mt-1"><AmountText value={salesReturn.remainingRefundAmount} tone="danger" /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Add Refund Entry" />
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input type="date" label="Refund Date" {...form.register("refundDate")} error={form.formState.errors.refundDate?.message} />
              <div className="space-y-1">
                <Input
                  type="number"
                  min="0"
                  max={salesReturn.remainingRefundAmount}
                  step="0.01"
                  label="Amount"
                  {...form.register("amount")}
                  error={form.formState.errors.amount?.message}
                />
                <p className="text-xs text-slate-500">Max refundable now: {salesReturn.remainingRefundAmount}</p>
              </div>
              <Select label="Refund Mode" {...form.register("paymentMode")} error={form.formState.errors.paymentMode?.message}>
                {SALES_PAYMENT_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {["bank", "upi", "card", "cheque"].includes(paymentMode) ? (
                <Select label="Bank Account" {...form.register("bankAccountId")} error={form.formState.errors.bankAccountId?.message}>
                  <option value="">Select Bank Account</option>
                  {bankAccounts.map((bankAccount) => (
                    <option key={bankAccount.id} value={bankAccount.id}>
                      {bankAccount.bankName} · {bankAccount.accountNumber.slice(-4)}
                    </option>
                  ))}
                </Select>
              ) : (
                <div />
              )}
              <Input label="Reference No" {...form.register("referenceNumber")} error={form.formState.errors.referenceNumber?.message} />
              <Textarea label="Notes" rows={3} {...form.register("notes")} error={form.formState.errors.notes?.message} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </SideSheet>
  );
};
