import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { companyApi } from "../../services/companyApi";
import { useToast } from "../../providers/useToast";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { SectionGrid } from "../../components/ui/SectionGrid";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { COMPANY_INVOICE_TEMPLATE_OPTIONS, COMPANY_TAX_DISPLAY_OPTIONS } from "./companyOptions";
import { invoiceSettingsSchema } from "./companySchemas";
import { buildInvoiceNumber, getInvoiceSettingsFormDefaults } from "./companyUtils";

type InvoiceSettingsValues = z.infer<typeof invoiceSettingsSchema>;

export const InvoiceSettingsPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [savedPreview, setSavedPreview] = useState<{ sales: string; purchase: string } | null>(null);
  const form = useForm<InvoiceSettingsValues>({
    resolver: zodResolver(invoiceSettingsSchema),
    defaultValues: {
      salesInvoicePrefix: "INV",
      purchaseInvoicePrefix: "PUR",
      creditNotePrefix: "CN",
      debitNotePrefix: "DN",
      autoNumbering: true,
      nextSalesInvoiceNumber: "1",
      nextPurchaseInvoiceNumber: "1",
      numberPadding: "4",
      termsAndConditions: "",
      footerNote: "",
      showCompanyLogo: true,
      showBankDetails: true,
      showQrCode: false,
      showSignature: false,
      roundOffEnabled: true,
      decimalPrecision: "2",
      taxDisplayFormat: "both",
      invoiceTemplate: "gst_a4",
    },
  });

  useEffect(() => {
    void (async () => {
      try {
        const [settingsResponse, previewResponse] = await Promise.all([
          companyApi.getInvoiceSettings(),
          companyApi.previewInvoiceNumber(),
        ]);
        form.reset(getInvoiceSettingsFormDefaults(settingsResponse.data));
        setSavedPreview(previewResponse.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load invoice settings"));
      } finally {
        setLoading(false);
      }
    })();
  }, [form, toast]);

  const watchedValues = form.watch();
  const livePreview = useMemo(
    () => ({
      sales: buildInvoiceNumber(
        watchedValues.salesInvoicePrefix,
        Number(watchedValues.nextSalesInvoiceNumber || 1),
        Number(watchedValues.numberPadding || 4),
      ),
      purchase: buildInvoiceNumber(
        watchedValues.purchaseInvoicePrefix,
        Number(watchedValues.nextPurchaseInvoiceNumber || 1),
        Number(watchedValues.numberPadding || 4),
      ),
    }),
    [watchedValues.nextPurchaseInvoiceNumber, watchedValues.nextSalesInvoiceNumber, watchedValues.numberPadding, watchedValues.purchaseInvoicePrefix, watchedValues.salesInvoicePrefix],
  );

  if (loading) {
    return <LoadingState label="Loading invoice settings..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invoice Settings" />
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            const response = await companyApi.updateInvoiceSettings({
              salesInvoicePrefix: values.salesInvoicePrefix.trim().toUpperCase(),
              purchaseInvoicePrefix: values.purchaseInvoicePrefix.trim().toUpperCase(),
              creditNotePrefix: values.creditNotePrefix.trim().toUpperCase(),
              debitNotePrefix: values.debitNotePrefix.trim().toUpperCase(),
              autoNumbering: values.autoNumbering,
              nextSalesInvoiceNumber: Number(values.nextSalesInvoiceNumber),
              nextPurchaseInvoiceNumber: Number(values.nextPurchaseInvoiceNumber),
              numberPadding: Number(values.numberPadding),
              termsAndConditions: values.termsAndConditions.trim() || null,
              footerNote: values.footerNote.trim() || null,
              showCompanyLogo: values.showCompanyLogo,
              showBankDetails: values.showBankDetails,
              showQrCode: values.showQrCode,
              showSignature: values.showSignature,
              roundOffEnabled: values.roundOffEnabled,
              decimalPrecision: Number(values.decimalPrecision),
              taxDisplayFormat: values.taxDisplayFormat,
              invoiceTemplate: values.invoiceTemplate,
            });
            form.reset(getInvoiceSettingsFormDefaults(response.data));
            setSavedPreview({
              sales: buildInvoiceNumber(
                response.data.salesInvoicePrefix,
                response.data.nextSalesInvoiceNumber,
                response.data.numberPadding,
              ),
              purchase: buildInvoiceNumber(
                response.data.purchaseInvoicePrefix,
                response.data.nextPurchaseInvoiceNumber,
                response.data.numberPadding,
              ),
            });
            toast.success("Invoice settings saved");
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to save invoice settings"));
          }
        })}
      >
        <SectionGrid>
          <Card className="xl:col-span-2">
            <CardHeader title="Numbering" />
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input
                label="Sales Invoice Prefix"
                {...form.register("salesInvoicePrefix")}
                error={form.formState.errors.salesInvoicePrefix?.message}
              />
              <Input
                label="Purchase Invoice Prefix"
                {...form.register("purchaseInvoicePrefix")}
                error={form.formState.errors.purchaseInvoicePrefix?.message}
              />
              <Input
                label="Credit Note Prefix"
                {...form.register("creditNotePrefix")}
                error={form.formState.errors.creditNotePrefix?.message}
              />
              <Input
                label="Debit Note Prefix"
                {...form.register("debitNotePrefix")}
                error={form.formState.errors.debitNotePrefix?.message}
              />
              <Input
                label="Next Sales Invoice Number"
                type="number"
                min="1"
                {...form.register("nextSalesInvoiceNumber")}
                error={form.formState.errors.nextSalesInvoiceNumber?.message}
              />
              <Input
                label="Next Purchase Invoice Number"
                type="number"
                min="1"
                {...form.register("nextPurchaseInvoiceNumber")}
                error={form.formState.errors.nextPurchaseInvoiceNumber?.message}
              />
              <Input
                label="Padding"
                type="number"
                min="1"
                max="10"
                {...form.register("numberPadding")}
                error={form.formState.errors.numberPadding?.message}
              />
              <Controller
                control={form.control}
                name="autoNumbering"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Auto Numbering" />
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Preview" />
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sales</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{livePreview.sales}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Purchase</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{livePreview.purchase}</p>
              </div>
              {savedPreview ? (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                  Saved: {savedPreview.sales} / {savedPreview.purchase}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </SectionGrid>

        <SectionGrid>
          <Card>
            <CardHeader title="Display" />
            <CardContent className="grid gap-4">
              <Select
                label="Tax Display Format"
                {...form.register("taxDisplayFormat")}
                error={form.formState.errors.taxDisplayFormat?.message}
              >
                {COMPANY_TAX_DISPLAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select
                label="Invoice Template"
                {...form.register("invoiceTemplate")}
                error={form.formState.errors.invoiceTemplate?.message}
              >
                {COMPANY_INVOICE_TEMPLATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Decimal Precision"
                type="number"
                min="0"
                max="4"
                {...form.register("decimalPrecision")}
                error={form.formState.errors.decimalPrecision?.message}
              />
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader title="Invoice Options" />
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Controller
                control={form.control}
                name="showCompanyLogo"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Show Logo" />
                )}
              />
              <Controller
                control={form.control}
                name="showBankDetails"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Show Bank Details" />
                )}
              />
              <Controller
                control={form.control}
                name="showQrCode"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Show QR" />
                )}
              />
              <Controller
                control={form.control}
                name="showSignature"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Show Signature" />
                )}
              />
              <Controller
                control={form.control}
                name="roundOffEnabled"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Round Off" />
                )}
              />
            </CardContent>
          </Card>
        </SectionGrid>

        <Card>
          <CardHeader title="Notes" />
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Textarea
              label="Terms & Conditions"
              rows={5}
              {...form.register("termsAndConditions")}
              error={form.formState.errors.termsAndConditions?.message}
            />
            <Textarea
              label="Footer Note"
              rows={5}
              {...form.register("footerNote")}
              error={form.formState.errors.footerNote?.message}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
            <Save className="mr-2 size-4" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};

