import { z } from "zod";

export const CANCEL_PAYMENT_SCHEMA = z.object({
  reason: z.string().trim().min(3, "Reason is required").max(500, "Reason is too long"),
});

const nullableText = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return null;
      }

      const normalized = String(value).trim();
      return normalized ? normalized : null;
    },
    z.string().max(max).nullable(),
  );

export const SEND_REMINDER_SCHEMA = z.object({
  partyType: z.enum(["customer", "supplier"]),
  partyId: z.string().min(1, "Party is required"),
  referenceType: z.enum(["sales_invoice", "purchase_invoice", "advance", "manual"]),
  referenceId: z.string().nullable(),
  referenceNumber: nullableText(150),
  dueDate: z.string().min(1, "Due date is required"),
  amountDue: z.coerce.number().gt(0, "Amount must be greater than 0"),
  channel: z.enum(["in_app", "email", "whatsapp"]),
  message: nullableText(2000),
});

export const UPDATE_REMINDER_STATUS_SCHEMA = z.object({
  status: z.enum(["pending", "sent", "failed", "cancelled"]),
  errorMessage: nullableText(1000),
});

export type CancelPaymentFormValues = z.output<typeof CANCEL_PAYMENT_SCHEMA>;
export type CancelPaymentFormInputValues = z.input<typeof CANCEL_PAYMENT_SCHEMA>;
export type SendReminderFormValues = z.output<typeof SEND_REMINDER_SCHEMA>;
export type SendReminderFormInputValues = z.input<typeof SEND_REMINDER_SCHEMA>;
export type ReminderStatusFormValues = z.output<typeof UPDATE_REMINDER_STATUS_SCHEMA>;
export type ReminderStatusFormInputValues = z.input<typeof UPDATE_REMINDER_STATUS_SCHEMA>;
