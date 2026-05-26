import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { Controller, useForm, type UseFormSetError } from "react-hook-form";
import { Save, ScanLine } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { FormField } from "../../../components/ui/FormField";
import { Input } from "../../../components/ui/Input";
import { SectionGrid } from "../../../components/ui/SectionGrid";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import { cn } from "../../../lib/utils";
import type { Product, ProductCategory, ProductFormInput, ProductPricePreview, ProductUnit } from "../../../types/product";
import {
  FORM_PRODUCT_TYPE_OPTIONS,
  FORM_TAX_TYPE_OPTIONS,
  GST_RATE_OPTIONS,
  PRICE_TAX_TYPE_OPTIONS,
  PRODUCT_MUTABLE_STATUS_OPTIONS,
} from "../productOptions";
import { productFormSchema, type ProductFormValues } from "../productSchemas";
import {
  buildProductFormDefaults,
  buildSkuSuggestion,
  calculatePricePreview,
  createProductPayload,
  getOpeningStockValue,
  toInputString,
} from "../productUtils";
import { PricePreviewCard } from "./PricePreviewCard";
import { TaxPreviewCard } from "./TaxPreviewCard";

export const ProductFormDrawer = ({
  open,
  onClose,
  initialProduct,
  categories,
  units,
  submitting,
  barcodeLoading,
  onGenerateBarcode,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initialProduct?: Product | null;
  categories: ProductCategory[];
  units: ProductUnit[];
  submitting?: boolean;
  barcodeLoading?: boolean;
  onGenerateBarcode?: () => Promise<void>;
  onSubmit: (values: ProductFormInput, setError: UseFormSetError<ProductFormValues>) => Promise<void>;
}) => {
  const form = useForm<ProductFormValues, undefined, ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: buildProductFormDefaults(initialProduct),
  });

  const productType = form.watch("productType") as ProductFormInput["productType"];
  const taxType = form.watch("taxType") as ProductFormInput["taxType"];
  const name = (form.watch("name") as string | undefined) ?? "";
  const brand = (form.watch("brand") as string | null | undefined) ?? null;
  const sku = (form.watch("sku") as string | null | undefined) ?? null;
  const salePrice = Number(form.watch("salePrice") ?? 0);
  const purchasePrice = Number(form.watch("purchasePrice") ?? 0);
  const gstRate = Number(form.watch("gstRate") ?? 0);
  const cessRate = Number(form.watch("cessRate") ?? 0);
  const priceTaxType = form.watch("priceTaxType");
  const openingStockQuantity = Number(form.watch("openingStockQuantity") ?? 0);
  const openingStockRate = Number(form.watch("openingStockRate") ?? 0);
  const expiryTrackingEnabled = Boolean(form.watch("expiryTrackingEnabled"));
  const watchInputValue = (field: keyof ProductFormValues) =>
    toInputString(form.watch(field) as string | number | null | undefined);

  const pricePreview = useMemo<ProductPricePreview>(
    () =>
      calculatePricePreview({
        salePrice,
        purchasePrice,
        gstRate,
        cessRate,
        taxType,
        priceTaxType,
      }),
    [cessRate, gstRate, priceTaxType, purchasePrice, salePrice, taxType],
  );

  const openingStockValue = useMemo(
    () => getOpeningStockValue(openingStockQuantity, openingStockRate),
    [openingStockQuantity, openingStockRate],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(buildProductFormDefaults(initialProduct));
  }, [form, initialProduct, open]);

  useEffect(() => {
    if (sku || !name.trim()) {
      return;
    }

    form.setValue("sku", buildSkuSuggestion(name, productType, brand), { shouldDirty: false });
  }, [brand, form, name, productType, sku]);

  useEffect(() => {
    if (taxType === "taxable") {
      return;
    }

    form.setValue("gstRate", 0, { shouldValidate: true });
    form.setValue("cessRate", 0, { shouldValidate: true });
  }, [form, taxType]);

  useEffect(() => {
    if (!expiryTrackingEnabled) {
      return;
    }

    form.setValue("batchTrackingEnabled", true, { shouldDirty: true, shouldValidate: true });
  }, [expiryTrackingEnabled, form]);

  useEffect(() => {
    if (productType !== "service") {
      return;
    }

    form.setValue("stockTrackingEnabled", false, { shouldValidate: true });
    form.setValue("openingStockQuantity", 0, { shouldValidate: true });
    form.setValue("openingStockRate", 0, { shouldValidate: true });
    form.setValue("minimumStockLevel", 0, { shouldValidate: true });
    form.setValue("reorderLevel", 0, { shouldValidate: true });
    form.setValue("maximumStockLevel", 0, { shouldValidate: true });
    form.setValue("batchTrackingEnabled", false, { shouldValidate: true });
    form.setValue("expiryTrackingEnabled", false, { shouldValidate: true });
    form.setValue("serialTrackingEnabled", false, { shouldValidate: true });
    form.setValue("negativeStockAllowed", false, { shouldValidate: true });
  }, [form, productType]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={initialProduct ? "Edit Product" : "Add Product"}
      className="max-w-6xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            onClick={form.handleSubmit(async (values) => {
              await onSubmit(createProductPayload(values), form.setError);
            })}
          >
            <Save className="mr-2 size-4" />
            Save
          </Button>
        </>
      }
    >
      <form className="space-y-5">
        <Card>
          <CardHeader title="Basic" />
          <CardContent>
            <SectionGrid>
              <Select label="Product Type" required {...form.register("productType")} error={form.formState.errors.productType?.message}>
                {FORM_PRODUCT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input label="Product Name" required {...form.register("name")} error={form.formState.errors.name?.message} />
              <Input
                label="SKU"
                {...form.register("sku")}
                value={watchInputValue("sku")}
                error={form.formState.errors.sku?.message}
              />
              <FormField label="Barcode" error={form.formState.errors.barcode?.message}>
                <div className="flex gap-2">
                  <input
                    {...form.register("barcode")}
                    value={watchInputValue("barcode")}
                    className={cn(
                      "h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10",
                      form.formState.errors.barcode && "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10",
                    )}
                  />
                  {onGenerateBarcode && initialProduct ? (
                    <Button type="button" variant="secondary" loading={barcodeLoading} onClick={() => void onGenerateBarcode()}>
                      <ScanLine className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </FormField>
              <Select label="Category" required {...form.register("categoryId")} error={form.formState.errors.categoryId?.message}>
                <option value="">Select Category</option>
                {categories
                  .filter((item) => item.status !== "deleted")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </Select>
              <Select label="Unit" required {...form.register("unitId")} error={form.formState.errors.unitId?.message}>
                <option value="">Select Unit</option>
                {units
                  .filter((item) => item.status !== "deleted")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.symbol})
                    </option>
                  ))}
              </Select>
              <Input
                label="Brand"
                {...form.register("brand")}
                value={watchInputValue("brand")}
                error={form.formState.errors.brand?.message}
              />
              <Textarea
                label="Description"
                rows={3}
                {...form.register("description")}
                value={watchInputValue("description")}
                error={form.formState.errors.description?.message}
              />
            </SectionGrid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Tax" />
          <CardContent>
            <SectionGrid>
              <Input
                label="HSN/SAC"
                {...form.register("hsnSacCode")}
                value={watchInputValue("hsnSacCode")}
                error={form.formState.errors.hsnSacCode?.message}
              />
              <Select label="Tax Type" required {...form.register("taxType")} error={form.formState.errors.taxType?.message}>
                {FORM_TAX_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select label="GST %" {...form.register("gstRate")} error={form.formState.errors.gstRate?.message} disabled={taxType !== "taxable"}>
                {GST_RATE_OPTIONS.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}%
                  </option>
                ))}
              </Select>
              <Input
                label="Cess %"
                type="number"
                min="0"
                step="0.01"
                disabled={taxType !== "taxable"}
                {...form.register("cessRate")}
                error={form.formState.errors.cessRate?.message}
              />
              <Select
                label="Price Tax Type"
                required
                {...form.register("priceTaxType")}
                error={form.formState.errors.priceTaxType?.message}
              >
                {PRICE_TAX_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </SectionGrid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Pricing" />
          <CardContent className="space-y-4">
            <SectionGrid>
              <Input
                label="Purchase Price"
                required
                type="number"
                min="0"
                step="0.01"
                {...form.register("purchasePrice")}
                error={form.formState.errors.purchasePrice?.message}
              />
              <Input
                label="Sale Price"
                required
                type="number"
                min="0"
                step="0.01"
                {...form.register("salePrice")}
                error={form.formState.errors.salePrice?.message}
              />
              <Input
                label="MRP"
                type="number"
                min="0"
                step="0.01"
                {...form.register("mrp")}
                error={form.formState.errors.mrp?.message}
              />
              <Input
                label="Wholesale Price"
                type="number"
                min="0"
                step="0.01"
                {...form.register("wholesalePrice")}
                error={form.formState.errors.wholesalePrice?.message}
              />
              <Input
                label="Minimum Sale Price"
                type="number"
                min="0"
                step="0.01"
                {...form.register("minimumSalePrice")}
                error={form.formState.errors.minimumSalePrice?.message}
              />
              <Input
                label="Default Discount %"
                type="number"
                min="0"
                max="100"
                step="0.01"
                {...form.register("defaultDiscount")}
                error={form.formState.errors.defaultDiscount?.message}
              />
            </SectionGrid>
            <div className="grid gap-4 xl:grid-cols-2">
              <TaxPreviewCard preview={pricePreview} />
              <PricePreviewCard preview={pricePreview} openingStockValue={openingStockValue} />
            </div>
          </CardContent>
        </Card>

        {productType === "goods" ? (
          <Card>
            <CardHeader title="Inventory" />
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Controller
                  control={form.control}
                  name="stockTrackingEnabled"
                  render={({ field }) => (
                    <ToggleSwitch checked={Boolean(field.value)} onCheckedChange={field.onChange} label="Stock Tracking" />
                  )}
                />
                <Controller
                  control={form.control}
                  name="negativeStockAllowed"
                  render={({ field }) => (
                    <ToggleSwitch checked={Boolean(field.value)} onCheckedChange={field.onChange} label="Negative Stock" />
                  )}
                />
              </div>
              <SectionGrid>
                <Input
                  label="Opening Stock Qty"
                  type="number"
                  min="0"
                  step="0.001"
                  {...form.register("openingStockQuantity")}
                  error={form.formState.errors.openingStockQuantity?.message}
                />
                <Input
                  label="Opening Stock Rate"
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("openingStockRate")}
                  error={form.formState.errors.openingStockRate?.message}
                />
                <FormField label="Opening Stock Value">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900">
                    {openingStockValue}
                  </div>
                </FormField>
                <Input
                  label="Minimum Stock"
                  type="number"
                  min="0"
                  step="0.001"
                  {...form.register("minimumStockLevel")}
                  error={form.formState.errors.minimumStockLevel?.message}
                />
                <Input
                  label="Reorder Level"
                  type="number"
                  min="0"
                  step="0.001"
                  {...form.register("reorderLevel")}
                  error={form.formState.errors.reorderLevel?.message}
                />
                <Input
                  label="Maximum Stock"
                  type="number"
                  min="0"
                  step="0.001"
                  {...form.register("maximumStockLevel")}
                  error={form.formState.errors.maximumStockLevel?.message}
                />
              </SectionGrid>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Controller
                  control={form.control}
                  name="batchTrackingEnabled"
                  render={({ field }) => (
                    <ToggleSwitch checked={Boolean(field.value)} onCheckedChange={field.onChange} label="Batch Tracking" />
                  )}
                />
                <Controller
                  control={form.control}
                  name="expiryTrackingEnabled"
                  render={({ field }) => (
                    <ToggleSwitch checked={Boolean(field.value)} onCheckedChange={field.onChange} label="Expiry Tracking" />
                  )}
                />
                <Controller
                  control={form.control}
                  name="serialTrackingEnabled"
                  render={({ field }) => (
                    <ToggleSwitch checked={Boolean(field.value)} onCheckedChange={field.onChange} label="Serial Tracking" />
                  )}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Other" />
          <CardContent>
            <SectionGrid className="xl:grid-cols-2">
              <Select label="Status" {...form.register("status")} error={form.formState.errors.status?.message}>
                {PRODUCT_MUTABLE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </SectionGrid>
          </CardContent>
        </Card>
      </form>
    </SideSheet>
  );
};
