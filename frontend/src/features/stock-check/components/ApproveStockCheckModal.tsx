import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import type { StockCheckDetail } from "../../../types/stockCheck";
import { StockCheckSummary } from "./StockCheckSummary";

export const ApproveStockCheckModal = ({
  open,
  stockCheck,
  loading,
  onClose,
  onApprove,
}: {
  open: boolean;
  stockCheck: StockCheckDetail | null;
  loading: boolean;
  onClose: () => void;
  onApprove: () => void;
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Approve Stock Check"
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
    {stockCheck ? (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{stockCheck.checkNo}</p>
          <p className="text-sm text-slate-500">{stockCheck.warehouse.name ?? stockCheck.warehouse.warehouseCode}</p>
        </div>
        <StockCheckSummary summary={stockCheck.summary} />
        <p className="text-sm text-slate-600">Approval will post inventory adjustments for all shortage and excess items.</p>
      </div>
    ) : null}
  </Modal>
);
