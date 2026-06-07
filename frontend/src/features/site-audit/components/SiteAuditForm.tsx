import { ArrowLeft, CheckCircle2, Save, XCircle } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SearchableSelect, type SearchableSelectOption } from "../../../components/ui/SearchableSelect";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import type { SiteAuditAttachment, SiteAuditChecklistItem, SiteAuditFinalResult, SiteAuditFinding } from "../../../types/siteAudit";
import { SiteAuditAttachmentUploader } from "./SiteAuditAttachmentUploader";
import { SiteAuditChecklist } from "./SiteAuditChecklist";
import { SiteAuditFindings } from "./SiteAuditFindings";

export const SiteAuditForm = ({
  title,
  auditDate,
  warehouseId,
  auditorUserId,
  linkedStockCheckId,
  linkedCashVerificationId,
  overallRemarks,
  finalResult,
  checklist,
  findings,
  attachments,
  submitting,
  uploading,
  warehouseOptions,
  auditorOptions,
  stockCheckOptions,
  cashVerificationOptions,
  canComplete,
  onAuditDateChange,
  onWarehouseChange,
  onAuditorChange,
  onLinkedStockCheckChange,
  onLinkedCashVerificationChange,
  onOverallRemarksChange,
  onFinalResultChange,
  onChecklistChange,
  onFindingsChange,
  onUploadAttachments,
  onRemoveAttachment,
  onCancel,
  onSubmit,
  onComplete,
}: {
  title: string;
  auditDate: string;
  warehouseId: string;
  auditorUserId: string;
  linkedStockCheckId: string;
  linkedCashVerificationId: string;
  overallRemarks: string;
  finalResult: SiteAuditFinalResult;
  checklist: SiteAuditChecklistItem[];
  findings: SiteAuditFinding[];
  attachments: SiteAuditAttachment[];
  submitting: boolean;
  uploading?: boolean;
  warehouseOptions: SearchableSelectOption[];
  auditorOptions: SearchableSelectOption[];
  stockCheckOptions: SearchableSelectOption[];
  cashVerificationOptions: SearchableSelectOption[];
  canComplete: boolean;
  onAuditDateChange: (value: string) => void;
  onWarehouseChange: (value: string) => void;
  onAuditorChange: (value: string) => void;
  onLinkedStockCheckChange: (value: string) => void;
  onLinkedCashVerificationChange: (value: string) => void;
  onOverallRemarksChange: (value: string) => void;
  onFinalResultChange: (value: SiteAuditFinalResult) => void;
  onChecklistChange: (items: SiteAuditChecklistItem[]) => void;
  onFindingsChange: (findings: SiteAuditFinding[]) => void;
  onUploadAttachments?: (files: File[]) => void;
  onRemoveAttachment?: (attachment: SiteAuditAttachment) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onComplete: () => void;
}) => {
  const updateChecklist = (key: SiteAuditChecklistItem["checklistKey"], patch: Partial<SiteAuditChecklistItem>) =>
    onChecklistChange(checklist.map((item) => (item.checklistKey === key ? { ...item, ...patch } : item)));

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onCancel}>
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Button>
            <Button type="button" variant="secondary" loading={submitting} onClick={onSubmit}>
              <Save className="mr-2 size-4" />
              Save Draft
            </Button>
            {canComplete ? (
              <Button type="button" loading={submitting} onClick={onComplete}>
                <CheckCircle2 className="mr-2 size-4" />
                Complete Audit
              </Button>
            ) : null}
            <Button type="button" variant="danger" onClick={onCancel}>
              <XCircle className="mr-2 size-4" />
              Cancel
            </Button>
          </div>
        }
      />
      <Card>
        <CardContent className="grid gap-4 py-5 md:grid-cols-3">
          <Input label="Audit Date" type="date" value={auditDate} required onChange={(event) => onAuditDateChange(event.target.value)} />
          <SearchableSelect label="Warehouse" value={warehouseId} options={warehouseOptions} onChange={onWarehouseChange} allowClear />
          <SearchableSelect label="Auditor" required value={auditorUserId} options={auditorOptions} onChange={onAuditorChange} />
          <SearchableSelect
            label="Linked Stock Check"
            value={linkedStockCheckId}
            options={stockCheckOptions}
            onChange={onLinkedStockCheckChange}
            allowClear
          />
          <SearchableSelect
            label="Linked Cash Verification"
            value={linkedCashVerificationId}
            options={cashVerificationOptions}
            onChange={onLinkedCashVerificationChange}
            allowClear
          />
          <Select label="Final Result" value={finalResult} onChange={(event) => onFinalResultChange(event.target.value as SiteAuditFinalResult)}>
            <option value="passed">Passed</option>
            <option value="issues_found">Issues Found</option>
            <option value="needs_review">Needs Review</option>
          </Select>
          <Textarea
            className="md:col-span-3"
            label="Overall Remarks"
            value={overallRemarks}
            onChange={(event) => onOverallRemarksChange(event.target.value)}
          />
        </CardContent>
      </Card>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Checklist</h2>
        <SiteAuditChecklist
          items={checklist}
          editable
          onToggle={(key, checked) => updateChecklist(key, { isChecked: checked })}
          onRemarksChange={(key, value) => updateChecklist(key, { remarks: value })}
        />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Findings</h2>
        <SiteAuditFindings findings={findings} editable onChange={onFindingsChange} />
      </section>
      {onUploadAttachments && onRemoveAttachment ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Attachments</h2>
          <SiteAuditAttachmentUploader
            attachments={attachments}
            editable
            uploading={uploading}
            onUpload={onUploadAttachments}
            onRemove={onRemoveAttachment}
          />
        </section>
      ) : null}
    </div>
  );
};
