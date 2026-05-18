import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Textarea } from "../../../components/ui/Textarea";

const emailSchema = z.object({
  recipient: z.string().email("Enter valid email"),
  message: z.string().max(1000).optional().or(z.literal("")),
});

const whatsappSchema = z.object({
  recipient: z.string().regex(/^[6-9]\d{9}$/, "Enter valid mobile"),
  message: z.string().max(1000).optional().or(z.literal("")),
});

type EmailValues = z.infer<typeof emailSchema>;
type WhatsappValues = z.infer<typeof whatsappSchema>;

export const SendInvoiceModal = ({
  open,
  mode,
  defaultRecipient,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "email" | "whatsapp";
  defaultRecipient: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (values: { recipient: string; message: string | null }) => Promise<void>;
}) => {
  const emailForm = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { recipient: defaultRecipient, message: "" },
  });
  const whatsappForm = useForm<WhatsappValues>({
    resolver: zodResolver(whatsappSchema),
    defaultValues: { recipient: defaultRecipient, message: "" },
  });

  const form = mode === "email" ? emailForm : whatsappForm;

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      recipient: defaultRecipient,
      message: "",
    });
  }, [defaultRecipient, form, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "email" ? "Send Invoice Email" : "Send Invoice WhatsApp"}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            loading={submitting}
            onClick={form.handleSubmit(async (values) =>
              onSubmit({
                recipient: values.recipient,
                message: values.message?.trim() ? values.message.trim() : null,
              }),
            )}
          >
            Send
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Input
          label={mode === "email" ? "Email" : "Mobile"}
          {...form.register("recipient")}
          error={form.formState.errors.recipient?.message}
        />
        <Textarea
          label="Message"
          rows={4}
          {...form.register("message")}
          error={form.formState.errors.message?.message}
        />
      </div>
    </Modal>
  );
};
