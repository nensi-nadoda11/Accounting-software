import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/ui/PageHeader";
import type { SearchableSelectOption } from "../../components/ui/SearchableSelect";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { cashVerificationApi } from "../../services/cashVerificationApi";
import { inventoryApi } from "../../services/inventoryApi";
import { siteAuditApi } from "../../services/siteAuditApi";
import { stockCheckApi } from "../../services/stockCheckApi";
import { usersApi } from "../../services/usersApi";
import type {
  SiteAuditAttachment,
  SiteAuditChecklistItem,
  SiteAuditChecklistKey,
  SiteAuditDetail,
  SiteAuditFinalResult,
  SiteAuditFinding,
  SiteAuditListItem,
  SiteAuditListResponse,
  SiteAuditStatus,
} from "../../types/siteAudit";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { saveDownloadedFile } from "../inventory/inventoryUtils";
import { ApproveSiteAuditModal } from "./components/ApproveSiteAuditModal";
import { SiteAuditDetailDrawer } from "./components/SiteAuditDetailDrawer";
import { SiteAuditFilters } from "./components/SiteAuditFilters";
import { SiteAuditForm } from "./components/SiteAuditForm";
import { SiteAuditTable } from "./components/SiteAuditTable";

const FILTER_LIMIT = 20;
const OPTION_LIMIT = 50;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

const checklistLabels: Array<{ checklistKey: SiteAuditChecklistKey; checklistLabel: string }> = [
  { checklistKey: "stock_verified", checklistLabel: "Stock Verified" },
  { checklistKey: "cash_verified", checklistLabel: "Cash Verified" },
  { checklistKey: "purchase_records_verified", checklistLabel: "Purchase Records Verified" },
  { checklistKey: "sales_records_verified", checklistLabel: "Sales Records Verified" },
  { checklistKey: "expense_records_verified", checklistLabel: "Expense Records Verified" },
  { checklistKey: "gst_records_verified", checklistLabel: "GST Records Verified" },
  { checklistKey: "damaged_stock_verified", checklistLabel: "Damaged Stock Verified" },
  { checklistKey: "user_activity_verified", checklistLabel: "User Activity Verified" },
];

const today = () => new Date().toISOString().slice(0, 10);

const buildChecklist = (): SiteAuditChecklistItem[] =>
  checklistLabels.map((item) => ({
    ...item,
    isChecked: false,
    remarks: "",
  }));

const toOption = (id: string, label: string | null | undefined, description?: string | null): SearchableSelectOption => ({
  value: id,
  label: label || "-",
  description,
});

