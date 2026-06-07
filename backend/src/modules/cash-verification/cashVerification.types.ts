import type { cashVerificationRecordStatusEnum, cashVerificationStatusEnum } from "../../db/schema";
import type { ReportExportFormat } from "../reports/reports.types";

export type CashVerificationStatus = (typeof cashVerificationStatusEnum.enumValues)[number];
export type CashVerificationRecordStatus = (typeof cashVerificationRecordStatusEnum.enumValues)[number];
export type CashVerificationExportFormat = Extract<ReportExportFormat, "pdf" | "xlsx">;

export type CashVerificationActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type CashVerificationRequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};
