import type { PropsWithChildren, ReactNode } from "react";
import { Link } from "react-router-dom";

export const AuthShell = ({
  title,
  footer,
  children,
}: PropsWithChildren<{ title: string; footer?: ReactNode }>) => (
  <div className="min-h-screen bg-[#F7FAFA] px-4 py-10">
    <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row lg:items-start">
      <div className="w-full rounded-[28px] border border-[#E5EAEA] bg-white p-8 shadow-[0_12px_30px_rgba(15,23,42,0.05)] lg:max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            LedgerFlow
          </Link>
          {footer}
        </div>
        <h1 className="mb-6 text-2xl font-semibold text-slate-900">{title}</h1>
        {children}
      </div>
      <div className="grid w-full gap-4 lg:max-w-sm">
        <div className="rounded-3xl border border-[#E5EAEA] bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">ERP Workspace</p>
          <p className="mt-2 text-sm text-slate-500">Secure access, user permissions, and company-isolated settings.</p>
        </div>
        <div className="rounded-3xl border border-[#E5EAEA] bg-white p-6">
          <div className="grid gap-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">Authentication</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">Invites & access</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">Roles & permissions</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
