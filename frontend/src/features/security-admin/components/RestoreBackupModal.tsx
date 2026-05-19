import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Select } from "../../../components/ui/Select";
import type { Backup, RestoreMode } from "../../../types/securityAdmin";

export const RestoreBackupModal = ({
  open,
  backup,
  loading,
  onClose,
  onSubmit
}: {
  open: boolean;
  backup: Backup | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (value: { restoreMode: RestoreMode; file: File | null }) => Promise<void>;
}) => {
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("merge");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) {
      setRestoreMode("merge");
      setFile(null);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Restore Backup"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={loading} onClick={() => void onSubmit({ restoreMode, file })}>
            Restore
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Restoring <span className="font-semibold">{backup?.backupName ?? "backup"}</span> will apply company data immediately.
        </div>
        <Select value={restoreMode} onChange={(event) => setRestoreMode(event.target.value as RestoreMode)}>
          <option value="merge">Merge</option>
          <option value="replace">Replace</option>
        </Select>
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Upload file</p>
          <Input
            type="file"
            accept="application/json,.json"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>
    </Modal>
  );
};
