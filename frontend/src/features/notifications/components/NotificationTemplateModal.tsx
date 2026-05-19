import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import type { NotificationTemplate, NotificationTemplateInput, NotificationType } from "../../../types/notification";
import { notificationChannelOptions, notificationTypeOptions } from "../notificationMeta";

type TemplateFormState = {
  templateKey: string;
  type: NotificationType;
  channel: NotificationTemplateInput["channel"];
  subject: string;
  body: string;
  variables: string;
  isActive: boolean;
};

const createInitialState = (template?: NotificationTemplate | null): TemplateFormState => ({
  templateKey: template?.templateKey ?? "custom_notification",
  type: template?.type ?? "system",
  channel: template?.channel ?? "in_app",
  subject: template?.subject ?? "",
  body: template?.body ?? "",
  variables: template?.variables.join(", ") ?? "",
  isActive: template?.isActive ?? true,
});

export const NotificationTemplateModal = ({
  open,
  template,
  onClose,
  onSubmit,
  saving,
}: {
  open: boolean;
  template?: NotificationTemplate | null;
  onClose: () => void;
  onSubmit: (payload: NotificationTemplateInput | Partial<NotificationTemplateInput>) => void;
  saving: boolean;
}) => {
  const [form, setForm] = useState<TemplateFormState>(createInitialState(template));

  useEffect(() => {
    if (open) {
      setForm(createInitialState(template));
    }
  }, [open, template]);

  const isEdit = Boolean(template);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Template" : "Add Template"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={() =>
              onSubmit({
                templateKey: form.templateKey,
                type: form.type,
                channel: form.channel,
                subject: form.subject.trim() || null,
                body: form.body,
                variables: form.variables
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
                isActive: form.isActive,
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Template Key"
          value={form.templateKey}
          disabled={isEdit}
          onChange={(event) => setForm((current) => ({ ...current, templateKey: event.target.value }))}
        />
        <Select
          label="Type"
          value={form.type}
          disabled={isEdit}
          onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as NotificationType }))}
        >
          {notificationTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          label="Channel"
          value={form.channel}
          disabled={isEdit}
          onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as TemplateFormState["channel"] }))}
        >
          {notificationChannelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Input
          label="Subject"
          value={form.subject}
          onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
        />
        <div className="md:col-span-2">
          <Textarea
            label="Body"
            value={form.body}
            onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
          />
        </div>
        <Input
          label="Variables"
          value={form.variables}
          onChange={(event) => setForm((current) => ({ ...current, variables: event.target.value }))}
        />
        <Select
          label="Active"
          value={form.isActive ? "true" : "false"}
          onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "true" }))}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </div>
    </Modal>
  );
};
