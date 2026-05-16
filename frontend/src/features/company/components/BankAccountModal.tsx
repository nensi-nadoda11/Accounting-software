import { Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { FileUpload } from "../../../components/ui/FileUpload";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { CompanyBankAccount } from "../../../types/company";
import { COMPANY_BANK_ACCOUNT_TYPE_OPTIONS } from "../companyOptions";
import { bankAccountSchema } from "../companySchemas";
import { readFileAsDataUrl } from "../companyUtils";

type BankAccountValues = z.infer<typeof bankAccountSchema>;

export const BankAccountModal = ({
  open,
  onClose,
  onSubmit,
  initialValue,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: BankAccountValues) => Promise<void>;
  initialValue?: CompanyBankAccount | null;
  submitting?: boolean;
}) => {
  const form = useForm<BankAccountValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      bankName: "",
      accountHolderName: "",
      accountNumber: "",
      ifscCode: "",
      branchName: "",
      upiId: "",
      qrImageUrl: "",
      openingBalance: "0",
      accountType: "current",
      isDefault: false,
      isActive: true,
    },
  });
  const [uploadError, setUploadError] = useState<string | undefined>();
  const [readingFile, setReadingFile] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      bankName: initialValue?.bankName ?? "",
      accountHolderName: initialValue?.accountHolderName ?? "",
      accountNumber: initialValue?.accountNumber ?? "",
      ifscCode: initialValue?.ifscCode ?? "",
      branchName: initialValue?.branchName ?? "",
      upiId: initialValue?.upiId ?? "",
      qrImageUrl: initialValue?.qrImageUrl ?? "",
      openingBalance: initialValue ? initialValue.openingBalance.toString() : "0",
      accountType: initialValue?.accountType ?? "current",
      isDefault: initialValue?.isDefault ?? false,
      isActive: initialValue?.isActive ?? true,
    });
    setUploadError(undefined);
  }, [form, initialValue, open]);

  const qrImageUrl = form.watch("qrImageUrl");
  const uploadPreviewUrl = useMemo(() => qrImageUrl || null, [qrImageUrl]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue ? "Edit Bank Account" : "Add Bank Account"}
      className="max-w-4xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={submitting}
            onClick={form.handleSubmit(async (values) => {
              await onSubmit(values);
            })}
          >
            <Save className="mr-2 size-4" />
            Save
          </Button>
        </>
      }
    >
      <form className="grid gap-4 md:grid-cols-2">
        <Input label="Bank" {...form.register("bankName")} error={form.formState.errors.bankName?.message} />
        <Input
          label="Account Holder"
          {...form.register("accountHolderName")}
          error={form.formState.errors.accountHolderName?.message}
        />
        <Input
          label="Account Number"
          {...form.register("accountNumber")}
          error={form.formState.errors.accountNumber?.message}
        />
        <Input label="IFSC" {...form.register("ifscCode")} error={form.formState.errors.ifscCode?.message} />
        <Input label="Branch" {...form.register("branchName")} error={form.formState.errors.branchName?.message} />
        <Input label="UPI ID" {...form.register("upiId")} error={form.formState.errors.upiId?.message} />
        <Input
          label="Opening Balance"
          type="number"
          step="0.01"
          min="0"
          {...form.register("openingBalance")}
          error={form.formState.errors.openingBalance?.message}
        />
        <Select label="Account Type" {...form.register("accountType")} error={form.formState.errors.accountType?.message}>
          {COMPANY_BANK_ACCOUNT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <div className="md:col-span-2">
          <FileUpload
            label="QR Image"
            previewUrl={uploadPreviewUrl}
            error={uploadError}
            uploading={readingFile}
            emptyLabel="Upload QR"
            previewClassName="h-44"
            onFileSelect={async (file) => {
              if (file.size > 1024 * 1024) {
                setUploadError("QR image must be 1MB or less");
                return;
              }

              setReadingFile(true);
              setUploadError(undefined);
              try {
                const dataUrl = await readFileAsDataUrl(file);
                form.setValue("qrImageUrl", dataUrl, { shouldDirty: true });
              } catch (error) {
                setUploadError(error instanceof Error ? error.message : "Failed to read selected file");
              } finally {
                setReadingFile(false);
              }
            }}
            onRemove={() => {
              form.setValue("qrImageUrl", "", { shouldDirty: true });
              setUploadError(undefined);
            }}
          />
        </div>
        <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
          <Controller
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Default Account" />
            )}
          />
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <ToggleSwitch checked={field.value} onCheckedChange={field.onChange} label="Active" />
            )}
          />
        </div>
      </form>
    </Modal>
  );
};
