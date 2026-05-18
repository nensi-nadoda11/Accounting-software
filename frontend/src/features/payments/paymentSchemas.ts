import { z } from "zod";

const electronicModes = new Set(["bank", "upi", "card", "neft", "rtgs", "imps"]);
const bankLinkedModes = new Set(["bank", "upi", "card", "cheque", "neft", "rtgs", "imps"]);

const nullableTrimmedString = (max: number) =>
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

export const paymentFormSchema = z
  .object({
    paymentType: z.enum(["customer_receive", "supplier_pay"]),
    partyType: z.enum(["customer", "supplier"]),
    partyId: z.string().min(1, "Party is required"),
    paymentDate: z.string().min(1, "Payment date is required"),
    amount: z.coerce.number().gt(0, "Amount must be greater than 0"),
    paymentMode: z.enum(["cash", "bank", "upi", "card", "cheque", "neft", "rtgs", "imps", "other"]),
    bankAccountId: z.string().nullable(),
    referenceNumber: nullableTrimmedString(150),
    notes: nullableTrimmedString(2000),
    status: z.enum(["draft", "completed"]),
    isAdvance: z.boolean(),
    chequeNumber: nullableTrimmedString(100),
    chequeDate: z.string().nullable(),
    chequeBankName: nullableTrimmedString(150),
    chequeStatus: z.enum(["received", "issued", "deposited", "cleared", "bounced", "cancelled"]).nullable(),
    allocations: z.array(
      z.object({
        allocationType: z.enum(["sales_invoice", "purchase_invoice", "advance_adjustment"]),
        referenceId: z.string().nullable(),
        referenceNumber: z.string().nullable(),
        allocatedAmount: z.coerce.number().min(0, "Invalid allocation"),
        allocationDate: z.string().nullable(),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    const paymentDate = new Date(value.paymentDate);
    if (Number.isNaN(paymentDate.getTime())) {
      ctx.addIssue({ code: "custom", path: ["paymentDate"], message: "Payment date is required" });
    } else if (paymentDate.getTime() > Date.now()) {
      ctx.addIssue({ code: "custom", path: ["paymentDate"], message: "Payment date cannot be in the future" });
    }

    if (value.paymentType === "customer_receive" && value.partyType !== "customer") {
      ctx.addIssue({ code: "custom", path: ["partyType"], message: "Customer payment must use customer party" });
    }

    if (value.paymentType === "supplier_pay" && value.partyType !== "supplier") {
      ctx.addIssue({ code: "custom", path: ["partyType"], message: "Supplier payment must use supplier party" });
    }

    if (bankLinkedModes.has(value.paymentMode) && !value.bankAccountId) {
      ctx.addIssue({ code: "custom", path: ["bankAccountId"], message: "Bank account is required" });
    }

    if (electronicModes.has(value.paymentMode) && !value.referenceNumber) {
      ctx.addIssue({ code: "custom", path: ["referenceNumber"], message: "Reference number is required" });
    }

    if (value.paymentMode === "cheque") {
      if (!value.chequeNumber) {
        ctx.addIssue({ code: "custom", path: ["chequeNumber"], message: "Cheque number is required" });
      }

      if (!value.chequeDate) {
        ctx.addIssue({ code: "custom", path: ["chequeDate"], message: "Cheque date is required" });
      }

      if (!value.chequeBankName) {
        ctx.addIssue({ code: "custom", path: ["chequeBankName"], message: "Cheque bank name is required" });
      }
    }

    const totalAllocated = value.allocations.reduce((sum, item) => sum + Number(item.allocatedAmount || 0), 0);
    if (totalAllocated > value.amount + 0.001) {
      ctx.addIssue({ code: "custom", path: ["allocations"], message: "Allocation total cannot exceed amount" });
    }
  });

export const cancelPaymentSchema = z.object({
  reason: z.string().trim().min(3, "Reason is required").max(500, "Reason is too long"),
});

export const sendReceiptSchema = z.object({
  email: z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return null;
      }

      const normalized = String(value).trim();
      return normalized ? normalized : null;
    },
    z.string().email("Enter a valid email").nullable(),
  ),
  subject: nullableTrimmedString(150),
  message: nullableTrimmedString(1000),
});

export const chequeStatusSchema = z.object({
  chequeStatus: z.enum(["received", "issued", "deposited", "cleared", "bounced", "cancelled"]),
  statusDate: z.string().nullable(),
  remarks: nullableTrimmedString(1000),
  reason: nullableTrimmedString(500),
});

export const reminderStatusSchema = z.object({
  status: z.enum(["pending", "sent", "failed", "cancelled"]),
  errorMessage: nullableTrimmedString(1000),
});

export const sendReminderSchema = z.object({
  partyType: z.enum(["customer", "supplier"]),
  partyId: z.string().min(1, "Party is required"),
  referenceType: z.enum(["sales_invoice", "purchase_invoice", "advance", "manual"]),
  referenceId: z.string().nullable(),
  referenceNumber: nullableTrimmedString(150),
  dueDate: z.string().min(1, "Due date is required"),
  amountDue: z.coerce.number().gt(0, "Amount must be greater than 0"),
  channel: z.enum(["in_app", "email", "whatsapp"]),
  message: nullableTrimmedString(2000),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
export type PaymentFormInputValues = z.input<typeof paymentFormSchema>;
export type CancelPaymentValues = z.output<typeof cancelPaymentSchema>;
export type CancelPaymentInputValues = z.input<typeof cancelPaymentSchema>;
export type SendReceiptValues = z.output<typeof sendReceiptSchema>;
export type SendReceiptInputValues = z.input<typeof sendReceiptSchema>;
export type ChequeStatusValues = z.output<typeof chequeStatusSchema>;
export type ChequeStatusInputValues = z.input<typeof chequeStatusSchema>;
export type ReminderStatusValues = z.output<typeof reminderStatusSchema>;
export type ReminderStatusInputValues = z.input<typeof reminderStatusSchema>;
export type SendReminderValues = z.output<typeof sendReminderSchema>;
export type SendReminderInputValues = z.input<typeof sendReminderSchema>;
