import { useEffect, useState } from "react";
import { Pencil, RotateCcw, Plus, Star, Trash2 } from "lucide-react";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { bankApi } from "../../services/bankApi";
import { useToast } from "../../providers/ToastProvider";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TableWrapper } from "../../components/ui/Table";
import { TableActionIcons } from "../../components/ui/TableActionIcons";
import type { CompanyBankAccount, CompanyPaginatedResponse } from "../../types/company";
import { BankAccountModal } from "./components/BankAccountModal";
import { bankAccountSchema } from "./companySchemas";
import { maskAccountNumber } from "./companyUtils";

type BankAccountValues = z.infer<typeof bankAccountSchema>;

export const BankAccountsPage = () => {
  const toast = useToast();
  const [data, setData] = useState<CompanyPaginatedResponse<CompanyBankAccount> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CompanyBankAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingItem, setDeletingItem] = useState<CompanyBankAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [updatingDefaultId, setUpdatingDefaultId] = useState<string | null>(null);

  const loadBankAccounts = async () => {
    try {
      setLoading(true);
      const response = await bankApi.list({
        page,
        limit: 10,
        search: search || undefined,
        isActive: statusFilter === "all" ? undefined : statusFilter === "active",
      });
      setData(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load bank accounts"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBankAccounts();
  }, [page, search, statusFilter]);

  if (loading && !data) {
    return <LoadingState label="Loading bank accounts..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banks"
        actions={
          <Button
            onClick={() => {
              setSelectedItem(null);
              setModalOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Bank
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search bank accounts"
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
          />
          <Select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value as "all" | "active" | "inactive");
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
          <Button variant="secondary" onClick={() => void loadBankAccounts()}>
            <RotateCcw className="mr-2 size-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {!data?.items.length ? (
        <EmptyState
          title="No bank accounts found"
          action={
            <Button
              onClick={() => {
                setSelectedItem(null);
                setModalOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Add Bank
            </Button>
          }
        />
      ) : (
        <Card>
          <TableWrapper className="border-none">
            <Table>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Bank", "Account Holder", "Account Number", "IFSC", "Account Type", "Default", "Status", "Actions"].map((head) => (
                    <th key={head} className="px-5 py-3 font-semibold">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4 font-medium text-slate-900">{item.bankName}</td>
                    <td className="px-5 py-4">{item.accountHolderName}</td>
                    <td className="px-5 py-4">{maskAccountNumber(item.accountNumber)}</td>
                    <td className="px-5 py-4">{item.ifscCode}</td>
                    <td className="px-5 py-4">{item.accountType.replace("_", " ")}</td>
                    <td className="px-5 py-4">
                      {item.isDefault ? <StatusBadge status="default" label="Default" /> : "-"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.isActive ? "active" : "inactive"} label={item.isActive ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-5 py-4">
                      <TableActionIcons
                        actions={[
                          {
                            label: "Edit bank account",
                            icon: <Pencil className="size-4" />,
                            onClick: () => {
                              setSelectedItem(item);
                              setModalOpen(true);
                            },
                          },
                          {
                            label: item.isDefault ? "Default bank account" : "Set default bank account",
                            icon: <Star className="size-4" />,
                            disabled: item.isDefault || !item.isActive || updatingDefaultId === item.id,
                            onClick: async () => {
                              try {
                                setUpdatingDefaultId(item.id);
                                await bankApi.setDefault(item.id);
                                toast.success("Default bank account updated");
                                await loadBankAccounts();
                              } catch (error) {
                                toast.error(getErrorMessage(error, "Failed to set default bank account"));
                              } finally {
                                setUpdatingDefaultId(null);
                              }
                            },
                          },
                          {
                            label: "Delete bank account",
                            icon: <Trash2 className="size-4" />,
                            tone: "danger",
                            onClick: () => setDeletingItem(item),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
          <div className="border-t border-slate-100 px-5 py-4">
            <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />
          </div>
        </Card>
      )}

      <BankAccountModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedItem(null);
        }}
        initialValue={selectedItem}
        submitting={saving}
        onSubmit={async (values: BankAccountValues) => {
          try {
            setSaving(true);
            const payload = {
              bankName: values.bankName.trim(),
              accountHolderName: values.accountHolderName.trim(),
              accountNumber: values.accountNumber.trim(),
              ifscCode: values.ifscCode.trim().toUpperCase(),
              branchName: values.branchName.trim() || null,
              upiId: values.upiId.trim() || null,
              qrImageUrl: values.qrImageUrl.trim() || null,
              openingBalance: Number(values.openingBalance),
              accountType: values.accountType,
              isDefault: values.isDefault,
              isActive: values.isActive,
            };
            if (selectedItem) {
              await bankApi.update(selectedItem.id, payload);
              toast.success("Bank account updated");
            } else {
              await bankApi.create(payload);
              toast.success("Bank account created");
            }
            setModalOpen(false);
            setSelectedItem(null);
            await loadBankAccounts();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to save bank account"));
          } finally {
            setSaving(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        loading={deleting}
        title="Delete Bank Account"
        description={deletingItem ? `Delete ${deletingItem.bankName}?` : "Delete this bank account?"}
        onConfirm={async () => {
          if (!deletingItem) {
            return;
          }

          try {
            setDeleting(true);
            await bankApi.remove(deletingItem.id);
            toast.success("Bank account deleted");
            setDeletingItem(null);
            await loadBankAccounts();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to delete bank account"));
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
};
