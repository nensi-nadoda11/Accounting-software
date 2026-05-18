import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, type UseFormSetError } from "react-hook-form";
import { ArrowLeft, Plus, Save } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { applyFriendlyFieldErrors } from "../../customers/customerUtils";
import { getErrorMessage } from "../../../lib/errors";
import { useAuth } from "../../../providers/AuthProvider";
import { useToast } from "../../../providers/ToastProvider";
import { productsApi } from "../../../services/productsApi";
import { suppliersApi } from "../../../services/suppliersApi";
import type { CompanyBankAccount, CompanyInvoiceSettings, CompanyProfile } from "../../../types/company";
import type { Warehouse } from "../../../types/inventory";
import type { Product } from "../../../types/product";
import type { Supplier, SupplierFormInput } from "../../../types/supplier";
import type { PurchaseFormInput, PurchaseInvoice, PurchasePaymentMode } from "../../../types/purchase";
import { SupplierFormDrawer } from "../../suppliers/components/SupplierFormDrawer";
import { createSupplierPayload } from "../../suppliers/supplierUtils";
import type { SupplierFormValues } from "../../suppliers/supplierSchemas";
import { PURCHASE_PAYMENT_MODE_OPTIONS } from "../purchaseOptions";
import { purchaseFormSchema, type PurchaseFormValues } from "../purchaseSchemas";
import {
  buildPurchaseFormDefaults,
  calculatePurchasePreview,
  createPurchasePayload,
  hydrateItemFromProduct,
  isBankPaymentMode,
  resolveInterState,
} from "../purchaseUtils";
import { AsyncLookupSelect, type LookupOption } from "./AsyncLookupSelect";
import { PurchaseItemsTable } from "./PurchaseItemsTable";
import { PurchaseTotalsPanel } from "./PurchaseTotalsPanel";

type SupplierLookupValue = LookupOption | null;

