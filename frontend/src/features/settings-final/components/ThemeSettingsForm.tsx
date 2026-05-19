import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { UiPreference } from "../../../types/settings";
import { uiPreferencesSchema } from "../settingsFinalSchemas";

type ThemeValues = z.infer<typeof uiPreferencesSchema>;

const accentPresets = ["#0f9f8a", "#2563eb", "#ea580c", "#be123c", "#0891b2"];

export const ThemeSettingsForm = ({
  value,
  loading,
  onSubmit,
}: {
  value: UiPreference;
  loading?: boolean;
  onSubmit: (value: ThemeValues) => Promise<void>;
}) => {
  const form = useForm<ThemeValues>({
    resolver: zodResolver(uiPreferencesSchema),
    values: {
      accentColor: value.accentColor || "#0f9f8a",
      compactMode: value.compactMode,
      tableDensity: value.tableDensity,
      dateFormat: value.dateFormat,
      currencyFormat: value.currencyFormat,
      numberFormat: value.numberFormat,
    },
  });

  return (
    <Card>
      <CardHeader title="Theme & Preferences" />
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <Input label="Accent Color" {...form.register("accentColor")} error={form.formState.errors.accentColor?.message} />
            <div className="flex flex-wrap gap-2">
              {accentPresets.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="size-9 rounded-xl border border-slate-200"
                  style={{ backgroundColor: color }}
                  onClick={() => form.setValue("accentColor", color, { shouldValidate: true })}
                />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Table Density" value={form.watch("tableDensity")} onChange={(event) => form.setValue("tableDensity", event.target.value as ThemeValues["tableDensity"])}>
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
              </Select>
              <Select label="Date Format" value={form.watch("dateFormat")} onChange={(event) => form.setValue("dateFormat", event.target.value as ThemeValues["dateFormat"])}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
              </Select>
              <Select label="Currency Format" value={form.watch("currencyFormat")} onChange={(event) => form.setValue("currencyFormat", event.target.value as ThemeValues["currencyFormat"])}>
                <option value="symbol_first">Symbol First</option>
                <option value="symbol_last">Symbol Last</option>
                <option value="code">Currency Code</option>
              </Select>
              <Select label="Number Format" value={form.watch("numberFormat")} onChange={(event) => form.setValue("numberFormat", event.target.value as ThemeValues["numberFormat"])}>
                <option value="indian">Indian</option>
                <option value="western">Western</option>
              </Select>
            </div>
          </div>
          <div className="space-y-3">
            <ToggleSwitch label="Compact Mode" checked={form.watch("compactMode")} onCheckedChange={(checked) => form.setValue("compactMode", checked)} />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">Live Preview</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl px-4 py-3 text-white" style={{ backgroundColor: form.watch("accentColor") }}>
                  Accent surface
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  Density: <span className="font-medium text-slate-900">{form.watch("tableDensity")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Button loading={loading} onClick={form.handleSubmit(async (nextValue) => onSubmit(nextValue))}>
          Save Theme Preferences
        </Button>
      </CardContent>
    </Card>
  );
};
