import type { stockCheckItemStatusEnum, stockCheckStatusEnum } from "../../db/schema";
import type { ReportExportFormat } from "../reports/reports.types";

export type StockCheckStatus = (typeof stockCheckStatusEnum.enumValues)[number];
export type StockCheckItemStatus = (typeof stockCheckItemStatusEnum.enumValues)[number];
export type StockCheckExportFormat = Extract<ReportExportFormat, "pdf" | "xlsx">;

export type StockCheckActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type StockCheckRequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type StockCheckSummaryCounts = {
  totalItems: number;
  matchedItems: number;
  shortItems: number;
  excessItems: number;
};
