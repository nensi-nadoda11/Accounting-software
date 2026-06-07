import { ArrowLeft, CheckCircle2, Download, FileText, Pencil, ShieldCheck, XCircle } from "lucide-react";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import type { SiteAuditDetail } from "../../../types/siteAudit";
import { SiteAuditAttachmentUploader } from "./SiteAuditAttachmentUploader";
import { SiteAuditChecklist } from "./SiteAuditChecklist";
import { SiteAuditFindings } from "./SiteAuditFindings";
import { StatusBadge } from "./StatusBadge";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatDateTime = (value: string) => new Date(value).toLocaleString("en-IN");

export const SiteAuditDetailDrawer = ({
  siteAudit,
  canUpdate,
  canApprove,
  canExport,
  uploading,
  onBack,
  onEdit,
  onComplete,
  onApprove,
  onCancelAudit,
  onExport,
  onUploadAttachments,
  onRemoveAttachment,
}: {
  siteAudit: SiteAuditDetail;
  canUpdate: boolean;
  canApprove: boolean;
  canExport: boolean;
  uploading?: boolean;
  onBack: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onApprove: () => void;
  onCancelAudit: () => void;
  onExport: (format: "pdf" | "csv") => void;
  onUploadAttachments: (files: File[]) => void;
  onRemoveAttachment: (attachmentId: string) => void;
}) => (
  <div className="space-y-4">
    <PageHeader
      title={siteAudit.auditNo}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
          {canUpdate && (siteAudit.status === "draft" || siteAudit.status === "completed") ? (
            <Button type="button" variant="secondary" onClick={onEdit}>
              <Pencil className="mr-2 size-4" />
              Edit
            </Button>
          ) : null}
          {canUpdate && siteAudit.status === "draft" ? (
            <Button type="button" onClick={onComplete}>
              <CheckCircle2 className="mr-2 size-4" />
              Complete
            </Button>
          ) : null}
          {canApprove && siteAudit.status === "completed" ? (
            <Button type="button" onClick={onApprove}>
              <ShieldCheck className="mr-2 size-4" />
              Approve
            </Button>
          ) : null}
          {canUpdate && siteAudit.status !== "approved" && siteAudit.status !== "cancelled" ? (
            <Button type="button" variant="danger" onClick={onCancelAudit}>
              <XCircle className="mr-2 size-4" />
              Cancel
            </Button>
          ) : null}
          {canExport ? (
            <>
              <Button type="button" variant="secondary" onClick={() => onExport("pdf")}>
                <Download className="mr-2 size-4" />
                PDF
              </Button>
              <Button type="button" variant="secondary" onClick={() => onExport("csv")}>
                <FileText className="mr-2 size-4" />
                CSV
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
          <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(siteAudit.auditDate)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Warehouse</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{siteAudit.warehouse?.name ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
          <div className="mt-1"><StatusBadge status={siteAudit.status} /></div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Final Result</p>
          <div className="mt-1"><StatusBadge status={siteAudit.finalResult} /></div>
        </div>
      </CardContent>
    </Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-3 py-5">
          <h2 className="text-sm font-semibold text-slate-900">Linked Stock Check</h2>
          <p className="text-sm font-medium text-slate-900">{siteAudit.linkedStockCheck?.checkNo ?? "-"}</p>
          <div className="grid grid-cols-4 gap-2 text-sm">
            <span>Total {siteAudit.linkedStockCheck?.summary.totalItems ?? 0}</span>
            <span>Matched {siteAudit.linkedStockCheck?.summary.matchedItems ?? 0}</span>
            <span>Short {siteAudit.linkedStockCheck?.summary.shortItems ?? 0}</span>
            <span>Excess {siteAudit.linkedStockCheck?.summary.excessItems ?? 0}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 py-5">
          <h2 className="text-sm font-semibold text-slate-900">Linked Cash Verification</h2>
          <p className="text-sm font-medium text-slate-900">{siteAudit.linkedCashVerification?.verificationNo ?? "-"}</p>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <AmountText value={siteAudit.linkedCashVerification?.expectedCash ?? "0.00"} />
            <AmountText value={siteAudit.linkedCashVerification?.actualCash ?? "0.00"} />
            <AmountText value={siteAudit.linkedCashVerification?.differenceAmount ?? "0.00"} />
          </div>
        </CardContent>
      </Card>
    </div>
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">Checklist</h2>
      <SiteAuditChecklist items={siteAudit.checklist} editable={false} onToggle={() => undefined} onRemarksChange={() => undefined} />
    </section>
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">Findings</h2>
      <SiteAuditFindings findings={siteAudit.findings} editable={false} onChange={() => undefined} />
    </section>
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-900">Attachments</h2>
      <SiteAuditAttachmentUploader
        attachments={siteAudit.attachments}
        editable={canUpdate && siteAudit.status !== "approved" && siteAudit.status !== "cancelled"}
        uploading={uploading}
        onUpload={onUploadAttachments}
        onRemove={(attachment) => onRemoveAttachment(attachment.id)}
      />
    </section>
    <Card>
      <CardContent className="grid gap-4 py-5 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Approved By</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{siteAudit.approvedBy?.name ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Approved At</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{siteAudit.approvedAt ? formatDateTime(siteAudit.approvedAt) : "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Auditor</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{siteAudit.auditor.name ?? "-"}</p>
        </div>
      </CardContent>
    </Card>
  </div>
);
