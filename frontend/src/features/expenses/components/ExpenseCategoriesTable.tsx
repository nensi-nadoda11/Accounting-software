import { Pencil, Trash2 } from "lucide-react";

import { EmptyState } from "../../../components/ui/EmptyState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { TableActionIconButton } from "../../../components/ui/TableActionIconButton";
import type { ExpenseCategory } from "../../../types/expense";

export const ExpenseCategoriesTable = ({
  items,
  loading,
  onEdit,
  onDelete,
  getParentName,
  canManage,
}: {
  items: ExpenseCategory[];
  loading: boolean;
  onEdit: (category: ExpenseCategory) => void;
  onDelete: (category: ExpenseCategory) => void;
  getParentName: (parentId: string | null) => string;
  canManage: boolean;
}) => {
  if (loading) {
    return <LoadingState label="Loading categories..." />;
  }

  if (!items.length) {
    return <EmptyState title="No categories found." />;
  }

  return (
    <TableWrapper>
      <Table>
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {["Code", "Name", "Parent", "Default Account", "Status", "Actions"].map((head) => (
              <th key={head} className="px-4 py-3 font-semibold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
          {items.map((category) => (
            <tr key={category.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{category.categoryCode}</td>
              <td className="px-4 py-3">{category.name}</td>
              <td className="px-4 py-3">{getParentName(category.parentId)}</td>
              <td className="px-4 py-3">
                {category.defaultAccount ? `${category.defaultAccount.accountCode} • ${category.defaultAccount.accountName}` : "-"}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={category.status} label={category.status === "inactive" ? "Inactive" : "Active"} />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <TableActionIconButton
                    label="Edit category"
                    icon={<Pencil className="size-4" />}
                    onClick={() => onEdit(category)}
                    disabled={!canManage}
                  />
                  <TableActionIconButton
                    label="Delete category"
                    icon={<Trash2 className="size-4" />}
                    onClick={() => onDelete(category)}
                    disabled={!canManage}
                    tone="danger"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  );
};