export const SiteAuditPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const canView = auth.hasPermission("site_audit.view");
  const canCreate = auth.hasPermission("site_audit.create");
  const canUpdate = auth.hasPermission("site_audit.update");
  const canApprove = auth.hasPermission("site_audit.approve");
  const canExport = auth.hasPermission("site_audit.export");

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 350);
  const [status, setStatus] = useState<SiteAuditStatus | "">("");
  const [finalResultFilter, setFinalResultFilter] = useState<SiteAuditFinalResult | "">("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [auditorFilter, setAuditorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SiteAuditListItem[]>([]);
  const [pagination, setPagination] = useState<SiteAuditListResponse["pagination"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"list" | "create" | "edit" | "view">(searchParams.get("mode") === "create" ? "create" : "list");
  const [activeDetail, setActiveDetail] = useState<SiteAuditDetail | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [approveTarget, setApproveTarget] = useState<SiteAuditDetail | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SiteAuditDetail | null>(null);

  const [warehouseOptions, setWarehouseOptions] = useState<SearchableSelectOption[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<SearchableSelectOption[]>([]);
  const [stockCheckOptions, setStockCheckOptions] = useState<SearchableSelectOption[]>([]);
  const [cashVerificationOptions, setCashVerificationOptions] = useState<SearchableSelectOption[]>([]);

  const [auditDate, setAuditDate] = useState(today());
  const [warehouseId, setWarehouseId] = useState("");
  const [auditorUserId, setAuditorUserId] = useState(auth.user?.id ?? "");
  const [linkedStockCheckId, setLinkedStockCheckId] = useState("");
  const [linkedCashVerificationId, setLinkedCashVerificationId] = useState("");
  const [overallRemarks, setOverallRemarks] = useState("");
  const [finalResult, setFinalResult] = useState<SiteAuditFinalResult>("needs_review");
  const [checklist, setChecklist] = useState<SiteAuditChecklistItem[]>(buildChecklist);
  const [findings, setFindings] = useState<SiteAuditFinding[]>([]);
  const [attachments, setAttachments] = useState<SiteAuditAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadOptions = useCallback(async () => {
    try {
      const [warehouses, users, stockChecks, cashVerifications] = await Promise.all([
        inventoryApi.listWarehouses({ page: 1, limit: OPTION_LIMIT, status: "active" }),
        usersApi.list({ page: 1, limit: OPTION_LIMIT, status: "active" }),
        stockCheckApi.list({ page: 1, limit: OPTION_LIMIT, status: "approved" }),
        cashVerificationApi.list({ page: 1, limit: OPTION_LIMIT, recordStatus: "approved" }),
      ]);

      setWarehouseOptions(warehouses.data.items.map((warehouse) => toOption(warehouse.id, warehouse.name, warehouse.warehouseCode)));
      setAuditorOptions(users.data.items.map((user) => toOption(user.id, user.fullName, user.role)));
      setStockCheckOptions(stockChecks.data.items.map((item) => toOption(item.id, item.checkNo, item.warehouse.name ?? item.status)));
      setCashVerificationOptions(cashVerifications.data.items.map((item) => toOption(item.id, item.verificationNo, item.recordStatus)));
    } catch (optionError) {
      toast.error(getErrorMessage(optionError, "Failed to load audit options"));
    }
  }, [toast]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const loadList = useCallback(async () => {
    if (!canView) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await siteAuditApi.list({
        page,
        limit: FILTER_LIMIT,
        search: search || undefined,
        status: status || undefined,
        finalResult: finalResultFilter || undefined,
        warehouseId: warehouseFilter || undefined,
        auditorId: auditorFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setItems(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load site audits"));
    } finally {
      setLoading(false);
    }
  }, [auditorFilter, canView, dateFrom, dateTo, finalResultFilter, page, search, status, warehouseFilter]);

  useEffect(() => {
    if (mode === "list") {
      void loadList();
    }
  }, [loadList, mode]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setAuditDate(today());
    setWarehouseId("");
    setAuditorUserId(auth.user?.id ?? "");
    setLinkedStockCheckId("");
    setLinkedCashVerificationId("");
    setOverallRemarks("");
    setFinalResult("needs_review");
    setChecklist(buildChecklist());
    setFindings([]);
    setAttachments([]);
  }, [auth.user?.id]);

  const fillFormFromDetail = (detail: SiteAuditDetail) => {
    setEditingId(detail.id);
    setAuditDate(String(detail.auditDate).slice(0, 10));
    setWarehouseId(detail.warehouse?.id ?? "");
    setAuditorUserId(detail.auditor.id);
    setLinkedStockCheckId(detail.linkedStockCheck?.id ?? "");
    setLinkedCashVerificationId(detail.linkedCashVerification?.id ?? "");
    setOverallRemarks(detail.overallRemarks ?? "");
    setFinalResult(detail.finalResult);
    setChecklist(detail.checklist);
    setFindings(detail.findings);
    setAttachments(detail.attachments);
  };

  const loadDetail = useCallback(async (siteAuditId: string, nextMode: "view" | "edit" = "view") => {
    try {
      setDetailLoading(true);
      const response = await siteAuditApi.get(siteAuditId);
      const detail = response.data.siteAudit;
      setActiveDetail(detail);
      setMode(nextMode);
      setSearchParams(nextMode === "view" ? { id: siteAuditId } : { edit: siteAuditId });
      if (nextMode === "edit") {
        fillFormFromDetail(detail);
      }
    } catch (detailError) {
      toast.error(getErrorMessage(detailError, "Failed to load site audit"));
    } finally {
      setDetailLoading(false);
    }
  }, [setSearchParams, toast]);

  useEffect(() => {
    const id = searchParams.get("id");
    const edit = searchParams.get("edit");
    if (id && mode === "list") {
      void loadDetail(id, "view");
    } else if (edit && mode === "list") {
      void loadDetail(edit, "edit");
    }
  }, [loadDetail, mode, searchParams]);

  const startCreate = () => {
    resetForm();
    setActiveDetail(null);
    setMode("create");
    setSearchParams({ mode: "create" });
  };

  const backToList = useCallback(() => {
    setMode("list");
    setActiveDetail(null);
    resetForm();
    setSearchParams({});
    void loadList();
  }, [loadList, resetForm, setSearchParams]);

  const validateForm = (requireChecklist: boolean) => {
    if (!auditDate) {
      toast.error("Audit date is required");
      return false;
    }
    if (new Date(auditDate) > new Date()) {
      toast.error("Audit date cannot be future");
      return false;
    }
    if (!auditorUserId) {
      toast.error("Auditor is required");
      return false;
    }
    if (requireChecklist && !checklist.some((item) => item.isChecked)) {
      toast.error("At least one checklist item should be checked before complete");
      return false;
    }
    if (findings.some((finding) => !finding.findingTitle.trim())) {
      toast.error("Finding title is required");
      return false;
    }
    return true;
  };

  const syncFindings = async (siteAuditId: string, draftFindings: SiteAuditFinding[]) => {
    for (const finding of draftFindings) {
      const payload = {
        ...finding,
        findingDescription: finding.findingDescription || null,
        relatedModule: finding.relatedModule || null,
        relatedReferenceId: finding.relatedReferenceId || null,
      };
      if (finding.id) {
        await siteAuditApi.updateFinding(siteAuditId, finding.id, payload);
      } else if (finding.findingTitle.trim()) {
        await siteAuditApi.addFinding(siteAuditId, payload);
      }
    }
  };

  const saveSiteAudit = async (completeAfterSave = false) => {
    if (!validateForm(completeAfterSave)) {
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        auditDate,
        warehouseId: warehouseId || null,
        auditorUserId,
        linkedStockCheckId: linkedStockCheckId || null,
        linkedCashVerificationId: linkedCashVerificationId || null,
        finalResult,
        overallRemarks: overallRemarks || null,
        checklist: checklist.map((item) => ({
          checklistKey: item.checklistKey,
          isChecked: item.isChecked,
          remarks: item.remarks || null,
        })),
        findings: editingId ? undefined : findings,
      };

      const response = editingId ? await siteAuditApi.update(editingId, payload) : await siteAuditApi.create(payload);
      const savedId = response.data.siteAudit.id;
      if (editingId) {
        await syncFindings(savedId, findings);
      }
      const completed = completeAfterSave ? await siteAuditApi.complete(savedId, finalResult) : await siteAuditApi.get(savedId);
      setActiveDetail(completed.data.siteAudit);
      setMode("view");
      setSearchParams({ id: savedId });
      toast.success(completeAfterSave ? "Site audit completed" : editingId ? "Site audit updated" : "Site audit created");
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, "Failed to save site audit"));
    } finally {
      setSubmitting(false);
    }
  };

  const completeSiteAudit = async (siteAudit: SiteAuditListItem | SiteAuditDetail) => {
    try {
      const response = await siteAuditApi.complete(siteAudit.id, siteAudit.finalResult);
      setActiveDetail(response.data.siteAudit);
      toast.success("Site audit completed");
      await loadList();
    } catch (completeError) {
      toast.error(getErrorMessage(completeError, "Failed to complete site audit"));
    }
  };

  const approveSiteAudit = async () => {
    if (!approveTarget) {
      return;
    }

    try {
      setApproving(true);
      const response = await siteAuditApi.approve(approveTarget.id);
      setApproveTarget(null);
      setActiveDetail(response.data.siteAudit);
      toast.success("Site audit approved");
      await loadList();
    } catch (approveError) {
      toast.error(getErrorMessage(approveError, "Failed to approve site audit"));
    } finally {
      setApproving(false);
    }
  };

  const cancelSiteAudit = async () => {
    if (!cancelTarget) {
      return;
    }

    try {
      setCancelling(true);
      const response = await siteAuditApi.cancel(cancelTarget.id);
      setCancelTarget(null);
      setActiveDetail(response.data.siteAudit);
      toast.success("Site audit cancelled");
      await loadList();
    } catch (cancelError) {
      toast.error(getErrorMessage(cancelError, "Failed to cancel site audit"));
    } finally {
      setCancelling(false);
    }
  };

  const exportSiteAudit = async (siteAuditId: string, format: "pdf" | "csv" = "pdf") => {
    try {
      const file = await siteAuditApi.exportById(siteAuditId, format);
      saveDownloadedFile(file.blob, file.fileName);
    } catch (exportError) {
      toast.error(getErrorMessage(exportError, "Failed to export site audit"));
    }
  };

  const uploadAttachments = async (files: File[]) => {
    if (!activeDetail && !editingId) {
      return;
    }

    const invalid = files.find((file) => !ALLOWED_ATTACHMENT_TYPES.has(file.type) || file.size > MAX_ATTACHMENT_BYTES);
    if (invalid) {
      toast.error("Only jpg, jpeg, png, webp, and pdf files up to 5MB are allowed");
      return;
    }

    const siteAuditId = activeDetail?.id ?? editingId;
    if (!siteAuditId) {
      return;
    }

    try {
      setUploading(true);
      const response = await siteAuditApi.uploadAttachments(siteAuditId, files);
      setActiveDetail(response.data.siteAudit);
      setAttachments(response.data.siteAudit.attachments);
      toast.success("Attachment uploaded");
    } catch (uploadError) {
      toast.error(getErrorMessage(uploadError, "Failed to upload attachment"));
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = async (attachmentId: string) => {
    const siteAuditId = activeDetail?.id ?? editingId;
    if (!siteAuditId) {
      return;
    }

    try {
      const response = await siteAuditApi.deleteAttachment(siteAuditId, attachmentId);
      setActiveDetail(response.data.siteAudit);
      setAttachments(response.data.siteAudit.attachments);
      toast.success("Attachment removed");
    } catch (removeError) {
      toast.error(getErrorMessage(removeError, "Failed to remove attachment"));
    }
  };

  if (mode === "create" || mode === "edit") {
    return (
      <SiteAuditForm
        title={mode === "edit" ? "Edit Site Audit" : "Create Site Audit"}
        auditDate={auditDate}
        warehouseId={warehouseId}
        auditorUserId={auditorUserId}
        linkedStockCheckId={linkedStockCheckId}
        linkedCashVerificationId={linkedCashVerificationId}
        overallRemarks={overallRemarks}
        finalResult={finalResult}
        checklist={checklist}
        findings={findings}
        attachments={attachments}
        submitting={submitting}
        uploading={uploading}
        warehouseOptions={warehouseOptions}
        auditorOptions={auditorOptions}
        stockCheckOptions={stockCheckOptions}
        cashVerificationOptions={cashVerificationOptions}
        canComplete
        onAuditDateChange={setAuditDate}
        onWarehouseChange={setWarehouseId}
        onAuditorChange={setAuditorUserId}
        onLinkedStockCheckChange={setLinkedStockCheckId}
        onLinkedCashVerificationChange={setLinkedCashVerificationId}
        onOverallRemarksChange={setOverallRemarks}
        onFinalResultChange={setFinalResult}
        onChecklistChange={setChecklist}
        onFindingsChange={setFindings}
        onUploadAttachments={editingId ? (files) => void uploadAttachments(files) : undefined}
        onRemoveAttachment={editingId ? (attachment) => void removeAttachment(attachment.id) : undefined}
        onCancel={backToList}
        onSubmit={() => void saveSiteAudit(false)}
        onComplete={() => void saveSiteAudit(true)}
      />
    );
  }

  if (mode === "view" && activeDetail) {
    return (
      <>
        <SiteAuditDetailDrawer
          siteAudit={activeDetail}
          canUpdate={canUpdate}
          canApprove={canApprove}
          canExport={canExport}
          uploading={uploading}
          onBack={backToList}
          onEdit={() => {
            fillFormFromDetail(activeDetail);
            setMode("edit");
            setSearchParams({ edit: activeDetail.id });
          }}
          onComplete={() => void completeSiteAudit(activeDetail)}
          onApprove={() => setApproveTarget(activeDetail)}
          onCancelAudit={() => setCancelTarget(activeDetail)}
          onExport={(format) => void exportSiteAudit(activeDetail.id, format)}
          onUploadAttachments={(files) => void uploadAttachments(files)}
          onRemoveAttachment={(attachmentId) => void removeAttachment(attachmentId)}
        />
        <ApproveSiteAuditModal
          open={Boolean(approveTarget)}
          siteAudit={approveTarget}
          loading={approving}
          onClose={() => setApproveTarget(null)}
          onApprove={() => void approveSiteAudit()}
        />
        <ConfirmDialog
          open={Boolean(cancelTarget)}
          title="Cancel Site Audit"
          description="This audit will move to cancelled status."
          loading={cancelling}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => void cancelSiteAudit()}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title="Site Audit"
          actions={
            canCreate ? (
              <Button type="button" onClick={startCreate}>
                <Plus className="mr-2 size-4" />
                Create
              </Button>
            ) : null
          }
        />
        <SiteAuditFilters
          search={searchInput}
          status={status}
          finalResult={finalResultFilter}
          warehouseId={warehouseFilter}
          auditorId={auditorFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          warehouseOptions={warehouseOptions}
          auditorOptions={auditorOptions}
          onSearchChange={(value) => {
            setSearchInput(value);
            setPage(1);
          }}
          onStatusChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          onFinalResultChange={(value) => {
            setFinalResultFilter(value);
            setPage(1);
          }}
          onWarehouseChange={(value) => {
            setWarehouseFilter(value);
            setPage(1);
          }}
          onAuditorChange={(value) => {
            setAuditorFilter(value);
            setPage(1);
          }}
          onDateFromChange={(value) => {
            setDateFrom(value);
            setPage(1);
          }}
          onDateToChange={(value) => {
            setDateTo(value);
            setPage(1);
          }}
        />
        <SiteAuditTable
          items={items}
          pagination={pagination}
          loading={loading || detailLoading}
          error={error}
          canUpdate={canUpdate}
          canApprove={canApprove}
          canExport={canExport}
          onView={(item) => void loadDetail(item.id, "view")}
          onEdit={(item) => void loadDetail(item.id, "edit")}
          onComplete={(item) => void completeSiteAudit(item)}
          onApprove={async (item) => {
            const response = await siteAuditApi.get(item.id);
            setApproveTarget(response.data.siteAudit);
          }}
          onExport={(item) => void exportSiteAudit(item.id, "pdf")}
          onPageChange={setPage}
        />
      </div>
      <ApproveSiteAuditModal
        open={Boolean(approveTarget)}
        siteAudit={approveTarget}
        loading={approving}
        onClose={() => setApproveTarget(null)}
        onApprove={() => void approveSiteAudit()}
      />
    </>
  );
};
