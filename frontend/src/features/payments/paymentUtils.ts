import type { LookupOption } from "../sales/components/AsyncLookupSelect";
import type {
  DueItem,
  Payment,
  PaymentFormAllocationInput,
  PaymentFormInput,
  PaymentMode,
  PaymentPdfPayload,
  PaymentReceiptData,
  PaymentType,
} from "../../types/payment";

const BANK_LINKED_MODES = new Set<PaymentMode>(["bank", "upi", "card", "cheque", "neft", "rtgs", "imps"]);
const REFERENCE_REQUIRED_MODES = new Set<PaymentMode>(["bank", "upi", "card", "neft", "rtgs", "imps"]);

export const requiresBankAccount = (paymentMode: PaymentMode) => BANK_LINKED_MODES.has(paymentMode);

export const requiresReferenceNumber = (paymentMode: PaymentMode) => REFERENCE_REQUIRED_MODES.has(paymentMode);

export const isChequeMode = (paymentMode: PaymentMode) => paymentMode === "cheque";

export const getPaymentPartyLabel = (payment: Pick<Payment, "party" | "partyType">) =>
  payment.party?.name ?? (payment.partyType === "customer" ? "Customer" : "Supplier");

export const toLookupOption = (input: {
  id: string;
  label: string;
  description?: string | null;
  meta?: string | null;
}): LookupOption => ({
  id: input.id,
  label: input.label,
  description: input.description,
  meta: input.meta,
});

export const sortDueItemsOldestFirst = (items: DueItem[]) =>
  [...items].sort((left, right) => {
    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    return new Date(left.invoiceDate).getTime() - new Date(right.invoiceDate).getTime();
  });

export const sumAllocationInputs = (allocations: PaymentFormAllocationInput[]) =>
  allocations.reduce((total, allocation) => total + Number(allocation.allocatedAmount || 0), 0);

export const findAllocatedAmount = (allocations: PaymentFormAllocationInput[], referenceId: string) =>
  Number(allocations.find((allocation) => allocation.referenceId === referenceId)?.allocatedAmount ?? 0);

export const autoAllocateDueItems = (
  dueItems: DueItem[],
  amount: number,
  paymentType: PaymentType,
  paymentDate: string,
): PaymentFormAllocationInput[] => {
  let remaining = Number.isFinite(amount) ? Math.max(amount, 0) : 0;
  const allocationType = paymentType === "customer_receive" ? "sales_invoice" : "purchase_invoice";
  const nextAllocations: PaymentFormAllocationInput[] = [];

  for (const item of sortDueItemsOldestFirst(dueItems)) {
    if (remaining <= 0) {
      break;
    }

    const due = Number(item.dueAmount);
    if (!Number.isFinite(due) || due <= 0) {
      continue;
    }

    const allocatedAmount = Number(Math.min(due, remaining).toFixed(2));
    remaining = Number((remaining - allocatedAmount).toFixed(2));

    nextAllocations.push({
      allocationType,
      referenceId: item.referenceId,
      referenceNumber: item.referenceNumber,
      allocatedAmount,
      allocationDate: paymentDate,
    });
  }

  return nextAllocations;
};

export const buildPaymentPayload = (
  values: PaymentFormInput,
  status: "draft" | "completed",
): PaymentFormInput => ({
  ...values,
  status,
  amount: Number(values.amount),
  referenceNumber: values.referenceNumber?.trim() ? values.referenceNumber.trim() : null,
  notes: values.notes?.trim() ? values.notes.trim() : null,
  chequeNumber: values.chequeNumber?.trim() ? values.chequeNumber.trim() : null,
  chequeBankName: values.chequeBankName?.trim() ? values.chequeBankName.trim() : null,
  allocations: values.allocations
    .filter((allocation) => allocation.referenceId && Number(allocation.allocatedAmount) > 0)
    .map((allocation) => ({
      ...allocation,
      allocatedAmount: Number(Number(allocation.allocatedAmount).toFixed(2)),
      allocationDate: allocation.allocationDate || values.paymentDate,
    })),
});

