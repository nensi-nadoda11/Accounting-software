import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormSetError } from "react-hook-form";
import type { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import { Textarea } from "../../../components/ui/Textarea";
import type { InvoiceTemplate } from "../../../types/settings";
import { invoiceTemplateSchema } from "../settingsFinalSchemas";
import { InvoiceTemplatePreview } from "./InvoiceTemplatePreview";

type InvoiceTemplateValues = z.infer<typeof invoiceTemplateSchema>;

const defaultValues: InvoiceTemplateValues = {
  templateKey: "",
  templateName: "",
  invoiceType: "sales",
  layoutConfig: {
    showLogo: true,
    showSignature: false,
    showBankDetails: true,
    showQrCode: false,
    termsFooter: "",
    footerNote: "",
  },
  isDefault: false,
  isActive: true,
};

export const InvoiceTemplateEditor = ({
  open,
  initialValue,
  loading,
  companyName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initialValue?: InvoiceTemplate | null;
  loading?: boolean;
  companyName?: string;
  onClose: () => void;
  onSubmit: (value: InvoiceTemplateValues, setError: UseFormSetError<InvoiceTemplateValues>) => Promise<void>;
}) => {
  const form = useForm<InvoiceTemplateValues>({
    resolver: zodResolver(invoiceTemplateSchema),
    values: initialValue
      ? {
          templateKey: initialValue.templateKey,
          templateName: initialValue.templateName,
          invoiceType: initialValue.invoiceType,
          layoutConfig: initialValue.layoutConfig,
          isDefault: initialValue.isDefault,
          isActive: initialValue.isActive,
        }
      : defaultValues,
  });

  const preview = form.watch();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue ? "Edit Invoice Template" : "Add Invoice Template"}
      className="max-w-5xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={form.handleSubmit(async (nextValue) => onSubmit(nextValue, form.setError))}>
            Save Template
          </Button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Template Name" {...form.register("templateName")} error={form.formState.errors.templateName?.message} />
            <Input label="Template Key" {...form.register("templateKey")} error={form.formState.errors.templateKey?.message} />
            <Select
              label="Invoice Type"
              value={preview.invoiceType}
              error={form.formState.errors.invoiceType?.message}
              onChange={(event) => form.setValue("invoiceType", event.target.value as InvoiceTemplateValues["invoiceType"], { shouldDirty: true, shouldValidate: true })}
            >
              <option value="sales">Sales</option>
              <option value="purchase">Purchase</option>
              <option value="pos">POS</option>
              <option value="return">Return</option>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleSwitch label="Active" checked={preview.isActive} onCheckedChange={(checked) => form.setValue("isActive", checked)} />
            <ToggleSwitch label="Default" checked={preview.isDefault} onCheckedChange={(checked) => form.setValue("isDefault", checked)} />
            <ToggleSwitch label="Show Logo" checked={preview.layoutConfig.showLogo} onCheckedChange={(checked) => form.setValue("layoutConfig.showLogo", checked)} />
            <ToggleSwitch label="Show Signature" checked={preview.layoutConfig.showSignature} onCheckedChange={(checked) => form.setValue("layoutConfig.showSignature", checked)} />
            <ToggleSwitch label="Show Bank Details" checked={preview.layoutConfig.showBankDetails} onCheckedChange={(checked) => form.setValue("layoutConfig.showBankDetails", checked)} />
            <ToggleSwitch label="Show QR Code" checked={preview.layoutConfig.showQrCode} onCheckedChange={(checked) => form.setValue("layoutConfig.showQrCode", checked)} />
          </div>
          {form.formState.errors.isDefault?.message ? (
            <p className="text-xs text-rose-600">{form.formState.errors.isDefault.message}</p>
          ) : null}
          <Textarea label="Terms / Footer" rows={4} {...form.register("layoutConfig.termsFooter")} error={form.formState.errors.layoutConfig?.termsFooter?.message} />
          <Textarea label="Footer Note" rows={4} {...form.register("layoutConfig.footerNote")} error={form.formState.errors.layoutConfig?.footerNote?.message} />
        </div>
        <InvoiceTemplatePreview
          templateName={preview.templateName}
          invoiceType={preview.invoiceType}
          layoutConfig={preview.layoutConfig}
          companyName={companyName}
        />
      </div>
    </Modal>
  );
};
