import type { DownloadFileResult } from "./product";

export type CashVerificationStatus = "matched" | "short_cash" | "excess_cash";
export type CashVerificationRecordStatus = "draft" | "completed" | "approved" | "cancelled";
export type CashVerificationExportFormat = "pdf" | "xlsx";

export interface CashVerificationUserRef {
  id: string;
  name: string | null;
}

export interface CashLedgerBalance {
  accountId: string;
  accountCode: string;
  accountName: string;
  normalBalance: "debit" | "credit";
  balance: string;
  storedBalance: string;
}

export interface CashVerificationListItem {
  id: string;
  verificationNo: string;
  verificationDate: string;
  expectedCash: string;
  actualCash: string;
  differenceAmount: string;
  status: CashVerificationStatus;
  remarks: string | null;
  recordStatus: CashVerificationRecordStatus;
  verifiedBy: CashVerificationUserRef;
  approvedBy: CashVerificationUserRef | null;
  approvalDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CashVerificationDetail extends CashVerificationListItem {
  approvalHistory: Array<{
    status: "created" | "completed" | "approved";
    userId: string;
    userName: string | null;
    at: string;
  }>;
}

export interface CashVerificationInput {
  verificationDate: string;
  actualCash: number;
  remarks?: string | null;
}

export interface CashVerificationQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: CashVerificationStatus;
  recordStatus?: CashVerificationRecordStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface CashVerificationListResponse {
  items: CashVerificationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CashVerificationDetailResponse {
  cashVerification: CashVerificationDetail;
}

export interface CashVerificationCurrentBalanceResponse {
  expectedCash: string;
  asOfDate: string | null;
  currentCashLedger: CashLedgerBalance;
  lastVerification: CashVerificationListItem | null;
}

export type CashVerificationExportResult = DownloadFileResult;
