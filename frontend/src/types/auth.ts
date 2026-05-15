export type Role = "admin" | "accountant" | "staff" | "auditor";
export type UserStatus =
  | "pending_verification"
  | "invited"
  | "active"
  | "suspended"
  | "disabled";
export type CompanyStatus = "setup_pending" | "active" | "suspended" | "inactive";

export type PermissionKey =
  | "customer.view"
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  | "supplier.view"
  | "supplier.create"
  | "supplier.update"
  | "supplier.delete"
  | "product.view"
  | "product.create"
  | "product.update"
  | "product.delete"
  | "inventory.view"
  | "inventory.manage"
  | "purchase.view"
  | "purchase.create"
  | "purchase.update"
  | "purchase.delete"
  | "sales.view"
  | "sales.create"
  | "sales.update"
  | "sales.delete"
  | "payment.view"
  | "payment.receive"
  | "payment.pay"
  | "expense.view"
  | "expense.manage"
  | "accounting.view"
  | "accounting.manage"
  | "gst.view"
  | "gst.manage"
  | "payroll.view"
  | "payroll.manage"
  | "report.view"
  | "report.export"
  | "user.view"
  | "user.manage"
  | "settings.manage"
  | "audit.view"
  | "backup.manage";

export interface Company {
  id: string;
  name: string;
  gstNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  companyId: string | null;
  fullName: string;
  email: string;
  mobileNumber: string | null;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: string | null;
  mobileVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionData {
  user: User;
  company: Company | null;
  permissions: PermissionKey[];
}
