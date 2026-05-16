import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { companyApi } from "../../services/companyApi";
import { useToast } from "../../providers/ToastProvider";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { COMPANY_GST_FREQUENCY_OPTIONS, COMPANY_GST_TYPE_OPTIONS } from "./companyOptions";
import { taxSettingsSchema } from "./companySchemas";
import { getTaxSettingsFormDefaults, nullableString } from "./companyUtils";

type TaxSettingsValues = z.infer<typeof taxSettingsSchema>;

export const TaxSettingsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const form = useForm<TaxSettingsValues>({
    resolver: zodResolver(taxSettingsSchema),
    defaultValues: {
      gstEnabled: false,
      gstType: "unregistered",
      compositionScheme: false,
      taxInclusivePricing: false,
      defaultGstRate: "",
      hsnSacEnabled: false,
      eInvoiceEnabled: false,
      eWayBillEnabled: false,
      gstFilingFrequency: "monthly",
      tanNumber: "",
    },
  });

  useEffect(() => {
    void (async () => {
      try {
        const response = await companyApi.getTaxSettings();
        form.reset(getTaxSettingsFormDefaults(response.data));
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load tax settings"));
      } finally {
        setLoading(false);
      }
    })();
  }, [form, toast]);

  const gstEnabled = form.watch("gstEnabled");
  const gstType = form.watch("gstType");

  if (loading) {
    return <LoadingState label="Loading tax settings..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tax & GST" />
      <Card>
        <CardHeader title="Tax Configuration" />
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                const response = await companyApi.updateTaxSettings({
                  gstEnabled: values.gstEnabled,
                  gstType: values.gstEnabled ? values.gstType : "unregistered",
                  compositionScheme: values.gstEnabled && values.gstType === "composition" ? values.compositionScheme : false,
                  taxInclusivePricing: values.taxInclusivePricing,
                  defaultGstRate: values.defaultGstRate ? Number(values.defaultGstRate) : null,
                  hsnSacEnabled: values.hsnSacEnabled,
                  eInvoiceEnabled: values.eInvoiceEnabled,
                  eWayBillEnabled: values.eWayBillEnabled,
                  gstFilingFrequency: values.gstFilingFrequency,
                  tanNumber: nullableString(values.tanNumber)?.toUpperCase() ?? null,
                });
                form.reset(getTaxSettingsFormDefaults(response.data));
                toast.success("Tax settings saved");
              } catch (error) {
                toast.error(getErrorMessage(error, "Failed to save tax settings"));
              }
            })}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Controller
                control={form.control}
                name="gstEnabled"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="GST Enabled" />
                )}
              />
              <Controller
                control={form.control}
                name="taxInclusivePricing"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Tax Inclusive Pricing" />
                )}
              />
              <Controller
                control={form.control}
                name="hsnSacEnabled"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="HSN / SAC Enabled" />
                )}
              />
              <Controller
                control={form.control}
                name="eInvoiceEnabled"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="E-Invoice Enabled" />
                )}
              />
              <Controller
                control={form.control}
                name="eWayBillEnabled"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="E-Way Bill Enabled" />
                )}
              />
              {gstType === "composition" ? (
                <Controller
                  control={form.control}
                  name="compositionScheme"
                  render={({ field }) => (
                    <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Composition Scheme" />
                  )}
                />
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Select
                label="GST Type"
                disabled={!gstEnabled}
                {...form.register("gstType")}
                error={form.formState.errors.gstType?.message}
              >
                {COMPANY_GST_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Default GST Rate"
                type="number"
                step="0.01"
                min="0"
                max="28"
                disabled={!gstEnabled}
                {...form.register("defaultGstRate")}
                error={form.formState.errors.defaultGstRate?.message}
              />
              <Select
                label="GST Filing Frequency"
                disabled={!gstEnabled}
                {...form.register("gstFilingFrequency")}
                error={form.formState.errors.gstFilingFrequency?.message}
              >
                {COMPANY_GST_FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                label="TAN Number"
                disabled={!gstEnabled}
                {...form.register("tanNumber")}
                error={form.formState.errors.tanNumber?.message}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
                <Save className="mr-2 size-4" />
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
