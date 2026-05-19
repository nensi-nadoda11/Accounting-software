import { Pencil, Star, Trash2 } from "lucide-react";

import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { PaymentMode } from "../../../types/settings";

export const PaymentModesTable = ({
  items,
  onEdit,
  onDefault,
  onDelete,
}: {
  items: PaymentMode[];
  onEdit: (item: PaymentMode) => void;
  onDefault: (item: PaymentMode) => void;
  onDelete: (item: PaymentMode) => void;
}) => {
  if (!items.length) {
    return <EmptyState title="No payment modes available" />;
  }

  return (
    <TableWrapper>
      <Table>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {["Mode", "Enabled", "Default", "Reference Required", "Bank Required", "Cheque Workflow", "Actions"].map((head) => (
              <th key={head} className="px-5 font-semibold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-5">
                <div>
                  <p className="font-medium text-slate-900">{item.modeName}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{item.modeKey.replace("_", " ")}</p>
                </div>
              </td>
              <td className="px-5"><StatusBadge status={item.isEnabled ? "active" : "inactive"} label={item.isEnabled ? "Enabled" : "Disabled"} /></td>
              <td className="px-5"><StatusBadge status={item.isDefault ? "default" : "inactive"} label={item.isDefault ? "Default" : "No"} /></td>
              <td className="px-5">{item.requiresReference ? "Yes" : "No"}</td>
              <td className="px-5">{item.requiresBankAccount ? "Yes" : "No"}</td>
              <td className="px-5">{item.chequeWorkflowEnabled ? "Yes" : "No"}</td>
              <td className="px-5">
                <div className="flex items-center gap-1">
                  <TableActionIconButton label="Edit" icon={<Pencil className="size-4" />} onClick={() => onEdit(item)} />
                  <TableActionIconButton label="Set Default" icon={<Star className="size-4" />} onClick={() => onDefault(item)} disabled={item.isDefault || !item.isEnabled} />
                  <TableActionIconButton label="Delete" icon={<Trash2 className="size-4" />} tone="danger" onClick={() => onDelete(item)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  );
};
