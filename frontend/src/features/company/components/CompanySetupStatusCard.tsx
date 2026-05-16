import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";

import { getErrorMessage } from "../../../lib/errors";
import { companyApi } from "../../../services/companyApi";
import { brandingApi } from "../../../services/brandingApi";
import { useAuth } from "../../../providers/AuthProvider";
import { useToast } from "../../../providers/ToastProvider";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import type { CompanyBranding, CompanySetupStatus, CompanyTaxSettings } from "../../../types/company";
import { getSetupChecklist } from "../companyUtils";

export const CompanySetupStatusCard = () => {
  const auth = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<CompanySetupStatus | null>(null);
  const [taxSettings, setTaxSettings] = useState<CompanyTaxSettings | null>(null);
  const [branding, setBranding] = useState<CompanyBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const [statusResponse, taxResponse, brandingResponse] = await Promise.all([
        companyApi.getSetupStatus(),
        companyApi.getTaxSettings(),
        brandingApi.get(),
      ]);

      setStatus(statusResponse.data);
      setTaxSettings(taxResponse.data);
      setBranding(brandingResponse.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load setup status"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const checklist = useMemo(() => {
    if (!status) {
      return [];
    }

    return getSetupChecklist({ status, taxSettings, branding });
  }, [branding, status, taxSettings]);

  const completedCount = checklist.filter((item) => item.completed).length;
  const progress = checklist.length ? Math.round((completedCount / checklist.length) * 100) : 0;

  return (
    <Card>
      <CardHeader
        title="Setup Status"
        action={
          status?.isComplete && auth.company?.status === "setup_pending" ? (
            <button
              type="button"
              disabled={completing}
              onClick={async () => {
                try {
                  setCompleting(true);
                  const response = await companyApi.completeSetup();
                  auth.updateCompany(response.data.company);
                  toast.success("Company setup completed");
                  await loadStatus();
                } catch (error) {
                  toast.error(getErrorMessage(error, "Unable to complete setup"));
                } finally {
                  setCompleting(false);
                }
              }}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              <CheckCircle2 className="size-4" />
              Complete Setup
            </button>
          ) : null
        }
      />
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700">
            <span>Overall Completion</span>
            <span>{loading ? "-" : `${progress}%`}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-emerald-600 transition-all"
              style={{ width: `${loading ? 0 : progress}%` }}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {checklist.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
            >
              <span
                className={`inline-flex size-5 items-center justify-center rounded-full ${
                  item.completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                }`}
              >
                {item.completed ? <Check className="size-3.5" /> : null}
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
