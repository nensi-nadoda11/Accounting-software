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
import { formatDate, formatDateTime } from "../../customers/customerUtils";
import type { CompanyBankAccount } from "../../../types/company";
import type { SalesInvoice, SalesPaymentInput, SalesPaymentsResponse } from "../../../types/sales";
import { SALES_PAYMENT_MODE_LABELS, SALES_PAYMENT_MODE_OPTIONS } from "../salesOptions";
import { salesPaymentSchema, type SalesPaymentValues } from "../salesSchemas";

export const SalesPaymentDrawer = ({
  open,
  invoice,
  payments,
  loading,
  submitting,
  bankAccounts,
  canManage,
  onClose,
  onSubmit,
}: {
  open: boolean;
  invoice: SalesInvoice | null;
  payments: SalesPaymentsResponse | null;
  loading?: boolean;
  submitting?: boolean;
  bankAccounts: CompanyBankAccount[];
  canManage: boolean;
  onClose: () => void;
  onSubmit: (values: SalesPaymentInput) => Promise<void>;
}) => {
  const form = useForm<SalesPaymentValues, undefined, SalesPaymentInput>({
    resolver: zodResolver(salesPaymentSchema),
    defaultValues: {
      paymentDate: new Date().toISOString().slice(0, 10),
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
    if (!open || !invoice) {
      return;
    }

    form.reset({
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: Number(invoice.dueAmount),
      paymentMode: "cash",
      bankAccountId: null,
      referenceNumber: null,
      notes: null,
      maxAmount: Number(invoice.dueAmount),
    });
  }, [form, invoice, open]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={invoice ? `Payments · ${invoice.invoiceNumber}` : "Payments"}
      className="max-w-3xl"
      footer={
        canManage && invoice ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button type="button" loading={submitting} onClick={form.handleSubmit(async (values) => onSubmit(values))}>
              Add Payment
            </Button>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {invoice ? (
        <div className="space-y-5">
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Customer</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {invoice.customer?.name ?? invoice.walkInName ?? "Walk-in Customer"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Grand Total</p>
                <div className="mt-1">
                  <AmountText value={invoice.grandTotal} />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Due</p>
                <div className="mt-1">
                  <AmountText value={invoice.dueAmount} tone="danger" />
                </div>
              </div>
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader title="Add Payment" />
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Input type="date" label="Payment Date" {...form.register("paymentDate")} error={form.formState.errors.paymentDate?.message} />
                <Input type="number" min="0" step="0.01" label="Amount" {...form.register("amount")} error={form.formState.errors.amount?.message} />
                <Select label="Payment Mode" {...form.register("paymentMode")} error={form.formState.errors.paymentMode?.message}>
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
          ) : null}

          <Card>
            <CardHeader title="Payment History" />
            <CardContent className="space-y-3">
              {loading && !payments ? (
                <div className="text-sm text-slate-500">Loading payments...</div>
              ) : payments?.items.length ? (
                payments.items.map((payment) => (
                  <div key={payment.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{formatDate(payment.paymentDate)}</p>
                        <p className="text-xs text-slate-500">{SALES_PAYMENT_MODE_LABELS[payment.paymentMode]}</p>
                      </div>
                      <AmountText value={payment.amount} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      <span>Ref: {payment.referenceNumber || "-"}</span>
                      <span>Added: {formatDateTime(payment.createdAt)}</span>
                    </div>
                    {payment.notes ? <p className="mt-2 text-sm text-slate-600">{payment.notes}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No payments recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </SideSheet>
  );
};
