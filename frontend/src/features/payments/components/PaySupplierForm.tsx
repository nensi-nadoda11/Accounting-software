import type { CompanyBankAccount } from "../../../types/company";
import type { Payment } from "../../../types/payment";
import type { LookupOption } from "../../sales/components/AsyncLookupSelect";
import { PaymentEntryForm } from "./PaymentEntryForm";

export const PaySupplierForm = ({
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
    mode="pay"
    title="Pay Supplier"
    partyLabel="Supplier"
    advanceLabel="Advance Paid"
    paymentType="supplier_pay"
    partyType="supplier"
    bankAccounts={bankAccounts}
    canSubmit={canSubmit}
    editingPaymentId={editingPaymentId}
    seedKey={seedKey}
    seedParty={seedParty}
    onSubmitted={onSubmitted}
    onCancelEdit={onCancelEdit}
  />
);
