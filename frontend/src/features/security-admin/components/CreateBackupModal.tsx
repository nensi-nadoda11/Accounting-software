import { useEffect, useState } from "react";

import { Checkbox } from "../../../components/ui/Checkbox";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import type { BackupIncludeKey } from "../../../types/securityAdmin";

const INCLUDE_OPTIONS: Array<{ key: BackupIncludeKey; label: string }> = [
  { key: "settings", label: "Settings" },
  { key: "users", label: "Users" },
  { key: "customers", label: "Customers" },
  { key: "suppliers", label: "Suppliers" },
  { key: "products", label: "Products" },
  { key: "inventory", label: "Inventory" },
  { key: "sales", label: "Sales" },
  { key: "purchases", label: "Purchases" },
  { key: "payments", label: "Payments" },
  { key: "accounting", label: "Accounting" },
  { key: "expenses", label: "Expenses" },
  { key: "payroll", label: "Payroll" },
  { key: "gst", label: "GST" }
];

const DEFAULT_INCLUDES = INCLUDE_OPTIONS.map((option) => option.key);

export const CreateBackupModal = ({
  open,
  loading,
  onClose,
  onSubmit
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (value: { backupName: string; includes: BackupIncludeKey[] }) => Promise<void>;
}) => {
  const [backupName, setBackupName] = useState("");
  const [includes, setIncludes] = useState<BackupIncludeKey[]>(DEFAULT_INCLUDES);

  useEffect(() => {
    if (!open) {
      setBackupName("");
      setIncludes(DEFAULT_INCLUDES);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Backup"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={loading}
            disabled={!backupName.trim() || includes.length === 0}
            onClick={() => void onSubmit({ backupName: backupName.trim(), includes })}
          >
            Create Backup
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input value={backupName} onChange={(event) => setBackupName(event.target.value)} placeholder="Backup name" />
        <div className="grid gap-3 md:grid-cols-2">
          {INCLUDE_OPTIONS.map((option) => (
            <Checkbox
              key={option.key}
              label={option.label}
              checked={includes.includes(option.key)}
              onChange={(event) => {
                setIncludes((current) =>
                  event.target.checked ? [...current, option.key] : current.filter((item) => item !== option.key)
                );
              }}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
};
