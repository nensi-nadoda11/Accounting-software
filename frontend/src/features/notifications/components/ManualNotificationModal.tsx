import { useEffect, useState } from "react";

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
  onSubmit: (payload: ManualNotificationInput) => void;
  saving: boolean;
}) => {
  const toast = useToast();
  const [form, setForm] = useState<ManualNotificationInput>(initialForm);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(initialForm);
    void notificationsApi
      .listRecipients()
      .then((response) => setRecipients(response.data.items))
      .catch((error) => {
        setRecipients([]);
        toast.error(getErrorMessage(error, "Failed to load recipients"));
      });
  }, [open, toast]);

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
          <Button loading={saving} onClick={() => onSubmit(form)}>
            Send
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Select
          label="Type"
          value={form.type}
          onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as NotificationType }))}
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
          onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as NotificationPriority }))}
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
          onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as ManualNotificationInput["channel"] }))}
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
          onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value || null }))}
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
          onChange={(event) => setForm((current) => ({ ...current, recipient: event.target.value }))}
        />
        <Input
          label="Action URL"
          value={form.actionUrl ?? ""}
          onChange={(event) => setForm((current) => ({ ...current, actionUrl: event.target.value }))}
        />
        <div className="md:col-span-2">
          <Input
            label="Title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <Textarea
            label="Message"
            value={form.message}
            onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
};

