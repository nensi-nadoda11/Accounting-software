import { useEffect, useRef } from "react";

import { PERMISSION_GROUPS } from "../../../constants/permissions";
import type { PermissionKey } from "../../../types/auth";

const GroupSelectAllCheckbox = ({
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
    />
  );
};

export const PermissionCheckboxGrid = ({
  selected,
  onChange,
  readOnly = false,
}: {
  selected: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  readOnly?: boolean;
}) => {
  const selectedSet = new Set(selected);

  const toggle = (permission: PermissionKey) => {
    if (readOnly) {
      return;
    }

    if (selectedSet.has(permission)) {
      onChange(selected.filter((item) => item !== permission));
      return;
    }

    onChange([...selected, permission]);
  };

  const toggleGroup = (permissions: PermissionKey[], shouldSelectAll: boolean) => {
    if (readOnly) {
      return;
    }

    if (shouldSelectAll) {
      onChange(Array.from(new Set([...selected, ...permissions])));
      return;
    }

    const permissionSet = new Set(permissions);
    onChange(selected.filter((item) => !permissionSet.has(item)));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {PERMISSION_GROUPS.map((group) => {
        const selectedCount = group.permissions.filter((permission) => selectedSet.has(permission)).length;
        const allSelected = selectedCount === group.permissions.length;
        const partiallySelected = selectedCount > 0 && !allSelected;

        return (
          <div key={group.label} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-slate-800">{group.label}</h4>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <GroupSelectAllCheckbox
                  checked={allSelected}
                  indeterminate={partiallySelected}
                  disabled={readOnly}
                  onChange={() => toggleGroup(group.permissions, !allSelected)}
                />
                <span>Select All</span>
              </label>
            </div>
            <div className="grid gap-2">
              {group.permissions.map((permission) => (
                <label key={permission} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(permission)}
                    onChange={() => toggle(permission)}
                    disabled={readOnly}
                    className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{permission}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
