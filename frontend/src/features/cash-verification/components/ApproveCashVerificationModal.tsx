import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import type { CashVerificationDetail } from "../../../types/cashVerification";
import { CashVerificationSummary } from "./CashVerificationSummary";

export const ApproveCashVerificationModal = ({
  open,
  cashVerification,
  loading,
  onClose,
  onApprove,
}: {
  open: boolean;
  cashVerification: CashVerificationDetail | null;
  loading: boolean;
  onClose: () => void;
  onApprove: () => void;
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Approve Cash Verification"
    footer={
      <>
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="button" onClick={onApprove} loading={loading}>
          Approve
        </Button>
      </>
    }
  >
    {cashVerification ? (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{cashVerification.verificationNo}</p>
          <p className="text-sm text-slate-500">
            {new Date(cashVerification.verificationDate).toLocaleDateString("en-IN")}
          </p>
        </div>
        <CashVerificationSummary
          expectedCash={cashVerification.expectedCash}
          actualCash={cashVerification.actualCash}
          differenceAmount={cashVerification.differenceAmount}
          status={cashVerification.status}
        />
        <p className="text-sm text-slate-600">Approval records the verification only. No cash adjustment will be posted.</p>
      </div>
    ) : null}
  </Modal>
);
