import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import type { Payment } from "../../../types/payment";
import { CHEQUE_STATUS_OPTIONS } from "../paymentOptions";
import { chequeStatusSchema, type ChequeStatusInputValues, type ChequeStatusValues } from "../paymentSchemas";

export const ChequeStatusModal = ({
  open,
  payment,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  payment: Payment | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: ChequeStatusValues) => Promise<void>;
}) => {
  const form = useForm<ChequeStatusInputValues, undefined, ChequeStatusValues>({
    resolver: zodResolver(chequeStatusSchema),
    defaultValues: {
      chequeStatus: "received",
      statusDate: null,
      remarks: null,
      reason: null,
    },
  });

  useEffect(() => {
    if (!open || !payment) {
      return;
    }

    form.reset({
      chequeStatus: payment.chequeStatus ?? (payment.paymentType === "customer_receive" ? "received" : "issued"),
      statusDate: payment.paymentDate.slice(0, 10),
      remarks: null,
      reason: null,
    });
  }, [form, open, payment]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cheque Status"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" loading={submitting} onClick={form.handleSubmit(onSubmit)}>
            Update
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Status" {...form.register("chequeStatus")} error={form.formState.errors.chequeStatus?.message}>
          {CHEQUE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input label="Status Date" type="date" {...form.register("statusDate")} error={form.formState.errors.statusDate?.message} />
        <Textarea label="Remarks" rows={3} {...form.register("remarks")} error={form.formState.errors.remarks?.message} />
        <Textarea label="Reason" rows={3} {...form.register("reason")} error={form.formState.errors.reason?.message} />
      </div>
    </Modal>
  );
};
