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
  | "customer.ledger.view"
  | "customer.export"
  | "supplier.view"
  | "supplier.create"
  | "supplier.update"
  | "supplier.delete"
  | "supplier.ledger.view"
  | "supplier.export"
  | "product.view"
  | "product.create"
  | "product.update"
  | "product.delete"
  | "product.export"
  | "product.price.view"
  | "product.price.manage"
  | "category.manage"
  | "unit.manage"
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
  legalName: string | null;
  businessType: string | null;
  industryType: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  cinNumber: string | null;
  email: string | null;
  mobileNumber: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  timezone: string;
  currency: string;
  language: string;
  status: CompanyStatus;
  setupCompletedAt: string | null;
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
