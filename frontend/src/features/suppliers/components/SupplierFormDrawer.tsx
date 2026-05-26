import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { Controller, useForm, type UseFormSetError } from "react-hook-form";
import { Save } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Input } from "../../../components/ui/Input";
import { SectionGrid } from "../../../components/ui/SectionGrid";
import { Select } from "../../../components/ui/Select";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { Supplier, SupplierFormInput } from "../../../types/supplier";
import {
  FORM_SUPPLIER_TAX_TYPE_OPTIONS,
  FORM_SUPPLIER_TYPE_OPTIONS,
  SUPPLIER_MUTABLE_STATUS_OPTIONS,
} from "../supplierOptions";
import { supplierFormSchema, type SupplierFormValues } from "../supplierSchemas";
import { buildSupplierFormDefaults, toInputString } from "../supplierUtils";

export const SupplierFormDrawer = ({
  open,
  onClose,
  initialSupplier,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initialSupplier?: Supplier | null;
  submitting?: boolean;
  onSubmit: (values: SupplierFormInput, setError: UseFormSetError<SupplierFormValues>) => Promise<void>;
}) => {
  const form = useForm<SupplierFormValues, undefined, SupplierFormInput>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: buildSupplierFormDefaults(initialSupplier),
  });

  const sameAsBilling = Boolean(form.watch("sameAsBilling"));
  const isBlacklisted = Boolean(form.watch("isBlacklisted"));
  const billingAddressLine1 = form.watch("billingAddressLine1");
  const billingAddressLine2 = form.watch("billingAddressLine2");
  const billingCity = form.watch("billingCity");
  const billingState = form.watch("billingState");
  const billingPincode = form.watch("billingPincode");
  const billingCountry = form.watch("billingCountry");
  const watchInputValue = (name: keyof SupplierFormValues) =>
    toInputString(form.watch(name) as string | number | null | undefined);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(buildSupplierFormDefaults(initialSupplier));
  }, [form, initialSupplier, open]);

  useEffect(() => {
    if (!sameAsBilling) {
      return;
    }

    form.setValue("shippingAddressLine1", billingAddressLine1 ?? "", { shouldDirty: true });
    form.setValue("shippingAddressLine2", billingAddressLine2 ?? "", { shouldDirty: true });
    form.setValue("shippingCity", billingCity ?? "", { shouldDirty: true });
    form.setValue("shippingState", billingState ?? "", { shouldDirty: true });
    form.setValue("shippingPincode", billingPincode ?? "", { shouldDirty: true });
    form.setValue("shippingCountry", billingCountry ?? "India", { shouldDirty: true });
  }, [
    billingAddressLine1,
    billingAddressLine2,
    billingCity,
    billingCountry,
    billingPincode,
    billingState,
    form,
    sameAsBilling,
  ]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={initialSupplier ? "Edit Supplier" : "Add Supplier"}
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
              await onSubmit(values, form.setError);
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
          <CardContent className="space-y-4">
            <SectionGrid>
              <Input label="Name" required {...form.register("name")} error={form.formState.errors.name?.message} />
              <Select
                label="Supplier Type"
                required
                {...form.register("supplierType")}
                error={form.formState.errors.supplierType?.message}
              >
                {FORM_SUPPLIER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Business Name"
                {...form.register("businessName")}
                value={watchInputValue("businessName")}
                error={form.formState.errors.businessName?.message}
              />
              <Input
                label="Contact Person"
                {...form.register("contactPerson")}
                value={watchInputValue("contactPerson")}
                error={form.formState.errors.contactPerson?.message}
              />
              <Input label="Mobile" required inputMode="numeric" {...form.register("mobile")} error={form.formState.errors.mobile?.message} />
              <Input
                label="Alternate Mobile"
                inputMode="numeric"
                {...form.register("alternateMobile")}
                value={watchInputValue("alternateMobile")}
                error={form.formState.errors.alternateMobile?.message}
              />
              <Input
                label="Email"
                type="email"
                {...form.register("email")}
                value={watchInputValue("email")}
                error={form.formState.errors.email?.message}
              />
              <Input
                label="Website"
                {...form.register("website")}
                value={watchInputValue("website")}
                error={form.formState.errors.website?.message}
              />
            </SectionGrid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="GST & Tax" />
          <CardContent className="space-y-4">
            <SectionGrid>
              <Input
                label="GST Number"
                {...form.register("gstNumber")}
                value={watchInputValue("gstNumber")}
                error={form.formState.errors.gstNumber?.message}
              />
              <Input
                label="PAN Number"
                {...form.register("panNumber")}
                value={watchInputValue("panNumber")}
                error={form.formState.errors.panNumber?.message}
              />
              <Input
                label="TAN Number"
                {...form.register("tanNumber")}
                value={watchInputValue("tanNumber")}
                error={form.formState.errors.tanNumber?.message}
              />
              <Select label="Tax Type" required {...form.register("taxType")} error={form.formState.errors.taxType?.message}>
                {FORM_SUPPLIER_TAX_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                label="GST State"
                {...form.register("gstState")}
                value={watchInputValue("gstState")}
                error={form.formState.errors.gstState?.message}
              />
            </SectionGrid>
            <div className="grid gap-3 md:grid-cols-2">
              <Controller
                control={form.control}
                name="reverseChargeApplicable"
                render={({ field }) => (
                  <ToggleSwitch
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                    label="Reverse Charge"
                  />
                )}
              />
              <Controller
                control={form.control}
                name="msmeRegistered"
                render={({ field }) => (
                  <ToggleSwitch
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                    label="MSME Registered"
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Billing Address" />
            <CardContent>
              <SectionGrid className="xl:grid-cols-2">
                <Input
                  label="Address Line 1"
                  {...form.register("billingAddressLine1")}
                  value={watchInputValue("billingAddressLine1")}
                  error={form.formState.errors.billingAddressLine1?.message}
                />
                <Input
                  label="Address Line 2"
                  {...form.register("billingAddressLine2")}
                  value={watchInputValue("billingAddressLine2")}
                  error={form.formState.errors.billingAddressLine2?.message}
                />
                <Input
                  label="City"
                  {...form.register("billingCity")}
                  value={watchInputValue("billingCity")}
                  error={form.formState.errors.billingCity?.message}
                />
                <Input
                  label="State"
                  {...form.register("billingState")}
                  value={watchInputValue("billingState")}
                  error={form.formState.errors.billingState?.message}
                />
                <Input
                  label="Pincode"
                  inputMode="numeric"
                  {...form.register("billingPincode")}
                  value={watchInputValue("billingPincode")}
                  error={form.formState.errors.billingPincode?.message}
                />
                <Input
                  label="Country"
                  {...form.register("billingCountry")}
                  value={watchInputValue("billingCountry")}
                  error={form.formState.errors.billingCountry?.message}
                />
              </SectionGrid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Shipping Address" />
            <CardContent className="space-y-4">
              <Controller
                control={form.control}
                name="sameAsBilling"
                render={({ field }) => (
                  <Checkbox
                    label="Same as billing"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                  />
                )}
              />
              <SectionGrid className="xl:grid-cols-2">
                <Input
                  disabled={sameAsBilling}
                  label="Address Line 1"
                  {...form.register("shippingAddressLine1")}
                  value={watchInputValue("shippingAddressLine1")}
                  error={form.formState.errors.shippingAddressLine1?.message}
                />
                <Input
                  disabled={sameAsBilling}
                  label="Address Line 2"
                  {...form.register("shippingAddressLine2")}
                  value={watchInputValue("shippingAddressLine2")}
                  error={form.formState.errors.shippingAddressLine2?.message}
                />
                <Input
                  disabled={sameAsBilling}
                  label="City"
                  {...form.register("shippingCity")}
                  value={watchInputValue("shippingCity")}
                  error={form.formState.errors.shippingCity?.message}
                />
                <Input
                  disabled={sameAsBilling}
                  label="State"
                  {...form.register("shippingState")}
                  value={watchInputValue("shippingState")}
                  error={form.formState.errors.shippingState?.message}
                />
                <Input
                  disabled={sameAsBilling}
                  label="Pincode"
                  inputMode="numeric"
                  {...form.register("shippingPincode")}
                  value={watchInputValue("shippingPincode")}
                  error={form.formState.errors.shippingPincode?.message}
                />
                <Input
                  disabled={sameAsBilling}
                  label="Country"
                  {...form.register("shippingCountry")}
                  value={watchInputValue("shippingCountry")}
                  error={form.formState.errors.shippingCountry?.message}
                />
              </SectionGrid>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader title="Credit & Bank" />
          <CardContent>
            <SectionGrid>
              <Input
                label="Credit Limit"
                type="number"
                min="0"
                step="0.01"
                {...form.register("creditLimit")}
                error={form.formState.errors.creditLimit?.message}
              />
              <Input
                label="Credit Days"
                type="number"
                min="0"
                max="365"
                {...form.register("creditDays")}
                error={form.formState.errors.creditDays?.message}
              />
              <Input
                label="Payment Terms"
                {...form.register("paymentTerms")}
                value={watchInputValue("paymentTerms")}
                error={form.formState.errors.paymentTerms?.message}
              />
              <Input
                label="Default GST Rate"
                type="number"
                min="0"
                max="28"
                step="0.01"
                {...form.register("defaultGstRate")}
                error={form.formState.errors.defaultGstRate?.message}
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
              <Input
                label="Bank Name"
                {...form.register("bankName")}
                value={watchInputValue("bankName")}
                error={form.formState.errors.bankName?.message}
              />
              <Input
                label="Account Holder"
                {...form.register("accountHolderName")}
                value={watchInputValue("accountHolderName")}
                error={form.formState.errors.accountHolderName?.message}
              />
              <Input
                label="Account Number"
                {...form.register("accountNumber")}
                value={watchInputValue("accountNumber")}
                error={form.formState.errors.accountNumber?.message}
              />
              <Input
                label="IFSC Code"
                {...form.register("ifscCode")}
                value={watchInputValue("ifscCode")}
                error={form.formState.errors.ifscCode?.message}
              />
              <Input
                label="Branch"
                {...form.register("bankBranch")}
                value={watchInputValue("bankBranch")}
                error={form.formState.errors.bankBranch?.message}
              />
              <Input
                label="UPI ID"
                {...form.register("upiId")}
                value={watchInputValue("upiId")}
                error={form.formState.errors.upiId?.message}
              />
            </SectionGrid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Other" />
          <CardContent className="space-y-4">
            <SectionGrid className="xl:grid-cols-2">
              <Select label="Status" {...form.register("status")} error={form.formState.errors.status?.message}>
                {SUPPLIER_MUTABLE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="grid gap-3">
                <Controller
                  control={form.control}
                  name="isPreferred"
                  render={({ field }) => (
                    <ToggleSwitch
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                      label="Preferred Supplier"
                    />
                  )}
                />
                <Controller
                  control={form.control}
                  name="isBlacklisted"
                  render={({ field }) => (
                    <ToggleSwitch
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                      label="Blacklisted"
                    />
                  )}
                />
              </div>
            </SectionGrid>
            {isBlacklisted ? (
              <Textarea
                label="Blacklist Reason"
                rows={3}
                {...form.register("blacklistReason")}
                value={watchInputValue("blacklistReason")}
                error={form.formState.errors.blacklistReason?.message}
              />
            ) : null}
            <Textarea
              label="Notes"
              rows={4}
              {...form.register("notes")}
              value={watchInputValue("notes")}
              error={form.formState.errors.notes?.message}
            />
          </CardContent>
        </Card>
      </form>
    </SideSheet>
  );
};
