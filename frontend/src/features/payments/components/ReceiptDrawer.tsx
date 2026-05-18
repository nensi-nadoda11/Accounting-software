import { useEffect, useState } from "react";

import { AmountText } from "../../../components/ui/AmountText";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { SideSheet } from "../../../components/ui/SideSheet";
import { getErrorMessage } from "../../../lib/errors";
import { useToast } from "../../../providers/ToastProvider";
import { paymentsApi } from "../../../services/paymentsApi";
import type { PaymentReceipt, PaymentReceiptData } from "../../../types/payment";
import { formatDateTime } from "../../customers/customerUtils";

type ReceiptResponse = PaymentReceipt & { receiptData: PaymentReceiptData };

export const ReceiptDrawer = ({
  open,
  paymentId,
  onClose,
  onPrint,
}: {
  open: boolean;
  paymentId: string | null;
  onClose: () => void;
  onPrint: (paymentId: string) => Promise<void>;
}) => {
  const toast = useToast();
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !paymentId) {
      return;
    }

    const loadReceipt = async () => {
      try {
        setLoading(true);
        const response = await paymentsApi.getReceipt(paymentId);
        setReceipt(response.data.receipt as ReceiptResponse);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load receipt"));
      } finally {
        setLoading(false);
      }
    };

    void loadReceipt();
  }, [open, paymentId, toast]);

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      title={receipt ? receipt.receiptNumber : "Receipt"}
      className="max-w-3xl"
      footer={
        paymentId ? (
          <>
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button type="button" onClick={() => void onPrint(paymentId)}>
              Print
            </Button>
          </>
        ) : undefined
      }
    >
      {loading ? (
        <LoadingState label="Loading receipt..." />
      ) : !receipt ? (
        <EmptyState title="Receipt not available" />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Party</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{receipt.receiptData.party.name}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Amount</p>
                <div className="mt-1"><AmountText value={receipt.receiptData.payment.amount} /></div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Generated</p>
                <p className="mt-1 text-sm text-slate-700">{formatDateTime(receipt.generatedAt)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Allocations" />
            <CardContent className="space-y-2">
              {receipt.receiptData.allocations.length ? (
                receipt.receiptData.allocations.map((allocation) => (
                  <div key={allocation.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{allocation.referenceNumber ?? "-"}</p>
                      <p className="text-xs text-slate-500">{allocation.allocationType}</p>
                    </div>
                    <AmountText value={allocation.allocatedAmount} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No allocations linked.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </SideSheet>
  );
};
