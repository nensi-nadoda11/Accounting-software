import { PERMISSION_GROUPS } from "../../../constants/permissions";
import type { PermissionKey } from "../../../types/auth";

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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.label} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-800">{group.label}</h4>
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
      ))}
    </div>
  );
};
