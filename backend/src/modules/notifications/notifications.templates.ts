import type {
  NotificationTemplateDefinition,
  NotificationType
} from "./notifications.types";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const replaceVariables = (template: string, variables: Record<string, string>) =>
  template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key: string) => variables[key] ?? "");

export const SYSTEM_NOTIFICATION_TEMPLATES: NotificationTemplateDefinition[] = [
  {
    templateKey: "payment_due_default",
    type: "payment_due",
    channel: "in_app",
    subject: null,
    body: "Invoice {{invoiceNumber}} for {{partyName}} is overdue by {{dueAmount}} since {{dueDate}}.",
    variables: ["invoiceNumber", "partyName", "dueAmount", "dueDate"],
    isSystem: true,
    isActive: true
  },
  {
    templateKey: "payment_due_default",
    type: "payment_due",
    channel: "email",
    subject: "Payment due reminder for {{invoiceNumber}}",
    body: "Dear {{partyName}},\n\nThis is a reminder that invoice {{invoiceNumber}} for {{dueAmount}} was due on {{dueDate}}.\n\nRegards,\n{{companyName}}",
    variables: ["invoiceNumber", "partyName", "dueAmount", "dueDate", "companyName"],
    isSystem: true,
    isActive: true
  },
  {
    templateKey: "supplier_due_default",
    type: "supplier_due",
    channel: "in_app",
    subject: null,
    body: "Supplier payable {{invoiceNumber}} for {{partyName}} is due for {{dueAmount}} on {{dueDate}}.",
    variables: ["invoiceNumber", "partyName", "dueAmount", "dueDate"],
    isSystem: true,
    isActive: true
  },
  {
    templateKey: "low_stock_default",
    type: "low_stock",
    channel: "in_app",
    subject: null,
    body: "{{productName}} is low in {{warehouseName}}. Available {{availableQuantity}}, reorder level {{reorderLevel}}.",
    variables: ["productName", "warehouseName", "availableQuantity", "reorderLevel"],
    isSystem: true,
    isActive: true
  },
  {
    templateKey: "expiry_default",
    type: "expiry",
    channel: "in_app",
    subject: null,
    body: "Batch {{batchNumber}} for {{productName}} expires on {{expiryDate}}.",
    variables: ["batchNumber", "productName", "expiryDate"],
    isSystem: true,
    isActive: true
  },
  {
    templateKey: "invoice_default",
    type: "invoice",
    channel: "in_app",
    subject: null,
    body: "Invoice {{invoiceNumber}} for {{partyName}} is due on {{dueDate}} for {{dueAmount}}.",
    variables: ["invoiceNumber", "partyName", "dueDate", "dueAmount"],
    isSystem: true,
    isActive: true
  },
  {
    templateKey: "invoice_default",
    type: "invoice",
    channel: "email",
    subject: "Invoice reminder {{invoiceNumber}}",
    body: "Dear {{partyName}},\n\nInvoice {{invoiceNumber}} is due on {{dueDate}} for {{dueAmount}}.\n\nRegards,\n{{companyName}}",
    variables: ["invoiceNumber", "partyName", "dueDate", "dueAmount", "companyName"],
    isSystem: true,
    isActive: true
  },
  {
    templateKey: "gst_default",
    type: "gst",
    channel: "in_app",
    subject: null,
    body: "GST payment for {{periodLabel}} is due on {{dueDate}}. Estimated payable {{netGstPayable}}.",
    variables: ["periodLabel", "dueDate", "netGstPayable"],
    isSystem: true,
    isActive: true
  },
  {
    templateKey: "payroll_default",
    type: "payroll",
    channel: "in_app",
    subject: null,
    body: "Payroll run {{runNumber}} for {{payrollMonth}} has unpaid salary of {{pendingAmount}}.",
    variables: ["runNumber", "payrollMonth", "pendingAmount"],
    isSystem: true,
    isActive: true
  },
  {
    templateKey: "warning_default",
    type: "warning",
    channel: "in_app",
    subject: null,
    body: "{{message}}",
    variables: ["message"],
    isSystem: true,
    isActive: true
  }
];

export const getDefaultTemplateKey = (type: NotificationType) => `${type}_default`;

export const renderTemplate = (template: {
  subject: string | null;
  body: string;
}, variables: Record<string, string>) => {
  const subject = template.subject ? replaceVariables(template.subject, variables) : null;
  const text = replaceVariables(template.body, variables).trim();
  const html = `<p>${escapeHtml(text).replace(/\n+/g, "</p><p>")}</p>`;

  return {
    subject,
    text,
    html
  };
};
