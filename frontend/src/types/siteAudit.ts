import type { DownloadFileResult } from "./product";

export type SiteAuditStatus = "draft" | "completed" | "approved" | "cancelled";
export type SiteAuditFinalResult = "passed" | "issues_found" | "needs_review";
export type SiteAuditFindingSeverity = "low" | "medium" | "high" | "critical";
export type SiteAuditFindingStatus = "open" | "resolved" | "ignored";
export type SiteAuditExportFormat = "pdf" | "csv";
export type SiteAuditChecklistKey =
  | "stock_verified"
  | "cash_verified"
  | "purchase_records_verified"
  | "sales_records_verified"
  | "expense_records_verified"
  | "gst_records_verified"
  | "damaged_stock_verified"
  | "user_activity_verified";

export interface SiteAuditUserRef {
  id: string;
  name: string | null;
  role?: string | null;
}

export interface SiteAuditWarehouseRef {
  id: string;
  name: string | null;
  warehouseCode: string | null;
}

export interface SiteAuditListItem {
  id: string;
  auditNo: string;
  auditDate: string;
  warehouse: SiteAuditWarehouseRef | null;
  auditor: SiteAuditUserRef;
  status: SiteAuditStatus;
  finalResult: SiteAuditFinalResult;
  findings: {
    total: number;
    critical: number;
  };
  overallRemarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteAuditChecklistItem {
  id?: string;
  checklistKey: SiteAuditChecklistKey;
  checklistLabel: string;
  isChecked: boolean;
  remarks: string | null;
  createdAt?: string;
}

export interface SiteAuditFinding {
  id?: string;
  findingTitle: string;
  findingDescription: string | null;
  severity: SiteAuditFindingSeverity;
  status: SiteAuditFindingStatus;
  relatedModule: string | null;
  relatedReferenceId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SiteAuditAttachment {
  id: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
}

export interface LinkedStockCheckSummary {
  id: string;
  checkNo: string | null;
  status: string | null;
  summary: {
    totalItems: number;
    matchedItems: number;
    shortItems: number;
    excessItems: number;
  };
  mismatchSummary: {
    shortItems: number;
    excessItems: number;
    mismatchItems: number;
  };
}

export interface LinkedCashVerificationSummary {
  id: string;
  verificationNo: string | null;
  status: string | null;
  recordStatus: string | null;
  expectedCash: string;
  actualCash: string;
  differenceAmount: string;
}

export interface SiteAuditDetail {
  id: string;
  auditNo: string;
  auditDate: string;
  warehouse: SiteAuditWarehouseRef | null;
  auditor: SiteAuditUserRef;
  status: SiteAuditStatus;
  finalResult: SiteAuditFinalResult;
  overallRemarks: string | null;
  createdAt: string;
  updatedAt: string;
  linkedStockCheck: LinkedStockCheckSummary | null;
  linkedCashVerification: LinkedCashVerificationSummary | null;
  approvedBy: SiteAuditUserRef | null;
  approvedAt: string | null;
  checklist: SiteAuditChecklistItem[];
  checklistSummary: {
    checked: number;
    total: number;
  };
  findings: SiteAuditFinding[];
  attachments: SiteAuditAttachment[];
  approvalHistory: Array<{
    status: "created" | "completed" | "approved";
    userId: string;
    userName: string | null;
    at: string;
  }>;
}

export interface SiteAuditInput {
  auditDate: string;
  warehouseId?: string | null;
  auditorUserId: string;
  linkedStockCheckId?: string | null;
  linkedCashVerificationId?: string | null;
  finalResult: SiteAuditFinalResult;
  overallRemarks?: string | null;
  checklist: Array<{
    checklistKey: SiteAuditChecklistKey;
    isChecked: boolean;
    remarks?: string | null;
  }>;
  findings?: SiteAuditFinding[];
}

export interface SiteAuditQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: SiteAuditStatus;
  finalResult?: SiteAuditFinalResult;
  warehouseId?: string;
  auditorId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SiteAuditListResponse {
  items: SiteAuditListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SiteAuditDetailResponse {
  siteAudit: SiteAuditDetail;
}

export type SiteAuditExportResult = DownloadFileResult;
