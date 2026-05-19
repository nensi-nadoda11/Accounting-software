import { Download } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import type { GstExportType } from "../../../types/gst";

const EXPORT_ROWS: Array<{ id: GstExportType; label: string }> = [
  { id: "sales", label: "Sales GST" },
  { id: "purchases", label: "Purchase GST" },
  { id: "itc", label: "ITC" },
  { id: "hsn-summary", label: "HSN/SAC" },
  { id: "tax-summary", label: "Tax Summary" },
  { id: "gstr-1", label: "GSTR-1" },
  { id: "gstr-3b", label: "GSTR-3B" },
];

export const GstExportCenter = ({
  loadingType,
  onExport,
}: {
  loadingType: GstExportType | null;
  onExport: (type: GstExportType) => void;
}) => (
  <Card>
    <CardHeader title="Export Center" />
    <CardContent className="space-y-2">
      {EXPORT_ROWS.map((item) => (
        <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-sm font-medium text-slate-800">{item.label}</p>
          <Button type="button" variant="secondary" loading={loadingType === item.id} onClick={() => onExport(item.id)}>
            <Download className="mr-2 size-4" />
            Export
          </Button>
        </div>
      ))}
    </CardContent>
  </Card>
);
