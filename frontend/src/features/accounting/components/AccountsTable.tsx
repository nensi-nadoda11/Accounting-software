import { Eye, Pencil, Trash2 } from "lucide-react";

import { EmptyState } from "../../../components/ui/EmptyState";
import { TableActionIcons } from "../../../components/ui/TableActionIcons";
import { Table, TableWrapper } from "../../../components/ui/Table";
import { AmountText } from "../../../components/ui/AmountText";
import { Badge } from "../../../components/ui/Badge";
import { InlineErrorState } from "../../../components/ui/InlineErrorState";
import { LoadingState } from "../../../components/ui/LoadingState";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import type { Account } from "../../../types/accounting";
import { accountTypeLabels, balanceSideTone, flattenAccounts, normalBalanceLabels } from "../accountingUtils";

export const AccountsTable = ({
  items,
  hierarchy,
  loading,
  error,
  canManage,
  onView,
  onEdit,
  onDelete,
}: {
  items: Account[];
  hierarchy: boolean;
  loading: boolean;
  error?: string | null;
  canManage: boolean;
  onView: (account: Account) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) => {
  if (loading) {
    return <LoadingState label="Loading accounts..." />;
  }

  if (error && !items.length) {
    return <InlineErrorState title={error} />;
  }

  if (!items.length) {
    return <EmptyState title="No accounts found." />;
  }

  const rows = hierarchy ? flattenAccounts(items) : items.map((item) => ({ ...item, depth: 0 }));

  return (
    <TableWrapper>
      <Table>
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {["Code", "Account Name", "Type", "Normal Balance", "Opening Balance", "Current Balance", "Status", "Actions"].map((head) => (
              <th key={head} className="px-4 py-3 font-semibold">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
          {rows.map((account) => (
            <tr key={account.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{account.accountCode}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span style={{ paddingLeft: `${account.depth * 16}px` }} className="font-medium text-slate-900">
                    {account.accountName}
                  </span>
                  {account.isSystem ? <Badge tone="info">System</Badge> : null}
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge tone="neutral">{accountTypeLabels[account.accountType]}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={balanceSideTone(account.normalBalance)}>{normalBalanceLabels[account.normalBalance]}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <AmountText value={account.openingBalance} />
                  {account.openingBalanceType !== "none" ? <Badge tone={balanceSideTone(account.openingBalanceType)}>{account.openingBalanceType}</Badge> : null}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <AmountText value={account.currentBalance} />
                  <Badge tone={balanceSideTone(account.currentBalanceSide)}>{account.currentBalanceSide}</Badge>
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={account.status} label={account.status} />
              </td>
              <td className="px-4 py-3">
                <TableActionIcons
                  actions={[
                    {
                      label: "View account",
                      icon: <Eye className="size-4" />,
                      onClick: () => onView(account),
                    },
                    {
                      label: "Edit account",
                      icon: <Pencil className="size-4" />,
                      onClick: () => onEdit(account),
                      disabled: !canManage || account.status === "deleted",
                    },
                    {
                      label: account.isSystem ? "System account cannot be deleted" : "Delete account",
                      icon: <Trash2 className="size-4" />,
                      onClick: () => onDelete(account),
                      disabled: !canManage || account.isSystem || account.status === "deleted",
                      tone: "danger",
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrapper>
  );
};
