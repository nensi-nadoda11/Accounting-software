import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import type { ItcRow } from "../../../types/gst";
import {
  createGstItcStatusSchema,
  type GstItcStatusFormInputValues,
  type GstItcStatusFormValues,
} from "../gstSchemas";
import { GST_CLAIM_STATUS_LABELS, GST_ELIGIBILITY_LABELS } from "../gstUtils";

export const ItcStatusModal = ({
  open,
  item,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  item: ItcRow | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: GstItcStatusFormValues) => void;
}) => {
  const totalGstAmount = Number(item?.totalGstAmount ?? 0);
  const form = useForm<GstItcStatusFormInputValues, undefined, GstItcStatusFormValues>({
    resolver: zodResolver(createGstItcStatusSchema(totalGstAmount)),
    defaultValues: {
      eligibilityStatus: "eligible",
      claimStatus: "unclaimed",
      claimedAmount: 0,
      notes: "",
    },
  });

  useEffect(() => {
    if (!open || !item) {
      return;
    }

    form.reset({
      eligibilityStatus: item.eligibilityStatus,
      claimStatus: item.claimStatus,
      claimedAmount: Number(item.claimedAmount),
      notes: item.notes ?? "",
    });
  }, [form, item, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update ITC Status"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={submitting} onClick={form.handleSubmit(onSubmit)}>
            Update
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Select label="Eligibility Status" {...form.register("eligibilityStatus")} error={form.formState.errors.eligibilityStatus?.message}>
          {Object.entries(GST_ELIGIBILITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Select label="Claim Status" {...form.register("claimStatus")} error={form.formState.errors.claimStatus?.message}>
          {Object.entries(GST_CLAIM_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Input type="number" step="0.01" label="Claimed Amount" {...form.register("claimedAmount")} error={form.formState.errors.claimedAmount?.message} />
        <div />
        <Textarea label="Notes" rows={3} {...form.register("notes")} error={form.formState.errors.notes?.message?.toString()} className="md:col-span-2" />
      </div>
    </Modal>
  );
};
