export const AUDIT_LOG_STATUSES = ["success", "failed"] as const;
export const LOGIN_LOG_TYPES = ["login", "logout", "failed_login", "password_reset"] as const;
export const BACKUP_TYPES = ["manual", "scheduled"] as const;
export const BACKUP_STATUSES = ["generating", "completed", "failed", "restoring"] as const;
export const RESTORE_LOG_STATUSES = ["success", "failed"] as const;
export const RESTORE_MODES = ["merge", "replace"] as const;

export const BACKUP_INCLUDE_KEYS = [
  "settings",
  "users",
  "customers",
  "suppliers",
  "products",
  "inventory",
  "sales",
  "purchases",
  "payments",
  "accounting",
  "expenses",
  "payroll",
  "gst"
] as const;

export type AuditLogStatus = (typeof AUDIT_LOG_STATUSES)[number];
export type LoginLogType = (typeof LOGIN_LOG_TYPES)[number];
export type BackupType = (typeof BACKUP_TYPES)[number];
export type BackupStatus = (typeof BACKUP_STATUSES)[number];
export type RestoreLogStatus = (typeof RESTORE_LOG_STATUSES)[number];
export type RestoreMode = (typeof RESTORE_MODES)[number];
export type BackupIncludeKey = (typeof BACKUP_INCLUDE_KEYS)[number];

export type SecurityAdminActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
  fullName?: string | null;
};

export type SecurityAdminRequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
};
