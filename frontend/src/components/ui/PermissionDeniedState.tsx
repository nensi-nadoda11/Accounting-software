import { ShieldAlert } from "lucide-react";

export const PermissionDeniedState = ({ title = "You do not have permission to access this section." }: { title?: string }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center">
    <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
      <ShieldAlert className="size-6" />
    </div>
    <p className="max-w-md text-sm font-medium text-slate-700">{title}</p>
  </div>
);
