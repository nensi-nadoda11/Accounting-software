import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { preferencesApi } from "../../services/preferencesApi";
import { useToast } from "../../providers/ToastProvider";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import {
  COMPANY_CURRENCY_FORMAT_OPTIONS,
  COMPANY_DATE_FORMAT_OPTIONS,
  COMPANY_LANGUAGE_OPTIONS,
  COMPANY_NUMBER_FORMAT_OPTIONS,
  COMPANY_TIMEZONE_OPTIONS,
} from "./companyOptions";
import { preferencesSchema } from "./companySchemas";
import { getPreferencesFormDefaults } from "./companyUtils";

type PreferencesValues = z.infer<typeof preferencesSchema>;

export const PreferencesPage = () => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const form = useForm<PreferencesValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      dateFormat: "DD/MM/YYYY",
      currencyFormat: "symbol_first",
      numberFormat: "indian",
      decimalPrecision: "2",
      timezone: "Asia/Kolkata",
      language: "en",
      autoLogoutMinutes: "30",
      notificationEmailEnabled: true,
      notificationSmsEnabled: false,
      notificationWhatsappEnabled: false,
    },
  });

  useEffect(() => {
    void (async () => {
      try {
        const response = await preferencesApi.get();
        form.reset(getPreferencesFormDefaults(response.data));
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load preferences"));
      } finally {
        setLoading(false);
      }
    })();
  }, [form, toast]);

  if (loading) {
    return <LoadingState label="Loading preferences..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Preferences" />
      <Card>
        <CardHeader title="Preferences" />
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                const response = await preferencesApi.update({
                  dateFormat: values.dateFormat,
                  currencyFormat: values.currencyFormat,
                  numberFormat: values.numberFormat,
                  decimalPrecision: Number(values.decimalPrecision),
                  timezone: values.timezone.trim(),
                  language: values.language.trim(),
                  autoLogoutMinutes: Number(values.autoLogoutMinutes),
                  notificationEmailEnabled: values.notificationEmailEnabled,
                  notificationSmsEnabled: values.notificationSmsEnabled,
                  notificationWhatsappEnabled: values.notificationWhatsappEnabled,
                });
                form.reset(getPreferencesFormDefaults(response.data));
                toast.success("Preferences saved");
              } catch (error) {
                toast.error(getErrorMessage(error, "Failed to save preferences"));
              }
            })}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Select label="Date Format" {...form.register("dateFormat")} error={form.formState.errors.dateFormat?.message}>
                {COMPANY_DATE_FORMAT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <Select
                label="Currency Format"
                {...form.register("currencyFormat")}
                error={form.formState.errors.currencyFormat?.message}
              >
                {COMPANY_CURRENCY_FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select label="Number Format" {...form.register("numberFormat")} error={form.formState.errors.numberFormat?.message}>
                {COMPANY_NUMBER_FORMAT_OPTIONS.map((option) => (
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
              <Select label="Timezone" {...form.register("timezone")} error={form.formState.errors.timezone?.message}>
                {COMPANY_TIMEZONE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <Select label="Language" {...form.register("language")} error={form.formState.errors.language?.message}>
                {COMPANY_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </Select>
              <Input
                label="Auto Logout Minutes"
                type="number"
                min="5"
                max="1440"
                {...form.register("autoLogoutMinutes")}
                error={form.formState.errors.autoLogoutMinutes?.message}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Controller
                control={form.control}
                name="notificationEmailEnabled"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Email Notifications" />
                )}
              />
              <Controller
                control={form.control}
                name="notificationSmsEnabled"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="SMS Notifications" />
                )}
              />
              <Controller
                control={form.control}
                name="notificationWhatsappEnabled"
                render={({ field }) => (
                  <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="WhatsApp Notifications" />
                )}
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
