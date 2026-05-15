import { Button } from "./Button";
import { Modal } from "./Modal";

export const ConfirmDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  loading,
  tone = "danger",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  loading?: boolean;
  tone?: "danger" | "primary";
}) => (
  <Modal
    open={open}
    onClose={onClose}
    title={title}
    footer={
      <>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
          Confirm
        </Button>
      </>
    }
  >
    <p className="text-sm text-slate-600">{description}</p>
  </Modal>
);
