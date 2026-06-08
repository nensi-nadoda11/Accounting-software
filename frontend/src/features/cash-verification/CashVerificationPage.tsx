import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Pencil, Plus, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AmountText } from "../../components/ui/AmountText";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Table, TableWrapper } from "../../components/ui/Table";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { cashVerificationApi } from "../../services/cashVerificationApi";
import type {
  CashVerificationDetail,
  CashVerificationExportFormat,
  CashVerificationListItem,
  CashVerificationListResponse,
  CashVerificationRecordStatus,
  CashVerificationStatus,
} from "../../types/cashVerification";
import { useDebouncedValue } from "../customers/useDebouncedValue";
import { saveDownloadedFile } from "../inventory/inventoryUtils";
import { ApproveCashVerificationModal } from "./components/ApproveCashVerificationModal";
import { CashVerificationFilters } from "./components/CashVerificationFilters";
import { CashVerificationForm } from "./components/CashVerificationForm";
import { CashVerificationSummary } from "./components/CashVerificationSummary";
import { CashVerificationTable } from "./components/CashVerificationTable";
import { StatusBadge } from "./components/StatusBadge";

const FILTER_LIMIT = 20;

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const CashVerificationPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const canView = auth.hasPermission("cash_verification.view");
  const canCreate = auth.hasPermission("cash_verification.create");
  const canApprove = auth.hasPermission("cash_verification.verify") && (auth.user?.role === "admin" || auth.user?.role === "accountant");
  const canExport = auth.hasPermission("cash_verification.export");

  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 350);
  const [status, setStatus] = useState<CashVerificationStatus | "">("");
  const [recordStatus, setRecordStatus] = useState<CashVerificationRecordStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CashVerificationListItem[]>([]);
  const [pagination, setPagination] = useState<CashVerificationListResponse["pagination"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"list" | "create" | "edit" | "view">(searchParams.get("mode") === "create" ? "create" : "list");
  const [activeDetail, setActiveDetail] = useState<CashVerificationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formDate, setFormDate] = useState(today());
  const [actualCash, setActualCash] = useState("");
  const [expectedCash, setExpectedCash] = useState("0.00");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const [approveTarget, setApproveTarget] = useState<CashVerificationDetail | null>(null);
  const [approving, setApproving] = useState(false);

  const loadList = useCallback(async () => {
    if (!canView) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await cashVerificationApi.list({
        page,
        limit: FILTER_LIMIT,
        search: search || undefined,
        status: status || undefined,
        recordStatus: recordStatus || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setItems(response.data.items);
      setPagination(response.data.pagination);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load cash verifications"));
    } finally {
      setLoading(false);
    }
  }, [canView, dateFrom, dateTo, page, recordStatus, search, status]);

  useEffect(() => {
    if (mode === "list") {
      void loadList();
    }
  }, [loadList, mode]);

  const loadExpectedCash = useCallback(async (asOfDate?: string) => {
    try {
      setBalanceLoading(true);
      const response = await cashVerificationApi.getCurrentBalance(asOfDate);
      setExpectedCash(response.data.expectedCash);
    } catch (balanceError) {
      toast.error(getErrorMessage(balanceError, "Failed to load cash ledger balance"));
    } finally {
      setBalanceLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (canView) {
      void loadExpectedCash();
    }
  }, [canView, loadExpectedCash]);

  useEffect(() => {
    if (canView && (mode === "create" || mode === "edit") && formDate) {
      void loadExpectedCash(formDate);
    }
  }, [canView, formDate, loadExpectedCash, mode]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormDate(today());
    setActualCash("");
    setExpectedCash("0.00");
    setRemarks("");
  }, []);

  const startCreate = () => {
    const defaultDate = today();
    resetForm();
    setFormDate(defaultDate);
    setActiveDetail(null);
    setMode("create");
    setSearchParams({ mode: "create" });
    void loadExpectedCash(defaultDate);
  };

  const backToList = useCallback(() => {
    setMode("list");
    setActiveDetail(null);
    resetForm();
    setSearchParams({});
    void loadList();
  }, [loadList, resetForm, setSearchParams]);

  const loadDetail = useCallback(async (cashVerificationId: string, nextMode: "view" | "edit" = "view") => {
    try {
      setDetailLoading(true);
      const response = await cashVerificationApi.get(cashVerificationId);
      const detail = response.data.cashVerification;
      setActiveDetail(detail);
      setMode(nextMode);
      setSearchParams(nextMode === "view" ? { id: cashVerificationId } : { edit: cashVerificationId });

      if (nextMode === "edit") {
        setEditingId(cashVerificationId);
        setFormDate(String(detail.verificationDate).slice(0, 10));
        setExpectedCash(detail.expectedCash);
        setActualCash(detail.actualCash);
        setRemarks(detail.remarks ?? "");
        void loadExpectedCash(String(detail.verificationDate).slice(0, 10));
      }
    } catch (detailError) {
      toast.error(getErrorMessage(detailError, "Failed to load cash verification"));
    } finally {
      setDetailLoading(false);
    }
  }, [loadExpectedCash, setSearchParams, toast]);

  useEffect(() => {
    const id = searchParams.get("id");
    const edit = searchParams.get("edit");
    if (id && mode === "list") {
      void loadDetail(id, "view");
    } else if (edit && mode === "list") {
      void loadDetail(edit, "edit");
    }
  }, [loadDetail, mode, searchParams]);

  const saveCashVerification = async () => {
    const parsedActual = Number(actualCash);
    if (!formDate) {
      toast.error("Verification date is required");
      return;
    }
    if (new Date(formDate) > new Date()) {
      toast.error("Verification date cannot be future");
      return;
    }
    if (actualCash.trim() === "") {
      toast.error("Actual cash is required");
      return;
    }
    if (!Number.isFinite(parsedActual) || parsedActual < 0) {
      toast.error("Actual cash cannot be negative");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        verificationDate: formDate,
        actualCash: parsedActual,
        remarks: remarks || null,
      };
      const response = editingId
        ? await cashVerificationApi.update(editingId, payload)
        : await cashVerificationApi.create(payload);
      toast.success(editingId ? "Cash verification updated" : "Cash verification created");
      setActiveDetail(response.data.cashVerification);
      setMode("view");
      setSearchParams({ id: response.data.cashVerification.id });
      resetForm();
    } catch (saveError) {
      toast.error(getErrorMessage(saveError, "Failed to save cash verification"));
    } finally {
      setSubmitting(false);
    }
  };

  const completeCashVerification = async (cashVerificationId: string) => {
    try {
      const response = await cashVerificationApi.complete(cashVerificationId);
      setActiveDetail(response.data.cashVerification);
      toast.success("Cash verification completed");
      await loadList();
    } catch (completeError) {
      toast.error(getErrorMessage(completeError, "Failed to complete cash verification"));
    }
  };

  const approveCashVerification = async () => {
    if (!approveTarget) {
      return;
    }

    try {
      setApproving(true);
      const response = await cashVerificationApi.approve(approveTarget.id);
      setApproveTarget(null);
      setActiveDetail(response.data.cashVerification);
      toast.success("Cash verification approved");
      await loadList();
    } catch (approveError) {
      toast.error(getErrorMessage(approveError, "Failed to approve cash verification"));
    } finally {
      setApproving(false);
    }
  };

  const exportCashVerification = async (cashVerificationId: string, format: CashVerificationExportFormat = "pdf") => {
    try {
      const file = await cashVerificationApi.exportById(cashVerificationId, format);
      saveDownloadedFile(file.blob, file.fileName);
    } catch (exportError) {
      toast.error(getErrorMessage(exportError, "Failed to export cash verification"));
    }
  };

  if (mode === "create" || mode === "edit") {
    return balanceLoading ? (
      <LoadingState label="Loading cash balance..." />
    ) : (
      <CashVerificationForm
        title={mode === "edit" ? "Edit Cash Verification" : "Create Cash Verification"}
        verificationDate={formDate}
        actualCash={actualCash}
        expectedCash={expectedCash}
        remarks={remarks}
        submitting={submitting}
        onVerificationDateChange={setFormDate}
        onActualCashChange={setActualCash}
        onRemarksChange={setRemarks}
        onCancel={backToList}
        onSubmit={() => void saveCashVerification()}
      />
    );
  }

  if (mode === "view" && activeDetail) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={activeDetail.verificationNo}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={backToList}>
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Button>
              {canCreate && activeDetail.recordStatus === "draft" ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => void loadDetail(activeDetail.id, "edit")}>
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </Button>
                  <Button type="button" onClick={() => void completeCashVerification(activeDetail.id)}>
                    <CheckCircle2 className="mr-2 size-4" />
                    Complete
                  </Button>
                </>
              ) : null}
              {canApprove && activeDetail.recordStatus === "completed" ? (
                <Button type="button" onClick={() => setApproveTarget(activeDetail)}>
                  <ShieldCheck className="mr-2 size-4" />
                  Approve
                </Button>
              ) : null}
              {canExport ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => void exportCashVerification(activeDetail.id, "pdf")}>
                    <Download className="mr-2 size-4" />
                    PDF
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void exportCashVerification(activeDetail.id, "xlsx")}>
                    <FileSpreadsheet className="mr-2 size-4" />
                    Excel
                  </Button>
                </>
              ) : null}
            </div>
          }
        />

        <Card>
          <CardContent className="grid gap-4 py-5 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Date</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(activeDetail.verificationDate)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
              <div className="mt-1"><StatusBadge status={activeDetail.status} /></div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Record</p>
              <div className="mt-1"><StatusBadge status={activeDetail.recordStatus} /></div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Verified By</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{activeDetail.verifiedBy.name ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        <CashVerificationSummary
          expectedCash={activeDetail.expectedCash}
          actualCash={activeDetail.actualCash}
          differenceAmount={activeDetail.differenceAmount}
          status={activeDetail.status}
        />

        <Card>
          <CardContent className="grid gap-4 py-5 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Approved By</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{activeDetail.approvedBy?.name ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Approval Date</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {activeDetail.approvalDate ? formatDateTime(activeDetail.approvalDate) : "-"}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Remarks</p>
              <p className="mt-1 text-sm text-slate-700">{activeDetail.remarks ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <h2 className="text-sm font-semibold text-slate-900">Approval History</h2>
            <TableWrapper className="mt-3">
              <Table>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {activeDetail.approvalHistory.map((entry) => (
                    <tr key={`${entry.status}-${entry.at}`}>
                      <td className="px-4 py-3 capitalize text-slate-900">{entry.status}</td>
                      <td className="px-4 py-3 text-slate-600">{entry.userName ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(entry.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

        <ApproveCashVerificationModal
          open={Boolean(approveTarget)}
          cashVerification={approveTarget}
          loading={approving}
          onClose={() => setApproveTarget(null)}
          onApprove={() => void approveCashVerification()}
        />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title="Cash Verification"
          actions={
            canCreate ? (
              <Button type="button" onClick={startCreate}>
                <Plus className="mr-2 size-4" />
                Create
              </Button>
            ) : null
          }
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <CashVerificationFilters
            search={searchInput}
            status={status}
            recordStatus={recordStatus}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onSearchChange={(value) => {
              setSearchInput(value);
              setPage(1);
            }}
            onStatusChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            onRecordStatusChange={(value) => {
              setRecordStatus(value);
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
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Expected Cash</p>
              <AmountText value={expectedCash} className="mt-2 block text-lg" />
              <Button type="button" variant="secondary" className="mt-4 w-full" onClick={() => void loadExpectedCash()} loading={balanceLoading}>
                Refresh
              </Button>
            </CardContent>
          </Card>
        </div>

        <CashVerificationTable
          items={items}
          pagination={pagination}
          loading={loading || detailLoading}
          error={error}
          canCreate={canCreate}
          canApprove={canApprove}
          canExport={canExport}
          onView={(item) => void loadDetail(item.id, "view")}
          onEdit={(item) => void loadDetail(item.id, "edit")}
          onApprove={async (item) => {
            const response = await cashVerificationApi.get(item.id);
            setApproveTarget(response.data.cashVerification);
          }}
          onExport={(item) => void exportCashVerification(item.id, "pdf")}
          onPageChange={setPage}
        />
      </div>

      <ApproveCashVerificationModal
        open={Boolean(approveTarget)}
        cashVerification={approveTarget}
        loading={approving}
        onClose={() => setApproveTarget(null)}
        onApprove={() => void approveCashVerification()}
      />
    </>
  );
};
