import { AxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import { getErrorMessage } from "../../../lib/errors";
import { useToast } from "../../../providers/useToast";
import { notificationsApi } from "../../../services/notificationsApi";
import type { ManualNotificationInput, NotificationPriority, NotificationType } from "../../../types/notification";
import {
  notificationChannelOptions,
  notificationPriorityOptions,
  notificationTypeOptions,
} from "../notificationMeta";

type RecipientOption = {
  id: string;
  fullName: string;
  email: string;
  mobileNumber: string | null;
};

type ManualNotificationField = keyof ManualNotificationInput;
type ManualNotificationErrors = Partial<Record<ManualNotificationField, string>>;

type ApiErrorShape = {
  message?: string;
  errors?: string[];
};

const initialForm: ManualNotificationInput = {
  userId: null,
  recipient: "",
  title: "",
  message: "",
  type: "system",
  priority: "info",
  channel: "in_app",
  actionUrl: "",
  entityType: "",
  entityId: "",
};

export const ManualNotificationModal = ({
  open,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: ManualNotificationInput) => Promise<void>;
  saving: boolean;
}) => {
  const toast = useToast();
  const [form, setForm] = useState<ManualNotificationInput>(initialForm);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [errors, setErrors] = useState<ManualNotificationErrors>({});

  const selectedRecipient = useMemo(
    () => recipients.find((item) => item.id === form.userId) ?? null,
    [form.userId, recipients],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(initialForm);
    setErrors({});
    void notificationsApi
      .listRecipients()
      .then((response) => setRecipients(response.data.items))
      .catch((error) => {
        setRecipients([]);
        toast.error(getErrorMessage(error, "Failed to load recipients"));
      });
  }, [open, toast]);

  const updateField = <TField extends ManualNotificationField>(field: TField, value: ManualNotificationInput[TField]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const nextErrors: ManualNotificationErrors = {};
    const trimmedTitle = form.title.trim();
    const trimmedMessage = form.message.trim();
    const trimmedRecipient = form.recipient?.trim() ?? "";
    const requiresRecipient = form.channel !== "in_app" && !form.userId;

    if (!trimmedTitle) {
      nextErrors.title = "Title is required";
    }

    if (!trimmedMessage) {
      nextErrors.message = "Message is required";
    }

    if (form.channel === "in_app" && !form.userId) {
      nextErrors.userId = "A target user is required for in-app notifications";
    }

    if (requiresRecipient && !trimmedRecipient) {
      nextErrors.recipient = "Recipient is required for the selected channel";
    }

    if (form.channel === "email" && trimmedRecipient) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(trimmedRecipient)) {
        nextErrors.recipient = "Recipient email is invalid";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const applyServerErrors = (error: unknown) => {
    if (!(error instanceof AxiosError) || !error.response) {
      return false;
    }

    const data = error.response.data as ApiErrorShape | undefined;
    const nextErrors: ManualNotificationErrors = {};

    for (const item of data?.errors ?? []) {
      const separatorIndex = item.indexOf(":");
      if (separatorIndex < 0) {
        continue;
      }

      const field = item.slice(0, separatorIndex).trim() as ManualNotificationField;
      const message = item.slice(separatorIndex + 1).trim();

      if (!message || !(field in initialForm)) {
        continue;
      }

      nextErrors[field] = message;
    }

    if (Object.keys(nextErrors).length === 0) {
      return false;
    }

    setErrors(nextErrors);
    return true;
  };

  const handleRecipientUserChange = (value: string) => {
    const userId = value || null;
    const recipientUser = recipients.find((item) => item.id === userId) ?? null;
    const recipient =
      !userId ? form.recipient : form.channel === "email"
        ? recipientUser?.email ?? form.recipient
        : form.channel === "sms" || form.channel === "whatsapp"
          ? recipientUser?.mobileNumber ?? form.recipient
          : form.recipient;

    setForm((current) => ({
      ...current,
      userId,
      recipient,
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.userId;
      delete next.recipient;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        ...form,
        recipient: form.recipient?.trim() || null,
        title: form.title.trim(),
        message: form.message.trim(),
        actionUrl: form.actionUrl?.trim() || null,
        entityType: form.entityType?.trim() || null,
        entityId: form.entityId?.trim() || null,
      });
    } catch (error) {
      if (!applyServerErrors(error)) {
        toast.error(getErrorMessage(error, "Failed to send notification"));
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manual Send"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void handleSubmit()}>
            Send
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Select
          label="Type"
          value={form.type}
          error={errors.type}
          onChange={(event) => updateField("type", event.target.value as NotificationType)}
        >
          {notificationTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          label="Priority"
          value={form.priority}
          error={errors.priority}
          onChange={(event) => updateField("priority", event.target.value as NotificationPriority)}
        >
          {notificationPriorityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          label="Channel"
          value={form.channel}
          error={errors.channel}
          onChange={(event) => {
            const channel = event.target.value as ManualNotificationInput["channel"];
            const recipient =
              form.userId && channel === "email"
                ? selectedRecipient?.email ?? form.recipient
                : form.userId && (channel === "sms" || channel === "whatsapp")
                  ? selectedRecipient?.mobileNumber ?? form.recipient
                  : form.recipient;

            setForm((current) => ({ ...current, channel, recipient }));
            setErrors((current) => {
              const next = { ...current };
              delete next.channel;
              delete next.userId;
              delete next.recipient;
              return next;
            });
          }}
        >
          {notificationChannelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          label="Recipient User"
          value={form.userId ?? ""}
          error={errors.userId}
          onChange={(event) => handleRecipientUserChange(event.target.value)}
        >
          <option value="">None</option>
          {recipients.map((item) => (
            <option key={item.id} value={item.id}>
              {item.fullName}
            </option>
          ))}
        </Select>
        <Input
          label="Recipient"
          value={form.recipient ?? ""}
          error={errors.recipient}
          onChange={(event) => updateField("recipient", event.target.value)}
        />
        <Input
          label="Action URL"
          value={form.actionUrl ?? ""}
          error={errors.actionUrl}
          onChange={(event) => updateField("actionUrl", event.target.value)}
        />
        <div className="md:col-span-2">
          <Input
            label="Title"
            value={form.title}
            error={errors.title}
            onChange={(event) => updateField("title", event.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Textarea
            label="Message"
            value={form.message}
            error={errors.message}
            onChange={(event) => updateField("message", event.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
};

