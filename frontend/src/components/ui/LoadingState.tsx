import { LoaderCircle } from "lucide-react";

export const LoadingState = ({ label = "Loading..." }: { label?: string }) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white">
    <LoaderCircle className="size-6 animate-spin text-emerald-600" />
    <p className="text-sm text-slate-500">{label}</p>
  </div>
);
