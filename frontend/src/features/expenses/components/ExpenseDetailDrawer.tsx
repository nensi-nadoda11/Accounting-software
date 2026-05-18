import { CheckCircle2, Pencil, XCircle } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { LoadingState } from "../../../components/ui/LoadingState";
import { SideSheet } from "../../../components/ui/SideSheet";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Expense, ExpenseAttachment } from "../../../types/expense";
import { EXPENSE_PAYMENT_MODE_LABELS, EXPENSE_STATUS_LABELS } from "../expenseOptions";
import { ExpenseAttachmentUploader } from "./ExpenseAttachmentUploader";

type UploadingFile = {
  id: string;
  file: File;
  progress: number;
};

export const ExpenseDetailDrawer = ({
  open,
  expense,
  loading,
  canUpdate,
  canPost,
  uploadingFiles,
  onClose,
  onEdit,
  onPost,
  onCancel,
  onUploadAttachments,
  onRemoveAttachment,
}: {
  open: boolean;
  expense: Expense | null;
  loading: boolean;
  canUpdate: boolean;
  canPost: boolean;
  uploadingFiles: UploadingFile[];
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onPost: (expense: Expense) => void;
  onCancel: (expense: Expense) => void;
  onUploadAttachments: (files: File[]) => void;
  onRemoveAttachment: (attachment: ExpenseAttachment) => void;
}) => (
  <SideSheet
    open={open}
    onClose={onClose}
    title={expense ? expense.expenseNumber : "Expense Details"}
    className="max-w-4xl"
    footer={
      expense ? (
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="button" variant="secondary" onClick={() => onEdit(expense)} disabled={!canUpdate || expense.status !== "draft"}>
            <Pencil className="mr-2 size-4" />
            Edit Draft
          </Button>
          <Button type="button" onClick={() => onPost(expense)} disabled={!canPost || expense.status !== "draft"}>
            <CheckCircle2 className="mr-2 size-4" />
            Post
          </Button>
          <Button type="button" variant="danger" onClick={() => onCancel(expense)} disabled={!canPost || expense.status !== "posted"}>
            <XCircle className="mr-2 size-4" />
            Cancel
          </Button>
        </>
      ) : undefined
    }
  >
    {loading || !expense ? (
      <LoadingState label="Loading expense..." />
    ) : (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent><p className="text-[11px] uppercase tracking-wide text-slate-500">Date</p><p className="mt-1 text-sm font-semibold text-slate-900">{expense.expenseDate.slice(0, 10)}</p></CardContent></Card>
          <Card><CardContent><p className="text-[11px] uppercase tracking-wide text-slate-500">Status</p><div className="mt-1"><StatusBadge status={expense.status} label={EXPENSE_STATUS_LABELS[expense.status]} /></div></CardContent></Card>
          <Card><CardContent><p className="text-[11px] uppercase tracking-wide text-slate-500">Category</p><p className="mt-1 text-sm font-semibold text-slate-900">{expense.category.name}</p></CardContent></Card>
          <Card><CardContent><p className="text-[11px] uppercase tracking-wide text-slate-500">Payment Mode</p><p className="mt-1 text-sm font-semibold text-slate-900">{EXPENSE_PAYMENT_MODE_LABELS[expense.paymentMode]}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader title="Expense Details" />
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Payee</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.payeeName ?? "-"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Expense Account</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.account ? `${expense.account.accountCode} • ${expense.account.accountName}` : "-"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Reference</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.referenceNumber ?? "-"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Vendor GST</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.vendorGstNumber ?? "-"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Vendor PAN</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.vendorPanNumber ?? "-"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">HSN / SAC</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.hsnSacCode ?? "-"}</p></div>
            <div className="md:col-span-2 xl:col-span-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Description</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.description}</p></div>
            {expense.notes ? <div className="md:col-span-2 xl:col-span-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Notes</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.notes}</p></div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Payment Details" />
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Bank Account</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.bankAccount ? `${expense.bankAccount.bankName} • ${expense.bankAccount.accountNumber}` : "-"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Cheque Number</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.chequeNumber ?? "-"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Cheque Date</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.chequeDate?.slice(0, 10) ?? "-"}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Cheque Status</p><p className="mt-1 text-sm font-medium text-slate-900">{expense.chequeStatus ?? "-"}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="GST Breakdown" />
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Taxable Amount</p><p className="mt-1 text-sm font-semibold text-slate-900">{expense.taxableAmount}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">CGST</p><p className="mt-1 text-sm font-semibold text-slate-900">{expense.cgstAmount}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">SGST</p><p className="mt-1 text-sm font-semibold text-slate-900">{expense.sgstAmount}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">IGST</p><p className="mt-1 text-sm font-semibold text-slate-900">{expense.igstAmount}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p><p className="mt-1 text-sm font-semibold text-slate-900">{expense.totalAmount}</p></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Attachments" />
          <CardContent>
            <ExpenseAttachmentUploader
              attachments={expense.attachments}
              uploadingFiles={uploadingFiles}
              onUpload={onUploadAttachments}
              onRemove={onRemoveAttachment}
              disabled={expense.status === "posted" && !canUpdate}
            />
          </CardContent>
        </Card>
      </div>
    )}
  </SideSheet>
);
