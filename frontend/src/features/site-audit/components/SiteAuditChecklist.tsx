import { Checkbox } from "../../../components/ui/Checkbox";
import { Input } from "../../../components/ui/Input";
import type { SiteAuditChecklistItem } from "../../../types/siteAudit";

export const SiteAuditChecklist = ({
  items,
  editable,
  onToggle,
  onRemarksChange,
}: {
  items: SiteAuditChecklistItem[];
  editable: boolean;
  onToggle: (key: SiteAuditChecklistItem["checklistKey"], checked: boolean) => void;
  onRemarksChange: (key: SiteAuditChecklistItem["checklistKey"], value: string) => void;
}) => (
  <div className="grid gap-2 md:grid-cols-2">
    {items.map((item) => (
      <div key={item.checklistKey} className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <Checkbox
            label=""
            checked={item.isChecked}
            disabled={!editable}
            onChange={(event) => onToggle(item.checklistKey, event.target.checked)}
          />
          <span className="text-sm font-medium text-slate-900">{item.checklistLabel}</span>
        </div>
        <Input
          className="mt-3"
          value={item.remarks ?? ""}
          disabled={!editable}
          placeholder="Remarks"
          onChange={(event) => onRemarksChange(item.checklistKey, event.target.value)}
        />
      </div>
    ))}
  </div>
);
