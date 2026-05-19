import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Select } from "../../../components/ui/Select";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { TaxSettings } from "../../../types/settings";
import { taxSettingsSchema } from "../settingsFinalSchemas";

type TaxSettingsValues = z.infer<typeof taxSettingsSchema>;

export const TaxSettingsForm = ({
  value,
  loading,
  onSubmit,
}: {
  value: TaxSettings;
  loading?: boolean;
  onSubmit: (value: TaxSettingsValues) => Promise<void>;
}) => {
  const form = useForm<TaxSettingsValues>({
    resolver: zodResolver(taxSettingsSchema),
    values: value,
  });

  return (
    <Card>
      <CardHeader title="Tax Settings" />
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleSwitch label="GST Enabled" checked={form.watch("gstEnabled")} onCheckedChange={(checked) => form.setValue("gstEnabled", checked)} />
          <ToggleSwitch label="Tax Inclusive Default" checked={form.watch("taxInclusiveDefault")} onCheckedChange={(checked) => form.setValue("taxInclusiveDefault", checked)} />
          <ToggleSwitch label="Round Off Enabled" checked={form.watch("roundOffEnabled")} onCheckedChange={(checked) => form.setValue("roundOffEnabled", checked)} />
          <ToggleSwitch label="HSN / SAC Required" checked={form.watch("hsnSacRequired")} onCheckedChange={(checked) => form.setValue("hsnSacRequired", checked)} />
          <ToggleSwitch label="Composition Scheme" checked={form.watch("compositionScheme")} onCheckedChange={(checked) => form.setValue("compositionScheme", checked)} />
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Save applies GST, filing, pricing, and round-off defaults for upcoming flows.
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Default GST Rate"
            value={String(form.watch("defaultGstRate"))}
            onChange={(event) => form.setValue("defaultGstRate", Number(event.target.value) as TaxSettingsValues["defaultGstRate"])}
          >
            {[0, 0.25, 3, 5, 12, 18, 28].map((rate) => (
              <option key={rate} value={rate}>
                {rate}%
              </option>
            ))}
          </Select>
          <Select
            label="GST Filing Frequency"
            value={form.watch("gstFilingFrequency")}
            onChange={(event) => form.setValue("gstFilingFrequency", event.target.value as TaxSettingsValues["gstFilingFrequency"])}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </Select>
        </div>
        <Button loading={loading} onClick={form.handleSubmit(async (nextValue) => onSubmit(nextValue))}>
          Save Tax Settings
        </Button>
      </CardContent>
    </Card>
  );
};
