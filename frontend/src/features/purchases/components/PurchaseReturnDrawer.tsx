import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { LoadingState } from "../../../components/ui/LoadingState";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import { formatDate } from "../../customers/customerUtils";
import type { CompanyBankAccount } from "../../../types/company";
import type { Warehouse } from "../../../types/inventory";
import type { PurchaseInvoice, PurchaseReturn, PurchaseReturnInput } from "../../../types/purchase";
import { PURCHASE_PAYMENT_MODE_OPTIONS } from "../purchaseOptions";
import { purchaseReturnSchema, type PurchaseReturnValues } from "../purchaseSchemas";
import {
  calculateAvailablePurchaseReturnRefund,
  calculatePurchaseReturnAdjustment,
  calculateReturnPreview,
  getRemainingReturnableQty,
  isBankPaymentMode,
} from "../purchaseUtils";
import { AsyncLookupSelect, type LookupOption } from "./AsyncLookupSelect";
import { WarehouseLookupSelect } from "./WarehouseLookupSelect";

export const PurchaseReturnDrawer = ({
  open,
  mode,
  purchaseReturn,
  selectedInvoice,
  invoiceOptions,
  invoiceLookupValue,
  loadingInvoice,
  warehouses,
  bankAccounts,
  submitting,
  onClose,
  onInvoiceSearch,
  onInvoiceSelect,
  onSubmit,
  onPdf,
}: {
  open: boolean;
  mode: "create" | "view";
  purchaseReturn: PurchaseReturn | null;
  selectedInvoice: PurchaseInvoice | null;
  invoiceOptions: LookupOption[];
  invoiceLookupValue: LookupOption | null;
  loadingInvoice?: boolean;
  warehouses: Warehouse[];
  bankAccounts: CompanyBankAccount[];
  submitting?: boolean;
  onClose: () => void;
  onInvoiceSearch: (value: string) => void;
  onInvoiceSelect: (option: LookupOption) => void;
  onSubmit: (values: PurchaseReturnInput) => Promise<void>;
  onPdf?: (purchaseReturn: PurchaseReturn) => void;
}) => {
  const form = useForm<PurchaseReturnValues, undefined, PurchaseReturnInput>({
    resolver: zodResolver(purchaseReturnSchema),
    defaultValues: {
      purchaseInvoiceId: "",
      returnDate: new Date().toISOString().slice(0, 10),
      warehouseId: null,
      refundAmountReceived: 0,
      refundPaymentMode: null,
      refundBankAccountId: null,
      refundReferenceNumber: null,
      refundNotes: null,
      notes: "",
      items: [],
    },
  });

  useEffect(() => {
    if (!open || mode !== "create") {
      return;
    }

    form.reset({
      purchaseInvoiceId: selectedInvoice?.id ?? "",
      returnDate: new Date().toISOString().slice(0, 10),
      warehouseId: selectedInvoice?.warehouse?.id ?? null,
      refundAmountReceived: 0,
      refundPaymentMode: null,
      refundBankAccountId: null,
      refundReferenceNumber: null,
      refundNotes: null,
      notes: "",
      items:
        selectedInvoice?.items?.map((item) => ({
          purchaseInvoiceItemId: item.id,
          quantity: 0,
          remarks: null,
          maxReturnableQty: Number(getRemainingReturnableQty(item, selectedInvoice.returns)),
        })) ?? [],
    });
  }, [form, mode, open, selectedInvoice]);

  const returnItems = form.watch("items");
  const refundPaymentMode = form.watch("refundPaymentMode") as PurchaseInvoice["paymentMode"];
  const preview =
    mode === "create" && selectedInvoice
      ? calculateReturnPreview(
          selectedInvoice,
          returnItems.map((item) => ({
            purchaseInvoiceItemId: item.purchaseInvoiceItemId,
            quantity: Number(item.quantity ?? 0),
          })),
        )
      : null;
  const maxRefundAmount = selectedInvoice && preview
    ? calculateAvailablePurchaseReturnRefund(selectedInvoice, preview.grandTotal)
    : "0.00";
  const adjustedAmount = selectedInvoice && preview
    ? calculatePurchaseReturnAdjustment(selectedInvoice, preview.grandTotal)
    : "0.00";

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create Purchase Return" : purchaseReturn?.returnNumber ?? "Purchase Return"}
      className="max-w-4xl"
      footer={
        mode === "create" ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button type="button" loading={submitting} onClick={form.handleSubmit(async (values) => onSubmit(values))}>
              Save Return
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            {purchaseReturn && onPdf ? (
              <Button type="button" variant="secondary" onClick={() => onPdf(purchaseReturn)}>
                PDF
              </Button>
            ) : null}
          </>
        )
      }
    >
      {mode === "view" ? (
        purchaseReturn ? (
          <div className="space-y-5">
            <Card>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Purchase No</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{purchaseReturn.purchaseNumber}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Supplier</p>
                  <p className="mt-1 text-sm text-slate-900">{purchaseReturn.supplierName}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Return Date</p>
                  <p className="mt-1 text-sm text-slate-900">{formatDate(purchaseReturn.returnDate)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Grand Total</p>
                  <div className="mt-1"><AmountText value={purchaseReturn.grandTotal} /></div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Adjusted In Pending Payment</p>
                  <div className="mt-1"><AmountText value={purchaseReturn.adjustedAmount} tone="warning" /></div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Refund Received</p>
                  <div className="mt-1"><AmountText value={purchaseReturn.refundedAmount} tone="success" /></div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Refund Pending</p>
                  <div className="mt-1"><AmountText value={purchaseReturn.remainingRefundAmount} tone="danger" /></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Items" />
              <CardContent className="space-y-3">
                {purchaseReturn.items?.map((item) => (
                  <div key={item.id} className="grid gap-2 rounded-2xl border border-slate-200 px-4 py-3 md:grid-cols-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.productName}</p>
                      <p className="text-xs text-slate-500">{item.productCode}</p>
                    </div>
                    <div><AmountText value={item.returnRate} /></div>
                    <div className="text-sm text-slate-900">{item.quantity}</div>
                    <div><AmountText value={item.lineTotal} /></div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Refund Entries" />
              <CardContent className="space-y-3">
                {purchaseReturn.refunds?.length ? purchaseReturn.refunds.map((refund) => (
                  <div key={refund.id} className="rounded-2xl border border-slate-200 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{formatDate(refund.refundDate)}</p>
                        <p className="text-xs text-slate-500">{refund.paymentMode.toUpperCase()} · Ref {refund.referenceNumber || "-"}</p>
                      </div>
                      <AmountText value={refund.amount} tone="success" />
                    </div>
                    {refund.notes ? <p className="mt-2 text-sm text-slate-600">{refund.notes}</p> : null}
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No refund entries recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <LoadingState label="Loading return..." />
        )
      ) : (
        <div className="space-y-5">
          <Card>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <AsyncLookupSelect
                label="Purchase Invoice"
                value={invoiceLookupValue}
                loading={loadingInvoice}
                options={invoiceOptions}
                placeholder="Search posted purchase"
                error={form.formState.errors.purchaseInvoiceId?.message}
                onSearch={onInvoiceSearch}
                onSelect={(option) => {
                  form.setValue("purchaseInvoiceId", option.id, { shouldValidate: true, shouldDirty: true });
                  onInvoiceSelect(option);
                }}
              />
              <Input type="date" label="Return Date" {...form.register("returnDate")} error={form.formState.errors.returnDate?.message} />
              <WarehouseLookupSelect
                value={(form.watch("warehouseId") as string | null | undefined) ?? ""}
                warehouses={warehouses}
                error={form.formState.errors.warehouseId?.message}
                onChange={(value) => form.setValue("warehouseId", value, { shouldDirty: true, shouldValidate: true })}
              />
              <Textarea label="Reason / Notes" rows={3} {...form.register("notes")} error={form.formState.errors.notes?.message} />
            </CardContent>
          </Card>

          {loadingInvoice && !selectedInvoice ? (
            <LoadingState label="Loading purchase items..." />
          ) : selectedInvoice ? (
            <>
              <Card>
                <CardHeader title="Return Items" />
                <CardContent className="space-y-3">
                  {selectedInvoice.items?.map((item, index) => (
                    <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-200 px-4 py-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.productNameSnapshot}</p>
                        <p className="text-xs text-slate-500">
                          Remaining {String(form.getValues(`items.${index}.maxReturnableQty`) ?? 0)}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        label="Return Qty"
                        {...form.register(`items.${index}.quantity`)}
                        error={form.formState.errors.items?.[index]?.quantity?.message}
                      />
                      <div className="self-end text-sm text-slate-600">
                        <span className="block text-xs uppercase tracking-wide text-slate-400">Rate</span>
                        <AmountText value={Number(item.taxableAmount) / Math.max(Number(item.quantity) + Number(item.freeQuantity), 1)} />
                      </div>
                      <div className="self-end text-sm text-slate-600">
                        <span className="block text-xs uppercase tracking-wide text-slate-400">Line Total</span>
                        <AmountText value={preview ? calculateReturnPreview(selectedInvoice, [{ purchaseInvoiceItemId: item.id, quantity: Number(returnItems[index]?.quantity ?? 0) }]).grandTotal : 0} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {preview ? (
                <Card>
                  <CardHeader title="Return Totals" />
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Subtotal</p>
                      <div className="mt-1"><AmountText value={preview.subtotal} /></div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">GST</p>
                      <div className="mt-1"><AmountText value={preview.gstTotal} /></div>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-emerald-600">Grand Total</p>
                      <div className="mt-1"><AmountText value={preview.grandTotal} /></div>
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-amber-700">Will Adjust In Pending Payment</p>
                      <div className="mt-1"><AmountText value={adjustedAmount} tone="warning" /></div>
                    </div>
                    <div className="rounded-2xl bg-sky-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-sky-700">Refund Payable After Adjustment</p>
                      <div className="mt-1"><AmountText value={maxRefundAmount} tone="success" /></div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader title="Refund Received From Supplier" />
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Input
                      type="number"
                      min="0"
                      max={maxRefundAmount}
                      step="0.01"
                      label="Amount Received"
                      {...form.register("refundAmountReceived")}
                      error={form.formState.errors.refundAmountReceived?.message}
                    />
                    <p className="text-xs text-slate-500">
                      {Number(maxRefundAmount) > 0
                        ? `Max refundable now: ${maxRefundAmount}`
                        : `No cash refund is due right now. Full return will adjust in pending purchase payment: ${adjustedAmount}`}
                    </p>
                  </div>
                  <Select label="Refund Mode" {...form.register("refundPaymentMode")} error={form.formState.errors.refundPaymentMode?.message}>
                    <option value="">Select Refund Mode</option>
                    {PURCHASE_PAYMENT_MODE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  {isBankPaymentMode(refundPaymentMode) ? (
                    <Select label="Bank Account" {...form.register("refundBankAccountId")} error={form.formState.errors.refundBankAccountId?.message}>
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
                  <Input label="Reference No" {...form.register("refundReferenceNumber")} error={form.formState.errors.refundReferenceNumber?.message} />
                  <Textarea label="Refund Notes" rows={3} {...form.register("refundNotes")} error={form.formState.errors.refundNotes?.message} />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-sm text-slate-500">Select a posted purchase invoice to create return.</CardContent>
            </Card>
          )}
        </div>
      )}
    </SideSheet>
  );
};
