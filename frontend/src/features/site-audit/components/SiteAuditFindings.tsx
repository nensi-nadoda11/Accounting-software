import { Plus, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import { Textarea } from "../../../components/ui/Textarea";
import type { SiteAuditFinding, SiteAuditFindingSeverity, SiteAuditFindingStatus } from "../../../types/siteAudit";
import { StatusBadge } from "./StatusBadge";

const blankFinding = (): SiteAuditFinding => ({
  findingTitle: "",
  findingDescription: "",
  severity: "medium",
  status: "open",
  relatedModule: "",
  relatedReferenceId: null,
});

export const SiteAuditFindings = ({
  findings,
  editable,
  onChange,
}: {
  findings: SiteAuditFinding[];
  editable: boolean;
  onChange: (findings: SiteAuditFinding[]) => void;
}) => {
  if (!editable) {
    return (
      <TableWrapper>
        <Table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Related</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {findings.length ? findings.map((finding, index) => (
              <tr key={finding.id ?? index}>
                <td className="font-medium text-slate-900">{finding.findingTitle}</td>
                <td><StatusBadge status={finding.severity} /></td>
                <td><StatusBadge status={finding.status} /></td>
                <td>{finding.relatedModule || "-"}</td>
                <td>{finding.findingDescription || "-"}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">No findings</td>
              </tr>
            )}
          </tbody>
        </Table>
      </TableWrapper>
    );
  }

  const update = (index: number, patch: Partial<SiteAuditFinding>) =>
    onChange(findings.map((finding, findingIndex) => (findingIndex === index ? { ...finding, ...patch } : finding)));

  return (
    <div className="space-y-3">
      {findings.map((finding, index) => (
        <div key={finding.id ?? index} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-4">
          <Input
            label="Finding title"
            value={finding.findingTitle}
            onChange={(event) => update(index, { findingTitle: event.target.value })}
            required
          />
          <Select
            label="Severity"
            value={finding.severity}
            onChange={(event) => update(index, { severity: event.target.value as SiteAuditFindingSeverity })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
          <Select
            label="Status"
            value={finding.status}
            onChange={(event) => update(index, { status: event.target.value as SiteAuditFindingStatus })}
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </Select>
          <Input
            label="Related module"
            value={finding.relatedModule ?? ""}
            onChange={(event) => update(index, { relatedModule: event.target.value })}
          />
          <Textarea
            className="md:col-span-4"
            label="Description"
            value={finding.findingDescription ?? ""}
            rows={2}
            onChange={(event) => update(index, { findingDescription: event.target.value })}
          />
          <div className="md:col-span-4 flex justify-end">
            <TableActionIconButton
              label="Remove finding"
              tone="danger"
              icon={<Trash2 className="size-4" />}
              onClick={() => onChange(findings.filter((_, findingIndex) => findingIndex !== index))}
            />
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => onChange([...findings, blankFinding()])}>
        <Plus className="mr-2 size-4" />
        Add Finding
      </Button>
    </div>
  );
};
