import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Textarea } from "../../../components/ui/Textarea";
import { sendReceiptSchema, type SendReceiptInputValues, type SendReceiptValues } from "../paymentSchemas";
import type { Payment } from "../../../types/payment";

export const SendReceiptModal = ({
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
  onSubmit: (values: SendReceiptValues) => Promise<void>;
}) => {
  const form = useForm<SendReceiptInputValues, undefined, SendReceiptValues>({
    resolver: zodResolver(sendReceiptSchema),
    defaultValues: {
      email: null,
      subject: null,
      message: null,
    },
  });

  useEffect(() => {
    if (!open || !payment) {
      return;
    }

    form.reset({
      email: payment.party?.email ?? null,
      subject: payment.receiptNumber ?? payment.paymentNumber,
      message: null,
    });
  }, [form, open, payment]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send Receipt"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" loading={submitting} onClick={form.handleSubmit(onSubmit)}>
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Email" type="email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <Input label="Subject" {...form.register("subject")} error={form.formState.errors.subject?.message} />
        <Textarea label="Message" rows={4} {...form.register("message")} error={form.formState.errors.message?.message} />
      </div>
    </Modal>
  );
};
