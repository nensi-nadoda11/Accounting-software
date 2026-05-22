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
import type { PurchaseReturn, PurchaseReturnRefundInput } from "../../../types/purchase";
import { PURCHASE_PAYMENT_MODE_OPTIONS } from "../purchaseOptions";
import { purchaseReturnRefundSchema, type PurchaseReturnRefundValues } from "../purchaseSchemas";

export const PurchaseReturnRefundDrawer = ({
  open,
  purchaseReturn,
  bankAccounts,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  purchaseReturn: PurchaseReturn | null;
  bankAccounts: CompanyBankAccount[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: PurchaseReturnRefundInput) => Promise<void>;
}) => {
  const form = useForm<PurchaseReturnRefundValues, undefined, PurchaseReturnRefundInput>({
    resolver: zodResolver(purchaseReturnRefundSchema),
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
    if (!open || !purchaseReturn) {
      return;
    }

    form.reset({
      refundDate: new Date().toISOString().slice(0, 10),
      amount: Number(purchaseReturn.remainingRefundAmount),
      paymentMode: "cash",
      bankAccountId: null,
      referenceNumber: null,
      notes: null,
      maxAmount: Number(purchaseReturn.remainingRefundAmount),
    });
  }, [form, open, purchaseReturn]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={purchaseReturn ? `Refund Entry · ${purchaseReturn.returnNumber}` : "Refund Entry"}
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
      {purchaseReturn ? (
        <div className="space-y-5">
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Supplier</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{purchaseReturn.supplierName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Return Total</p>
                <div className="mt-1"><AmountText value={purchaseReturn.grandTotal} /></div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Adjusted</p>
                <div className="mt-1"><AmountText value={purchaseReturn.adjustedAmount} tone="warning" /></div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Received</p>
                <div className="mt-1"><AmountText value={purchaseReturn.refundedAmount} tone="success" /></div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Pending</p>
                <div className="mt-1"><AmountText value={purchaseReturn.remainingRefundAmount} tone="danger" /></div>
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
                  max={purchaseReturn.remainingRefundAmount}
                  step="0.01"
                  label="Amount"
                  {...form.register("amount")}
                  error={form.formState.errors.amount?.message}
                />
                <p className="text-xs text-slate-500">Max refundable now: {purchaseReturn.remainingRefundAmount}</p>
              </div>
              <Select label="Refund Mode" {...form.register("paymentMode")} error={form.formState.errors.paymentMode?.message}>
                {PURCHASE_PAYMENT_MODE_OPTIONS.map((option) => (
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
