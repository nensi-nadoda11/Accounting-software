import { Card, CardContent } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Select";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { NotificationPreference } from "../../../types/notification";

export const NotificationPreferences = ({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: NotificationPreference;
  onChange: (next: NotificationPreference) => void;
  onSave: () => void;
  saving: boolean;
}) => (
  <Card>
    <CardContent className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ToggleSwitch checked={value.inAppEnabled} onCheckedChange={(checked) => onChange({ ...value, inAppEnabled: checked })} label="In-App" />
        <ToggleSwitch checked={value.emailEnabled} onCheckedChange={(checked) => onChange({ ...value, emailEnabled: checked })} label="Email" />
        <ToggleSwitch checked={value.whatsappEnabled} onCheckedChange={(checked) => onChange({ ...value, whatsappEnabled: checked })} label="WhatsApp" />
        <ToggleSwitch checked={value.smsEnabled} onCheckedChange={(checked) => onChange({ ...value, smsEnabled: checked })} label="SMS" />
        <ToggleSwitch checked={value.paymentReminders} onCheckedChange={(checked) => onChange({ ...value, paymentReminders: checked })} label="Payment Reminders" />
        <ToggleSwitch checked={value.supplierReminders} onCheckedChange={(checked) => onChange({ ...value, supplierReminders: checked })} label="Supplier Reminders" />
        <ToggleSwitch checked={value.lowStockAlerts} onCheckedChange={(checked) => onChange({ ...value, lowStockAlerts: checked })} label="Low Stock" />
        <ToggleSwitch checked={value.expiryAlerts} onCheckedChange={(checked) => onChange({ ...value, expiryAlerts: checked })} label="Expiry" />
        <ToggleSwitch checked={value.invoiceReminders} onCheckedChange={(checked) => onChange({ ...value, invoiceReminders: checked })} label="Invoice" />
        <ToggleSwitch checked={value.payrollAlerts} onCheckedChange={(checked) => onChange({ ...value, payrollAlerts: checked })} label="Payroll" />
        <ToggleSwitch checked={value.gstAlerts} onCheckedChange={(checked) => onChange({ ...value, gstAlerts: checked })} label="GST" />
      </div>
      <div className="grid gap-3 md:grid-cols-[220px_auto] md:items-end">
        <Select value={value.frequency} onChange={(event) => onChange({ ...value, frequency: event.target.value as NotificationPreference["frequency"] })} label="Frequency">
          <option value="instant">Instant</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </Select>
        <div className="flex justify-end">
          <Button loading={saving} onClick={onSave}>
            Save Preferences
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);
