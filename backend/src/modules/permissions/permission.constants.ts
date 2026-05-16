export const ALL_PERMISSIONS = [
  "customer.view",
  "customer.create",
  "customer.update",
  "customer.delete",
  "customer.ledger.view",
  "customer.export",
  "supplier.view",
  "supplier.create",
  "supplier.update",
  "supplier.delete",
  "supplier.ledger.view",
  "supplier.export",
  "product.view",
  "product.create",
  "product.update",
  "product.delete",
  "inventory.view",
  "inventory.manage",
  "purchase.view",
  "purchase.create",
  "purchase.update",
  "purchase.delete",
  "sales.view",
  "sales.create",
  "sales.update",
  "sales.delete",
  "payment.view",
  "payment.receive",
  "payment.pay",
  "expense.view",
  "expense.manage",
  "accounting.view",
  "accounting.manage",
  "gst.view",
  "gst.manage",
  "payroll.view",
  "payroll.manage",
  "report.view",
  "report.export",
  "user.view",
  "user.manage",
  "settings.manage",
  "audit.view",
  "backup.manage"
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

const accountantPermissions: PermissionKey[] = [
  "customer.view",
  "customer.ledger.view",
  "customer.export",
  "supplier.view",
  "supplier.ledger.view",
  "supplier.export",
  "accounting.view",
  "accounting.manage",
  "payment.view",
  "payment.receive",
  "payment.pay",
  "expense.view",
  "expense.manage",
  "gst.view",
  "gst.manage",
  "payroll.view",
  "payroll.manage",
  "report.view",
  "report.export",
  "sales.view",
  "purchase.view"
];

const staffPermissions: PermissionKey[] = [
  "customer.view",
  "customer.create",
  "customer.update",
  "supplier.view",
  "supplier.create",
  "supplier.update",
  "product.view",
  "product.create",
  "product.update",
  "inventory.view",
  "purchase.view",
  "purchase.create",
  "purchase.update",
  "sales.view",
  "sales.create",
  "sales.update"
];

const auditorPermissions: PermissionKey[] = [
  "customer.view",
  "customer.ledger.view",
  "supplier.view",
  "supplier.ledger.view",
  "report.view",
  "audit.view",
  "accounting.view",
  "gst.view"
];

export const DEFAULT_ROLE_PERMISSIONS = {
  admin: [...ALL_PERMISSIONS],
  accountant: accountantPermissions,
  staff: staffPermissions,
  auditor: auditorPermissions
} as const;
