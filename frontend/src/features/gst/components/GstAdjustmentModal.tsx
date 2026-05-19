import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { Textarea } from "../../../components/ui/Textarea";
import type { GstAdjustment } from "../../../types/gst";
import {
  gstAdjustmentSchema,
  type GstAdjustmentFormInputValues,
  type GstAdjustmentFormValues,
} from "../gstSchemas";
import { formatGstDateTime, GST_ADJUSTMENT_TYPE_LABELS, GST_TAX_COMPONENT_LABELS } from "../gstUtils";

export const GstAdjustmentModal = ({
  open,
  mode,
  adjustment,
  submitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "view";
  adjustment: GstAdjustment | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit?: (values: GstAdjustmentFormValues) => void;
}) => {
  const form = useForm<GstAdjustmentFormInputValues, undefined, GstAdjustmentFormValues>({
    resolver: zodResolver(gstAdjustmentSchema),
    defaultValues: {
      adjustmentDate: "",
      adjustmentType: "output_tax_adjustment",
      taxComponent: "cgst",
      amount: 0,
      reason: "",
      referenceNumber: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "view" && adjustment) {
      form.reset({
        adjustmentDate: adjustment.adjustmentDate.slice(0, 10),
        adjustmentType: adjustment.adjustmentType,
        taxComponent: adjustment.taxComponent,
        amount: Number(adjustment.amount),
        reason: adjustment.reason,
        referenceNumber: adjustment.referenceNumber ?? "",
        notes: adjustment.notes ?? "",
      });
      return;
    }

    form.reset({
      adjustmentDate: "",
      adjustmentType: "output_tax_adjustment",
      taxComponent: "cgst",
      amount: 0,
      reason: "",
      referenceNumber: "",
      notes: "",
    });
  }, [adjustment, form, mode, open]);

  if (mode === "view" && adjustment) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="GST Adjustment"
        footer={
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Adjustment No", adjustment.adjustmentNumber],
            ["Date", adjustment.adjustmentDate.slice(0, 10)],
            ["Type", GST_ADJUSTMENT_TYPE_LABELS[adjustment.adjustmentType]],
            ["Component", GST_TAX_COMPONENT_LABELS[adjustment.taxComponent]],
            ["Amount", adjustment.amount],
            ["Status", adjustment.status],
            ["Reference No", adjustment.referenceNumber || "-"],
            ["Updated", formatGstDateTime(adjustment.updatedAt)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
            </div>
          ))}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reason</p>
            <p className="mt-1 text-sm text-slate-900">{adjustment.reason}</p>
          </div>
          {adjustment.notes ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-900">{adjustment.notes}</p>
            </div>
          ) : null}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add GST Adjustment"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" loading={submitting} onClick={form.handleSubmit((values) => onSubmit?.(values))}>
            Save Adjustment
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Input type="date" label="Adjustment Date" {...form.register("adjustmentDate")} error={form.formState.errors.adjustmentDate?.message} />
        <Select label="Adjustment Type" {...form.register("adjustmentType")} error={form.formState.errors.adjustmentType?.message}>
          {Object.entries(GST_ADJUSTMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Select label="Tax Component" {...form.register("taxComponent")} error={form.formState.errors.taxComponent?.message}>
          {Object.entries(GST_TAX_COMPONENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Input type="number" step="0.01" label="Amount" {...form.register("amount")} error={form.formState.errors.amount?.message} />
        <Input label="Reference Number" {...form.register("referenceNumber")} error={form.formState.errors.referenceNumber?.message?.toString()} />
        <div />
        <Textarea label="Reason" rows={3} {...form.register("reason")} error={form.formState.errors.reason?.message} className="md:col-span-2" />
        <Textarea label="Notes" rows={3} {...form.register("notes")} error={form.formState.errors.notes?.message?.toString()} className="md:col-span-2" />
      </div>
    </Modal>
  );
};