export const PurchaseForm = ({
  initialInvoice,
  warehouses,
  bankAccounts,
  companyProfile,
  invoiceSettings,
  submitting,
  onBack,
  onSubmit,
}: {
  initialInvoice?: PurchaseInvoice | null;
  warehouses: Warehouse[];
  bankAccounts: CompanyBankAccount[];
  companyProfile: CompanyProfile | null;
  invoiceSettings: CompanyInvoiceSettings | null;
  submitting?: boolean;
  onBack: () => void;
  onSubmit: (
    values: PurchaseFormInput,
    setError: UseFormSetError<PurchaseFormValues>,
    mode: "draft" | "posted",
  ) => Promise<void>;
}) => {
  const auth = useAuth();
  const toast = useToast();
  const [submitMode, setSubmitMode] = useState<"draft" | "posted">("draft");
  const [supplierLookup, setSupplierLookup] = useState<LookupOption[]>([]);
  const [productLookup, setProductLookup] = useState<LookupOption[]>([]);
  const [supplierLookupValue, setSupplierLookupValue] = useState<SupplierLookupValue>(null);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);
  const [submittingSupplier, setSubmittingSupplier] = useState(false);
  const [productLookupLoading, setProductLookupLoading] = useState(false);
  const [supplierDetail, setSupplierDetail] = useState<Supplier | null>(null);
  const [productDetails, setProductDetails] = useState<Record<string, Product>>({});
  const canCreateSupplier = auth.hasPermission("supplier.create");

  const form = useForm<PurchaseFormValues, undefined, PurchaseFormInput>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      ...buildPurchaseFormDefaults(initialInvoice, invoiceSettings),
      grandTotalPreview: Number(initialInvoice?.grandTotal ?? 0),
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const values = form.watch() as PurchaseFormValues;
  const preview = calculatePurchasePreview({
    items: values.items.map((item) => ({
      quantity: Number(item.quantity ?? 0),
      purchaseRate: Number(item.purchaseRate ?? 0),
      priceTaxType: item.priceTaxType ?? "exclusive",
      discountPercent: Number(item.discountPercent ?? 0),
      discountAmount: Number(item.discountAmount ?? 0),
      gstRate: Number(item.gstRate ?? 0),
      cessRate: Number(item.cessRate ?? 0),
      isInterState: resolveInterState(companyProfile, supplierDetail),
    })),
    invoiceDiscountTotal: Number(values.invoiceDiscountTotal ?? 0),
    additionalCharges: Number(values.additionalCharges ?? 0),
    freightCharges: Number(values.freightCharges ?? 0),
    paidAmount: Number(values.paidAmount ?? 0),
    dueDate: (values.dueDate as string | null | undefined) ?? null,
    roundOffEnabled: invoiceSettings?.roundOffEnabled ?? true,
  });

  useEffect(() => {
    form.setValue("grandTotalPreview", Number(preview.grandTotal), { shouldDirty: false, shouldValidate: true });
  }, [form, preview.grandTotal]);

  useEffect(() => {
    if (!initialInvoice) {
      setSupplierLookupValue(null);
      setSupplierDetail(null);
      form.reset({
        ...buildPurchaseFormDefaults(null, invoiceSettings),
        grandTotalPreview: 0,
      });
      return;
    }

    form.reset({
      ...buildPurchaseFormDefaults(initialInvoice, invoiceSettings),
      grandTotalPreview: Number(initialInvoice.grandTotal),
    });
    setSupplierLookupValue({
      id: initialInvoice.supplier.id,
      label: initialInvoice.supplier.name,
      description: initialInvoice.supplier.supplierCode ?? null,
      meta: initialInvoice.purchaseNumber,
    });
    void (async () => {
      try {
        const [supplierResponse, ...productResponses] = await Promise.all([
          suppliersApi.get(initialInvoice.supplier.id),
          ...(initialInvoice.items ?? []).map((item) => productsApi.get(item.productId)),
        ]);

        setSupplierDetail(supplierResponse.data.supplier);
        setProductDetails(
          productResponses.reduce<Record<string, Product>>((accumulator, response) => {
            accumulator[response.data.product.id] = response.data.product;
            return accumulator;
          }, {}),
        );
      } catch {
        // The form still works with existing invoice snapshots if these lookups fail.
      }
    })();
  }, [form, initialInvoice, invoiceSettings]);

  const loadSuppliers = async (search: string) => {
    try {
      setSupplierLoading(true);
      const response = await suppliersApi.list({
        page: 1,
        limit: 20,
        search,
        status: "active",
      });
      setSupplierLookup(
        response.data.items.map((supplier) => ({
          id: supplier.id,
          label: supplier.name,
          description: supplier.supplierCode,
          meta: supplier.mobile,
        })),
      );
    } finally {
      setSupplierLoading(false);
    }
  };

  const loadProducts = async (search: string) => {
    try {
      setProductLookupLoading(true);
      const response = await productsApi.lookup(search, 20);
      setProductLookup(
        response.data.map((product) => ({
          id: product.id,
          label: product.name,
          description: [product.productCode, product.sku, product.barcode].filter(Boolean).join(" · "),
          meta: product.unit.symbol ? `${product.purchasePrice} · ${product.unit.symbol}` : product.purchasePrice,
        })),
      );
    } finally {
      setProductLookupLoading(false);
    }
  };

  const handleSupplierSelect = async (option: LookupOption) => {
    setSupplierLookupValue(option);
    form.setValue("supplierId", option.id, { shouldDirty: true, shouldValidate: true });

    try {
      const response = await suppliersApi.get(option.id);
      setSupplierDetail(response.data.supplier);
      if (!form.getValues("termsConditions")) {
        form.setValue("termsConditions", response.data.supplier.paymentTerms ?? invoiceSettings?.termsAndConditions ?? null, {
          shouldDirty: true,
        });
      }
    } catch {
      setSupplierDetail(null);
    }
  };

  const handleProductSelect = async (index: number, option: LookupOption) => {
    try {
      const cached = productDetails[option.id];
      const product =
        cached ??
        (
          await productsApi.get(option.id)
        ).data.product;

      setProductDetails((current) => ({ ...current, [product.id]: product }));
      const nextItem = hydrateItemFromProduct(product, (form.getValues("warehouseId") as string | null | undefined) ?? null);

      form.setValue(`items.${index}.productId`, product.id, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.warehouseId`, nextItem.warehouseId, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.batchId`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.batchNumber`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.quantity`, nextItem.quantity, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.freeQuantity`, nextItem.freeQuantity, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.purchaseRate`, nextItem.purchaseRate, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.priceTaxType`, nextItem.priceTaxType, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.discountPercent`, nextItem.discountPercent, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.discountAmount`, nextItem.discountAmount, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.gstRate`, nextItem.gstRate, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.cessRate`, nextItem.cessRate, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.manufacturingDate`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.expiryDate`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.remarks`, null, { shouldDirty: true, shouldValidate: true });
      form.setValue(`items.${index}.productType`, product.productType, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.batchTrackingEnabled`, product.batchTrackingEnabled, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.expiryTrackingEnabled`, product.expiryTrackingEnabled, { shouldDirty: false, shouldValidate: true });
      form.setValue(`items.${index}.decimalAllowed`, undefined, { shouldDirty: false, shouldValidate: true });
    } catch {
      // Validation and submit feedback will still protect the flow.
    }
  };

  const currentPaymentMode = (form.watch("paymentMode") as PurchasePaymentMode | null | undefined) ?? null;
  const handleSupplierCreated = async (values: SupplierFormInput, setError: UseFormSetError<SupplierFormValues>) => {
    try {
      setSubmittingSupplier(true);
      const response = await suppliersApi.create(createSupplierPayload(values));
      const supplier = response.data.supplier;
      const lookupOption: LookupOption = {
        id: supplier.id,
        label: supplier.name,
        description: supplier.supplierCode,
        meta: supplier.mobile,
      };

      setSupplierLookup((current) => [lookupOption, ...current.filter((option) => option.id !== supplier.id)]);
      setSupplierLookupValue(lookupOption);
      setSupplierDetail(supplier);
      form.setValue("supplierId", supplier.id, { shouldDirty: true, shouldValidate: true });

      if (!form.getValues("termsConditions")) {
        form.setValue("termsConditions", supplier.paymentTerms ?? invoiceSettings?.termsAndConditions ?? null, {
          shouldDirty: true,
        });
      }

      setSupplierDrawerOpen(false);
      toast.success("Supplier created");
    } catch (error) {
      applyFriendlyFieldErrors(error, setError);
      toast.error(getErrorMessage(error, "Failed to save supplier"));
    } finally {
      setSubmittingSupplier(false);
    }
  };

  return (
    <form
      className="space-y-5"
      onSubmit={form.handleSubmit(async (output) => {
        try {
          const payload = submitMode === "draft"
            ? createPurchasePayload({ ...output, purchaseStatus: "draft" })
            : createPurchasePayload({ ...output, purchaseStatus: "posted" });
          await onSubmit(payload, form.setError, submitMode);
        } catch (error) {
          applyFriendlyFieldErrors(error, form.setError);
        }
      })}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" />
            Back to List
          </Button>
          <h1 className="text-xl font-semibold text-slate-900">{initialInvoice ? "Edit Purchase Draft" : "New Purchase"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => form.reset({
            ...buildPurchaseFormDefaults(initialInvoice, invoiceSettings),
            grandTotalPreview: Number(initialInvoice?.grandTotal ?? 0),
          })}>
            Reset
          </Button>
          <Button type="submit" variant="secondary" loading={submitting} onClick={() => setSubmitMode("draft")}>
            <Save className="mr-2 size-4" />
            Save Draft
          </Button>
          <Button type="submit" loading={submitting} onClick={() => setSubmitMode("posted")}>
            <Save className="mr-2 size-4" />
            Save & Post
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Header" />
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-2">
            <AsyncLookupSelect
              label="Supplier"
              value={supplierLookupValue}
              loading={supplierLoading}
              options={supplierLookup}
              placeholder="Search supplier"
              error={form.formState.errors.supplierId?.message}
              onSearch={loadSuppliers}
              onSelect={(option) => void handleSupplierSelect(option)}
              onClear={() => {
                setSupplierLookupValue(null);
                setSupplierDetail(null);
                form.setValue("supplierId", "", { shouldDirty: true, shouldValidate: true });
              }}
            />
            {canCreateSupplier ? (
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-0 text-emerald-700 hover:bg-transparent hover:text-emerald-800"
                  onClick={() => setSupplierDrawerOpen(true)}
                >
                  <Plus className="mr-2 size-4" />
                  Add Supplier
                </Button>
              </div>
            ) : null}
          </div>
          <Input label="Supplier Invoice No" {...form.register("supplierInvoiceNumber")} error={form.formState.errors.supplierInvoiceNumber?.message} />
          <Input type="date" label="Invoice Date" {...form.register("invoiceDate")} error={form.formState.errors.invoiceDate?.message} />
          <Input type="date" label="Due Date" {...form.register("dueDate")} error={form.formState.errors.dueDate?.message} />
          <Select label="Warehouse" {...form.register("warehouseId")} error={form.formState.errors.warehouseId?.message}>
            <option value="">Select Warehouse</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.name}
              </option>
            ))}
          </Select>
          <Textarea label="Notes" rows={3} {...form.register("notes")} error={form.formState.errors.notes?.message} />
          <Textarea label="Terms" rows={3} {...form.register("termsConditions")} error={form.formState.errors.termsConditions?.message} />
        </CardContent>
      </Card>

      <PurchaseItemsTable
        form={form}
        fields={fields}
        warehouses={warehouses}
        productLookupOptions={productLookup}
        productLookupLoading={productLookupLoading}
        productDetails={productDetails}
        preview={preview}
        append={append}
        remove={remove}
        onProductSearch={(value) => void loadProducts(value)}
        onProductSelect={(index, option) => void handleProductSelect(index, option)}
        getLookupValue={(index) => {
          const item = values.items[index];
          if (!item?.productId) {
            return null;
          }

          const product = productDetails[item.productId];
          if (!product) {
            const fallback = productLookup.find((option) => option.id === item.productId);
            return fallback ?? null;
          }

          return {
            id: product.id,
            label: product.name,
            description: [product.productCode, product.sku, product.barcode].filter(Boolean).join(" · "),
            meta: product.unit.symbol,
          };
        }}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Payment" />
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input type="number" min="0" step="0.01" label="Paid Amount" {...form.register("paidAmount")} error={form.formState.errors.paidAmount?.message} />
              <Select label="Payment Mode" {...form.register("paymentMode")} error={form.formState.errors.paymentMode?.message}>
                <option value="">Select Payment Mode</option>
                {PURCHASE_PAYMENT_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {isBankPaymentMode(currentPaymentMode) ? (
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
              <Input label="Payment Reference" {...form.register("paymentReference")} error={form.formState.errors.paymentReference?.message} />
            </CardContent>
          </Card>
        </div>

        <PurchaseTotalsPanel totals={preview} />
      </div>
      <SupplierFormDrawer
        open={supplierDrawerOpen}
        onClose={() => setSupplierDrawerOpen(false)}
        submitting={submittingSupplier}
        onSubmit={handleSupplierCreated}
      />
    </form>
  );
};
