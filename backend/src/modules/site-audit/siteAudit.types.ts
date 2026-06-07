export type SiteAuditStatus = "draft" | "completed" | "approved" | "cancelled";
export type SiteAuditFinalResult = "passed" | "issues_found" | "needs_review";
export type SiteAuditFindingSeverity = "low" | "medium" | "high" | "critical";
export type SiteAuditFindingStatus = "open" | "resolved" | "ignored";
export type SiteAuditChecklistKey =
  | "stock_verified"
  | "cash_verified"
  | "purchase_records_verified"
  | "sales_records_verified"
  | "expense_records_verified"
  | "gst_records_verified"
  | "damaged_stock_verified"
  | "user_activity_verified";

export type SiteAuditActor = {
  id: string;
  companyId: string;
  role: "admin" | "accountant" | "staff" | "auditor";
};

export type SiteAuditRequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export const SITE_AUDIT_CHECKLIST: Array<{ key: SiteAuditChecklistKey; label: string }> = [
  { key: "stock_verified", label: "Stock Verified" },
  { key: "cash_verified", label: "Cash Verified" },
  { key: "purchase_records_verified", label: "Purchase Records Verified" },
  { key: "sales_records_verified", label: "Sales Records Verified" },
  { key: "expense_records_verified", label: "Expense Records Verified" },
  { key: "gst_records_verified", label: "GST Records Verified" },
  { key: "damaged_stock_verified", label: "Damaged Stock Verified" },
  { key: "user_activity_verified", label: "User Activity Verified" }
];
