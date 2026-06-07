import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import type { SiteAuditDetail } from "../../../types/siteAudit";
import { StatusBadge } from "./StatusBadge";

export const ApproveSiteAuditModal = ({
  open,
  siteAudit,
  loading,
  onClose,
  onApprove,
}: {
  open: boolean;
  siteAudit: SiteAuditDetail | null;
  loading?: boolean;
  onClose: () => void;
  onApprove: () => void;
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Approve Site Audit"
    footer={
      <>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="button" loading={loading} onClick={onApprove}>Confirm Approve</Button>
      </>
    }
  >
    {siteAudit ? (
      <div className="grid gap-4 text-sm md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Audit No</p>
          <p className="mt-1 font-medium text-slate-900">{siteAudit.auditNo}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Final Result</p>
          <div className="mt-1"><StatusBadge status={siteAudit.finalResult} /></div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Findings</p>
          <p className="mt-1 font-medium text-slate-900">{siteAudit.findings.length}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Critical Findings</p>
          <p className="mt-1 font-medium text-rose-700">{siteAudit.findings.filter((finding) => finding.severity === "critical").length}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Stock Check Status</p>
          <p className="mt-1 font-medium text-slate-900">{siteAudit.linkedStockCheck?.status ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Cash Verification Status</p>
          <p className="mt-1 font-medium text-slate-900">{siteAudit.linkedCashVerification?.recordStatus ?? "-"}</p>
        </div>
      </div>
    ) : null}
  </Modal>
);
