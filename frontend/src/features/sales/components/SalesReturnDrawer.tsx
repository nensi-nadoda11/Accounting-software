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
import type { Warehouse } from "../../../types/inventory";
import type { SalesInvoice, SalesReturn, SalesReturnInput } from "../../../types/sales";
import { salesReturnSchema, type SalesReturnValues } from "../salesSchemas";
import { calculateReturnPreview, getRemainingReturnableQty } from "../salesUtils";
import { AsyncLookupSelect, type LookupOption } from "./AsyncLookupSelect";

export const SalesReturnDrawer = ({
  open,
  mode,
  salesReturn,
  selectedInvoice,
  invoiceOptions,
  invoiceLookupValue,
  loadingInvoice,
  warehouses,
  submitting,
  onClose,
  onInvoiceSearch,
  onInvoiceSelect,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "view";
  salesReturn: SalesReturn | null;
  selectedInvoice: SalesInvoice | null;
  invoiceOptions: LookupOption[];
  invoiceLookupValue: LookupOption | null;
  loadingInvoice?: boolean;
  warehouses: Warehouse[];
  submitting?: boolean;
  onClose: () => void;
  onInvoiceSearch: (value: string) => void;
  onInvoiceSelect: (option: LookupOption) => void;
  onSubmit: (values: SalesReturnInput) => Promise<void>;
}) => {
  const form = useForm<SalesReturnValues, undefined, SalesReturnInput>({
    resolver: zodResolver(salesReturnSchema),
    defaultValues: {
      salesInvoiceId: "",
      returnDate: new Date().toISOString().slice(0, 10),
      warehouseId: null,
      reason: "",
      notes: null,
      items: [],
    },
  });

  useEffect(() => {
    if (!open || mode !== "create") {
      return;
    }

    form.reset({
      salesInvoiceId: selectedInvoice?.id ?? "",
      returnDate: new Date().toISOString().slice(0, 10),
      warehouseId: selectedInvoice?.warehouse?.id ?? null,
      reason: "",
      notes: null,
      items:
        selectedInvoice?.items?.map((item) => ({
          salesInvoiceItemId: item.id,
          quantity: 0,
          remarks: null,
          maxReturnableQty: Number(getRemainingReturnableQty(item)),
        })) ?? [],
    });
  }, [form, mode, open, selectedInvoice]);

  const returnItems = form.watch("items");
  const preview =
    mode === "create" && selectedInvoice
      ? calculateReturnPreview(
          selectedInvoice,
          returnItems.map((item) => ({
            salesInvoiceItemId: item.salesInvoiceItemId,
            quantity: Number(item.quantity ?? 0),
          })),
        )
      : null;

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Create Sales Return" : salesReturn?.returnNumber ?? "Sales Return"}
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
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {mode === "view" ? (
        salesReturn ? (
          <div className="space-y-5">
            <Card>
              <CardContent className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Invoice No</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{salesReturn.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Customer</p>
                  <p className="mt-1 text-sm text-slate-900">{salesReturn.customerName ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Return Date</p>
                  <p className="mt-1 text-sm text-slate-900">{formatDate(salesReturn.returnDate)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Grand Total</p>
                  <div className="mt-1">
                    <AmountText value={salesReturn.grandTotal} />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Items" />
              <CardContent className="space-y-3">
                {salesReturn.items?.map((item) => (
                  <div key={item.id} className="grid gap-2 rounded-2xl border border-slate-200 px-4 py-3 md:grid-cols-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.productName}</p>
                      <p className="text-xs text-slate-500">{item.productCode}</p>
                    </div>
                    <div>
                      <AmountText value={item.returnRate} />
                    </div>
                    <div className="text-sm text-slate-900">{item.quantity}</div>
                    <div>
                      <AmountText value={item.lineTotal} />
                    </div>
                  </div>
                ))}
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
                label="Sales Invoice"
                value={invoiceLookupValue}
                loading={loadingInvoice}
                options={invoiceOptions}
                placeholder="Search posted sales invoice"
                error={form.formState.errors.salesInvoiceId?.message}
                onSearch={onInvoiceSearch}
                onSelect={(option) => {
                  form.setValue("salesInvoiceId", option.id, { shouldValidate: true, shouldDirty: true });
                  onInvoiceSelect(option);
                }}
              />
              <Input type="date" label="Return Date" {...form.register("returnDate")} error={form.formState.errors.returnDate?.message} />
              <Select label="Warehouse" {...form.register("warehouseId")} error={form.formState.errors.warehouseId?.message}>
                <option value="">Select Warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
              <Textarea label="Reason" rows={3} {...form.register("reason")} error={form.formState.errors.reason?.message} />
              <div className="md:col-span-2">
                <Textarea label="Notes" rows={3} {...form.register("notes")} error={form.formState.errors.notes?.message} />
              </div>
            </CardContent>
          </Card>

          {loadingInvoice && !selectedInvoice ? (
            <LoadingState label="Loading invoice items..." />
          ) : selectedInvoice ? (
            <>
              <Card>
                <CardHeader title="Return Items" />
                <CardContent className="space-y-3">
                  {selectedInvoice.items?.map((item, index) => (
                    <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-200 px-4 py-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.productNameSnapshot}</p>
                        <p className="text-xs text-slate-500">Remaining {String(form.getValues(`items.${index}.maxReturnableQty`) ?? 0)}</p>
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
                        <AmountText value={Number(item.taxableAmount) / Math.max(Number(item.quantity), 1)} />
                      </div>
                      <div className="self-end text-sm text-slate-600">
                        <span className="block text-xs uppercase tracking-wide text-slate-400">Line Total</span>
                        <AmountText
                          value={
                            preview
                              ? calculateReturnPreview(selectedInvoice, [
                                  { salesInvoiceItemId: item.id, quantity: Number(returnItems[index]?.quantity ?? 0) },
                                ]).grandTotal
                              : 0
                          }
                        />
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
                      <div className="mt-1">
                        <AmountText value={preview.subtotal} />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-400">GST</p>
                      <div className="mt-1">
                        <AmountText value={preview.gstTotal} />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-emerald-700">Grand Total</p>
                      <div className="mt-1">
                        <AmountText value={preview.grandTotal} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-sm text-slate-500">Select a posted sales invoice to create return.</CardContent>
            </Card>
          )}
        </div>
      )}
    </SideSheet>
  );
};
