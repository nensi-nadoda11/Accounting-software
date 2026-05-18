import type { CompanyBankAccount } from "../../../types/company";
import type { Payment } from "../../../types/payment";
import type { LookupOption } from "../../sales/components/AsyncLookupSelect";
import { PaymentEntryForm } from "./PaymentEntryForm";

export const ReceivePaymentForm = ({
  bankAccounts,
  canSubmit,
  editingPaymentId,
  seedKey,
  seedParty,
  onSubmitted,
  onCancelEdit,
}: {
  bankAccounts: CompanyBankAccount[];
  canSubmit: boolean;
  editingPaymentId: string | null;
  seedKey: number;
  seedParty: LookupOption | null;
  onSubmitted: (payment: Payment, status: "draft" | "completed") => void;
  onCancelEdit: () => void;
}) => (
  <PaymentEntryForm
    mode="receive"
    title="Receive Payment"
    partyLabel="Customer"
    advanceLabel="Advance"
    paymentType="customer_receive"
    partyType="customer"
    bankAccounts={bankAccounts}
    canSubmit={canSubmit}
    editingPaymentId={editingPaymentId}
    seedKey={seedKey}
    seedParty={seedParty}
    onSubmitted={onSubmitted}
    onCancelEdit={onCancelEdit}
  />
);
