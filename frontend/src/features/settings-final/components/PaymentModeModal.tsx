import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import { Input } from "../../../components/ui/Input";
import type { PaymentMode } from "../../../types/settings";
import { paymentModeSchema } from "../settingsFinalSchemas";

type PaymentModeValues = z.infer<typeof paymentModeSchema>;

const defaultValues: PaymentModeValues = {
  modeKey: "cash",
  modeName: "Cash",
  isEnabled: true,
  isDefault: false,
  requiresReference: false,
  requiresBankAccount: false,
  chequeWorkflowEnabled: false,
};

export const PaymentModeModal = ({
  open,
  initialValue,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initialValue?: PaymentMode | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (value: PaymentModeValues) => Promise<void>;
}) => {
  const form = useForm<PaymentModeValues>({
    resolver: zodResolver(paymentModeSchema),
    values: initialValue
      ? {
          modeKey: initialValue.modeKey,
          modeName: initialValue.modeName,
          isEnabled: initialValue.isEnabled,
          isDefault: initialValue.isDefault,
          requiresReference: initialValue.requiresReference,
          requiresBankAccount: initialValue.requiresBankAccount,
          chequeWorkflowEnabled: initialValue.chequeWorkflowEnabled,
        }
      : defaultValues,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue ? "Edit Payment Mode" : "Add Payment Mode"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={form.handleSubmit(async (nextValue) => onSubmit(nextValue))}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Mode"
            value={form.watch("modeKey")}
            onChange={(event) => form.setValue("modeKey", event.target.value as PaymentModeValues["modeKey"])}
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="cheque">Cheque</option>
            <option value="wallet">Wallet</option>
            <option value="net_banking">Net Banking</option>
          </Select>
          <Input label="Display Name" {...form.register("modeName")} error={form.formState.errors.modeName?.message} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleSwitch label="Enabled" checked={form.watch("isEnabled")} onCheckedChange={(checked) => form.setValue("isEnabled", checked)} />
          <ToggleSwitch label="Default" checked={form.watch("isDefault")} onCheckedChange={(checked) => form.setValue("isDefault", checked)} />
          <ToggleSwitch label="Reference Required" checked={form.watch("requiresReference")} onCheckedChange={(checked) => form.setValue("requiresReference", checked)} />
          <ToggleSwitch label="Bank Required" checked={form.watch("requiresBankAccount")} onCheckedChange={(checked) => form.setValue("requiresBankAccount", checked)} />
          <ToggleSwitch label="Cheque Workflow" checked={form.watch("chequeWorkflowEnabled")} onCheckedChange={(checked) => form.setValue("chequeWorkflowEnabled", checked)} />
        </div>
      </div>
    </Modal>
  );
};
