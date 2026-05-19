export type AuditLogStatus = "success" | "failed";
export type LoginLogType = "login" | "logout" | "failed_login" | "password_reset";
export type BackupType = "manual" | "scheduled";
export type BackupStatus = "generating" | "completed" | "failed" | "restoring";
export type RestoreMode = "merge" | "replace";
export type RestoreLogStatus = "success" | "failed";
export type BackupIncludeKey =
  | "settings"
  | "users"
  | "customers"
  | "suppliers"
  | "products"
  | "inventory"
  | "sales"
  | "purchases"
  | "payments"
  | "accounting"
  | "expenses"
  | "payroll"
  | "gst";

export interface AuditLog {
  id: string;
  companyId: string | null;
  userId: string | null;
  userName: string;
  userRole: string | null;
  action: string;
  module: string;
  entityType: string | null;
  entityId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  status: AuditLogStatus;
  createdAt: string;
}

export interface LoginLog {
  id: string;
  companyId: string | null;
  userId: string | null;
  email: string;
  loginType: LoginLogType;
  ipAddress: string | null;
  userAgent: string | null;
  success: boolean;
  failureReason: string | null;
  createdAt: string;
}

export interface Backup {
  id: string;
  backupName: string;
  backupType: BackupType;
  fileName: string;
  fileUrl: string | null;
  sizeBytes: number | null;
  status: BackupStatus;
  includes: BackupIncludeKey[];
  createdBy: string | null;
  createdByName: string;
  restoreStartedAt: string | null;
  restoredAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestoreLog {
  id: string;
  backupId: string;
  backupName: string;
  restoredBy: string | null;
  restoredByName: string;
  status: RestoreLogStatus;
  restoreMode: RestoreMode;
  errorMessage: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditFilters {
  page: number;
  limit: number;
  module?: string;
  action?: string;
  user?: string;
  status?: AuditLogStatus | "";
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface LoginLogFilters {
  page: number;
  limit: number;
  email?: string;
  loginType?: LoginLogType | "";
  success?: "true" | "false" | "";
  dateFrom?: string;
  dateTo?: string;
}

export interface BackupFilters {
  page: number;
  limit: number;
  search?: string;
  status?: BackupStatus | "";
  backupType?: BackupType | "";
}

export interface RestoreLogFilters {
  page: number;
  limit: number;
  status?: RestoreLogStatus | "";
  restoreMode?: RestoreMode | "";
  dateFrom?: string;
  dateTo?: string;
}

export interface SecurityAdminListResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface FileDownload {
  blob: Blob;
  fileName: string;
  contentType: string;
}