export const mapPaymentToFormValues = (payment: Payment): PaymentFormInput => ({
  paymentType: payment.paymentType,
  partyType: payment.partyType,
  partyId: payment.partyId,
  paymentDate: payment.paymentDate.slice(0, 10),
  amount: Number(payment.amount),
  paymentMode: payment.paymentMode,
  bankAccountId: payment.bankAccount?.id ?? null,
  referenceNumber: payment.referenceNumber ?? null,
  notes: payment.notes ?? null,
  status: payment.status === "completed" ? "completed" : "draft",
  isAdvance: payment.isAdvance,
  chequeNumber: payment.chequeNumber ?? null,
  chequeDate: payment.chequeDate ? payment.chequeDate.slice(0, 10) : null,
  chequeBankName: payment.chequeBankName ?? null,
  chequeStatus: payment.chequeStatus ?? null,
  allocations: (payment.allocations ?? []).map((allocation) => ({
    allocationType: allocation.allocationType,
    referenceId: allocation.referenceId,
    referenceNumber: allocation.referenceNumber,
    allocatedAmount: Number(allocation.allocatedAmount),
    allocationDate: allocation.allocationDate ? allocation.allocationDate.slice(0, 10) : payment.paymentDate.slice(0, 10),
  })),
});

export const getRemainingAmount = (amount: number, allocations: PaymentFormAllocationInput[]) =>
  Number(Math.max(amount - sumAllocationInputs(allocations), 0).toFixed(2));

export const matchesNinetyPlusBucket = (agingBucket: string) => agingBucket === "91-180" || agingBucket === "181+";

const renderReceiptHtml = (receipt: PaymentReceiptData) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${receipt.receiptNumber}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; }
      h1, h2, p { margin: 0; }
      .top { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
      .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
      .meta { font-size: 12px; color: #64748b; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; text-align: left; }
      th { background: #f8fafc; }
      .totals { margin-top: 18px; width: 300px; margin-left: auto; }
      .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
      .strong { font-weight: 700; border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 8px; }
    </style>
  </head>
  <body>
    <div class="top">
      <div>
        <h1>${receipt.receiptType === "customer_receipt" ? "Receipt" : "Voucher"}</h1>
        <p>${receipt.receiptNumber}</p>
      </div>
      <div class="box">
        <div class="meta">Party</div>
        <div>${receipt.party.name}</div>
        <div>${receipt.party.code}</div>
      </div>
    </div>
    <div class="grid">
      <div><div class="meta">Payment No</div><div>${receipt.payment.paymentNumber}</div></div>
      <div><div class="meta">Date</div><div>${receipt.payment.paymentDate.slice(0, 10)}</div></div>
      <div><div class="meta">Mode</div><div>${receipt.payment.paymentMode}</div></div>
      <div><div class="meta">Amount</div><div>${receipt.payment.amount}</div></div>
      <div><div class="meta">Allocated</div><div>${receipt.payment.allocatedAmount}</div></div>
      <div><div class="meta">Advance</div><div>${receipt.payment.unallocatedAmount}</div></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Reference</th>
          <th>Type</th>
          <th>Date</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${receipt.allocations
          .map(
            (allocation) => `<tr>
              <td>${allocation.referenceNumber ?? "-"}</td>
              <td>${allocation.allocationType}</td>
              <td>${allocation.allocationDate?.slice(0, 10) ?? "-"}</td>
              <td>${allocation.allocatedAmount}</td>
            </tr>`,
          )
          .join("")}
      </tbody>
    </table>
    <div class="totals">
      <div><span>Amount</span><span>${receipt.payment.amount}</span></div>
      <div><span>Allocated</span><span>${receipt.payment.allocatedAmount}</span></div>
      <div class="strong"><span>Advance</span><span>${receipt.payment.unallocatedAmount}</span></div>
    </div>
  </body>
</html>`;

export const openReceiptPrintWindow = (payload: PaymentPdfPayload) => {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=780");
  if (!printWindow) {
    throw new Error("Unable to open print window");
  }

  printWindow.document.write(renderReceiptHtml(payload.receipt));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  window.setTimeout(() => printWindow.close(), 500);
};
