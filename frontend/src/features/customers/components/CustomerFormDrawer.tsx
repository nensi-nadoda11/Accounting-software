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
import { Textarea } from "../../../components/ui/Textarea";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { Customer, CustomerFormInput } from "../../../types/customer";
import { CUSTOMER_MUTABLE_STATUS_OPTIONS, FORM_CUSTOMER_TYPE_OPTIONS, FORM_TAX_TYPE_OPTIONS } from "../customerOptions";
import { customerFormSchema, type CustomerFormValues } from "../customerSchemas";
import { buildCustomerFormDefaults, toInputString } from "../customerUtils";
import { CustomerSideSheet } from "./CustomerSideSheet";

export const CustomerFormDrawer = ({
  open,
  onClose,
  initialCustomer,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initialCustomer?: Customer | null;
  submitting?: boolean;
  onSubmit: (values: CustomerFormInput, setError: UseFormSetError<CustomerFormValues>) => Promise<void>;
}) => {
  const form = useForm<CustomerFormValues, undefined, CustomerFormInput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: buildCustomerFormDefaults(initialCustomer),
  });

  const customerType = form.watch("customerType");
  const sameAsBilling = Boolean(form.watch("sameAsBilling"));
  const isBlacklisted = Boolean(form.watch("isBlacklisted"));
  const billingAddressLine1 = form.watch("billingAddressLine1");
  const billingAddressLine2 = form.watch("billingAddressLine2");
  const billingCity = form.watch("billingCity");
  const billingState = form.watch("billingState");
  const billingPincode = form.watch("billingPincode");
  const billingCountry = form.watch("billingCountry");
  const watchInputValue = (name: keyof CustomerFormValues) =>
    toInputString(form.watch(name) as string | number | null | undefined);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset(buildCustomerFormDefaults(initialCustomer));
  }, [form, initialCustomer, open]);

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
    <CustomerSideSheet
      open={open}
      onClose={onClose}
      title={initialCustomer ? "Edit Customer" : "Add Customer"}
      className="max-w-5xl"
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
                label="Customer Type"
                required
                {...form.register("customerType")}
                error={form.formState.errors.customerType?.message}
              >
                {FORM_CUSTOMER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {customerType === "business" ? (
                <Input
                  label="Business Name"
                  {...form.register("businessName")}
                  value={watchInputValue("businessName")}
                  error={form.formState.errors.businessName?.message}
                />
              ) : null}
              {customerType === "business" ? (
                <Input
                  label="Contact Person"
                  {...form.register("contactPerson")}
                  value={watchInputValue("contactPerson")}
                  error={form.formState.errors.contactPerson?.message}
                />
              ) : null}
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
              <Select label="Tax Type" required {...form.register("taxType")} error={form.formState.errors.taxType?.message}>
                {FORM_TAX_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </SectionGrid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Billing Address" />
          <CardContent className="space-y-4">
            <SectionGrid>
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
              <Input label="Country" {...form.register("billingCountry")} error={form.formState.errors.billingCountry?.message} />
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
            <SectionGrid>
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
                error={form.formState.errors.shippingCountry?.message}
              />
            </SectionGrid>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Other" />
          <CardContent className="space-y-4">
            <SectionGrid className="xl:grid-cols-2">
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
                label="Default Discount %"
                type="number"
                min="0"
                max="100"
                step="0.01"
                {...form.register("defaultDiscount")}
                error={form.formState.errors.defaultDiscount?.message}
              />
              <Select label="Status" {...form.register("status")} error={form.formState.errors.status?.message}>
                {CUSTOMER_MUTABLE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="flex flex-col gap-3">
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
    </CustomerSideSheet>
  );
};
