import { Save } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { ToggleSwitch } from "../../../components/ui/ToggleSwitch";
import type { CompanyBranch } from "../../../types/company";
import { branchSchema } from "../companySchemas";

type BranchValues = z.infer<typeof branchSchema>;

export const BranchModal = ({
  open,
  onClose,
  onSubmit,
  initialValue,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: BranchValues) => Promise<void>;
  initialValue?: CompanyBranch | null;
  submitting?: boolean;
}) => {
  const form = useForm<BranchValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      branchName: "",
      branchCode: "",
      gstNumber: "",
      email: "",
      mobileNumber: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      pincode: "",
      managerName: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      branchName: initialValue?.branchName ?? "",
      branchCode: initialValue?.branchCode ?? "",
      gstNumber: initialValue?.gstNumber ?? "",
      email: initialValue?.email ?? "",
      mobileNumber: initialValue?.mobileNumber ?? "",
      addressLine1: initialValue?.addressLine1 ?? "",
      addressLine2: initialValue?.addressLine2 ?? "",
      city: initialValue?.city ?? "",
      state: initialValue?.state ?? "",
      pincode: initialValue?.pincode ?? "",
      managerName: initialValue?.managerName ?? "",
      isActive: initialValue?.isActive ?? true,
    });
  }, [form, initialValue, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialValue ? "Edit Branch" : "Add Branch"}
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
        <Input label="Branch Name" {...form.register("branchName")} error={form.formState.errors.branchName?.message} />
        <Input label="Code" {...form.register("branchCode")} error={form.formState.errors.branchCode?.message} />
        <Input label="GST" {...form.register("gstNumber")} error={form.formState.errors.gstNumber?.message} />
        <Input label="Manager" {...form.register("managerName")} error={form.formState.errors.managerName?.message} />
        <Input label="Email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <Input label="Mobile" {...form.register("mobileNumber")} error={form.formState.errors.mobileNumber?.message} />
        <Input label="Address Line 1" {...form.register("addressLine1")} error={form.formState.errors.addressLine1?.message} />
        <Input label="Address Line 2" {...form.register("addressLine2")} error={form.formState.errors.addressLine2?.message} />
        <Input label="City" {...form.register("city")} error={form.formState.errors.city?.message} />
        <Input label="State" {...form.register("state")} error={form.formState.errors.state?.message} />
        <Input label="Pincode" {...form.register("pincode")} error={form.formState.errors.pincode?.message} />
        <div className="md:col-span-2">
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
