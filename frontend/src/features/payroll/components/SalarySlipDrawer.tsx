import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { LoadingState } from "../../../components/ui/LoadingState";
import { SideSheet } from "../../../components/ui/SideSheet";
import { Textarea } from "../../../components/ui/Textarea";
import type { SalarySlip } from "../../../types/payroll";
import { formatDate } from "../../customers/customerUtils";
import { salarySlipEmailFormSchema, type SalarySlipEmailFormValues } from "../payrollSchemas";
import { amountToWords, maskAccountNumber } from "../payrollUtils";

export const SalarySlipDrawer = ({
  open,
  slip,
  loading,
  downloading,
  emailing,
  onClose,
  onDownloadPdf,
  onEmail,
}: {
  open: boolean;
  slip: SalarySlip | null;
  loading: boolean;
  downloading: boolean;
  emailing: boolean;
  onClose: () => void;
  onDownloadPdf: () => void;
  onEmail: (values: SalarySlipEmailFormValues) => Promise<void> | void;
}) => {
  const emailForm = useForm<z.input<typeof salarySlipEmailFormSchema>, undefined, SalarySlipEmailFormValues>({
    resolver: zodResolver(salarySlipEmailFormSchema),
    defaultValues: {
      email: slip?.employee ? "" : "",
      subject: "",
      message: "",
    },
  });

  useEffect(() => {
    emailForm.reset({
      email: "",
      subject: slip ? `Salary slip ${slip.runNumber} - ${slip.payrollMonth}` : "",
      message: "",
    });
  }, [emailForm, open, slip]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={slip ? `Salary Slip · ${slip.employee.fullName}` : "Salary Slip"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" loading={downloading} onClick={onDownloadPdf}>
            Download PDF
          </Button>
          <Button loading={emailing} onClick={emailForm.handleSubmit(async (values) => onEmail(values))}>
            Email Slip
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingState label="Loading salary slip..." />
      ) : !slip ? (
        <EmptyState title="Salary slip is not available." />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-lg font-semibold text-slate-900">{slip.company?.legalName || slip.company?.name || "Company"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {[slip.company?.addressLine1, slip.company?.addressLine2, slip.company?.city, slip.company?.state, slip.company?.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              <div className="text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-900">Run:</span> {slip.runNumber}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Payroll Month:</span> {slip.payrollMonth}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Period:</span> {formatDate(slip.periodStart)} to {formatDate(slip.periodEnd)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Employee Details</p>
                <p>{slip.employee.fullName}</p>
                <p>{slip.employee.employeeCode}</p>
                <p>{slip.employee.department || "-"}</p>
                <p>{slip.employee.designation || "-"}</p>
              </div>
              <div className="space-y-1 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">Payment Info</p>
                <p>{slip.salary.paymentStatus}</p>
                <p>Bank: {slip.employee.bankName || "-"}</p>
                <p>A/C: {maskAccountNumber(slip.employee.accountNumber)}</p>
                <p>IFSC: {slip.employee.ifscCode || "-"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Earnings</p>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between"><span>Basic</span><AmountText value={slip.salary.basicSalary} tone="default" /></div>
                  <div className="flex items-center justify-between"><span>HRA</span><AmountText value={slip.salary.hra} tone="default" /></div>
                  <div className="flex items-center justify-between"><span>Allowances</span><AmountText value={slip.salary.allowancesTotal} tone="default" /></div>
                  <div className="flex items-center justify-between"><span>Bonus</span><AmountText value={slip.salary.bonusTotal} tone="default" /></div>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-900">Deductions</p>
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between"><span>Total Deductions</span><AmountText value={slip.salary.deductionsTotal} tone="default" /></div>
                  {slip.bonusDeductions
                    .filter((entry) => entry.type === "deduction")
                    .map((entry) => (
                      <div key={entry.id ?? entry.name} className="flex items-center justify-between">
                        <span>{entry.name}</span>
                        <AmountText value={entry.amount} tone="default" />
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Gross</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{slip.salary.grossSalary}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Net Salary</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{slip.salary.netSalary}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Paid Amount</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{slip.salary.paidAmount}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Amount In Words</p>
              <p className="text-sm text-slate-600">{amountToWords(slip.salary.netSalary)}</p>
            </CardContent>
          </Card>

          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Email Slip</p>
            <Input label="Email" {...emailForm.register("email")} error={emailForm.formState.errors.email?.message} />
            <Input label="Subject" {...emailForm.register("subject")} error={emailForm.formState.errors.subject?.message} />
            <Textarea label="Message" rows={3} {...emailForm.register("message")} error={emailForm.formState.errors.message?.message} />
          </div>
        </div>
      )}
    </SideSheet>
  );
};
