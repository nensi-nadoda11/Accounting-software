import { useEffect, useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { branchApi } from "../../services/branchApi";
import { useToast } from "../../providers/useToast";
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
import type { CompanyBranch, CompanyPaginatedResponse } from "../../types/company";
import { BranchModal } from "./components/BranchModal";
import { branchSchema } from "./companySchemas";

type BranchValues = z.infer<typeof branchSchema>;

export const BranchesPage = () => {
  const toast = useToast();
  const [data, setData] = useState<CompanyPaginatedResponse<CompanyBranch> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CompanyBranch | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingItem, setDeletingItem] = useState<CompanyBranch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadBranches = async () => {
    try {
      setLoading(true);
      const response = await branchApi.list({
        page,
        limit: 10,
        search: search || undefined,
        isActive: statusFilter === "all" ? undefined : statusFilter === "active",
      });
      setData(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load branches"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBranches();
  }, [page, search, statusFilter]);

  if (loading && !data) {
    return <LoadingState label="Loading branches..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        actions={
          <Button
            onClick={() => {
              setSelectedItem(null);
              setModalOpen(true);
            }}
          >
            <Plus className="mr-2 size-4" />
            Add Branch
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
            placeholder="Search branches"
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
          <Button variant="secondary" onClick={() => void loadBranches()}>
            <RotateCcw className="mr-2 size-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {!data?.items.length ? (
        <EmptyState
          title="No branches found"
          action={
            <Button
              onClick={() => {
                setSelectedItem(null);
                setModalOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Add Branch
            </Button>
          }
        />
      ) : (
        <Card>
          <TableWrapper className="border-none">
            <Table>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Branch Name", "Code", "GST", "City", "Manager", "Status", "Actions"].map((head) => (
                    <th key={head} className="px-5 py-3 font-semibold">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4 font-medium text-slate-900">{item.branchName}</td>
                    <td className="px-5 py-4">{item.branchCode}</td>
                    <td className="px-5 py-4">{item.gstNumber || "-"}</td>
                    <td className="px-5 py-4">{item.city || "-"}</td>
                    <td className="px-5 py-4">{item.managerName || "-"}</td>
                    <td className="px-5 py-4">
                      <StatusBadge status={item.isActive ? "active" : "inactive"} label={item.isActive ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-5 py-4">
                      <TableActionIcons
                        actions={[
                          {
                            label: "Edit branch",
                            icon: <Pencil className="size-4" />,
                            onClick: () => {
                              setSelectedItem(item);
                              setModalOpen(true);
                            },
                          },
                          {
                            label: "Delete branch",
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

      <BranchModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedItem(null);
        }}
        initialValue={selectedItem}
        submitting={saving}
        onSubmit={async (values: BranchValues) => {
          try {
            setSaving(true);
            const payload = {
              branchName: values.branchName.trim(),
              branchCode: values.branchCode.trim().toUpperCase(),
              gstNumber: values.gstNumber.trim() || null,
              email: values.email.trim() || null,
              mobileNumber: values.mobileNumber.trim() || null,
              addressLine1: values.addressLine1.trim() || null,
              addressLine2: values.addressLine2.trim() || null,
              city: values.city.trim() || null,
              state: values.state.trim() || null,
              pincode: values.pincode.trim() || null,
              managerName: values.managerName.trim() || null,
              isActive: values.isActive,
            };
            if (selectedItem) {
              await branchApi.update(selectedItem.id, payload);
              toast.success("Branch updated");
            } else {
              await branchApi.create(payload);
              toast.success("Branch created");
            }
            setModalOpen(false);
            setSelectedItem(null);
            await loadBranches();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to save branch"));
          } finally {
            setSaving(false);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        loading={deleting}
        title="Delete Branch"
        description={deletingItem ? `Delete ${deletingItem.branchName}?` : "Delete this branch?"}
        onConfirm={async () => {
          if (!deletingItem) {
            return;
          }

          try {
            setDeleting(true);
            await branchApi.remove(deletingItem.id);
            toast.success("Branch deleted");
            setDeletingItem(null);
            await loadBranches();
          } catch (error) {
            toast.error(getErrorMessage(error, "Failed to delete branch"));
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
};

