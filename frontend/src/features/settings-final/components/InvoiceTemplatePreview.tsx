import type { ReactNode } from "react";

import { Badge } from "../../../components/ui/Badge";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import type { InvoiceLayoutConfig } from "../../../types/settings";

export const InvoiceTemplatePreview = ({
  templateName,
  invoiceType,
  layoutConfig,
  companyName,
  footer,
}: {
  templateName: string;
  invoiceType: "sales" | "purchase" | "pos" | "return";
  layoutConfig: InvoiceLayoutConfig;
  companyName?: string;
  footer?: ReactNode;
}) => (
  <Card className="flex h-full flex-col overflow-hidden">
    <CardHeader title="Preview" action={<Badge tone="info">{invoiceType}</Badge>} />
    <CardContent className="flex-1 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-slate-900">{companyName || "Your Company"}</p>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{templateName || "Invoice Template"}</p>
          </div>
          {layoutConfig.showLogo ? <div className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">Logo</div> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Terms</p>
            <p className="mt-1">{layoutConfig.termsFooter || "No terms added."}</p>
          </div>
          <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Footer</p>
            <p className="mt-1">{layoutConfig.footerNote || "No footer note added."}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {([
          ["Logo", layoutConfig.showLogo],
          ["Signature", layoutConfig.showSignature],
          ["Bank Details", layoutConfig.showBankDetails],
          ["QR Code", layoutConfig.showQrCode],
        ] as const).map(([label, enabled]) => (
          <div key={label} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <span className="text-slate-700">{label}</span>
            <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Shown" : "Hidden"}</Badge>
          </div>
        ))}
      </div>
    </CardContent>
    {footer ? <div className="border-t border-slate-100 px-5 py-4">{footer}</div> : null}
  </Card>
);
