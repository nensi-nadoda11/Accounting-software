import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ShieldCheck, UserCog } from "lucide-react";

import { getErrorMessage } from "../../lib/errors";
import { ROLE_LABELS } from "../../constants/permissions";
import { usersApi } from "../../services/usersApi";
import type { PaginatedUsersResponse } from "../../types/api";
import type { PermissionKey, Role, User, UserStatus } from "../../types/auth";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingState } from "../../components/ui/LoadingState";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Pagination } from "../../components/ui/Pagination";
import { Select } from "../../components/ui/Select";
import { Table, TableWrapper } from "../../components/ui/Table";
import { PermissionCheckboxGrid } from "./components/PermissionCheckboxGrid";

const statusTone: Record<UserStatus, "neutral" | "success" | "warning" | "danger" | "info"> = {
  pending_verification: "warning",
  invited: "info",
  active: "success",
  suspended: "warning",
  disabled: "danger",
};

export const UsersPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [data, setData] = useState<PaginatedUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("");
  const [selectedUser, setSelectedUser] = useState<(User & { permissions: PermissionKey[] }) | null>(null);
  const [roleDraft, setRoleDraft] = useState<Role>("staff");
  const [statusDraft, setStatusDraft] = useState<Extract<UserStatus, "active" | "suspended" | "disabled">>("active");
  const [permissionDraft, setPermissionDraft] = useState<PermissionKey[]>([]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersApi.list({
        page,
        limit: 10,
        search,
        role: roleFilter,
        status: statusFilter,
      });
      setData(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, [page, roleFilter, search, statusFilter]);

  const canManage = auth.hasPermission("user.manage");

  const selectedActions = useMemo(() => {
    if (!selectedUser) {
      return null;
    }

    return {
      canEditRole: selectedUser.id !== auth.user?.id,
      canEditStatus: selectedUser.id !== auth.user?.id,
    };
  }, [auth.user?.id, selectedUser]);

  if (loading && !data) {
    return <LoadingState label="Loading users..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Users" />
      <Card>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search"
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
          />
          <Select
            value={roleFilter}
            onChange={(event) => {
              setPage(1);
              setRoleFilter(event.target.value as Role | "");
            }}
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="accountant">Accountant</option>
            <option value="staff">Staff</option>
            <option value="auditor">Auditor</option>
          </Select>
          <Select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value as UserStatus | "");
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="invited">Invited</option>
            <option value="suspended">Suspended</option>
            <option value="disabled">Disabled</option>
          </Select>
          <Button variant="secondary" onClick={() => void fetchUsers()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      {!data?.items.length ? (
        <EmptyState title="No users found" />
      ) : (
        <Card>
          <TableWrapper className="border-none">
            <Table>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {["Name", "Email", "Mobile", "Role", "Status", "Last Login", "Actions"].map((head) => (
                    <th key={head} className="px-5 py-3 font-semibold">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-4 font-medium text-slate-900">{item.fullName}</td>
                    <td className="px-5 py-4">{item.email}</td>
                    <td className="px-5 py-4">{item.mobileNumber || "-"}</td>
                    <td className="px-5 py-4">{ROLE_LABELS[item.role]}</td>
                    <td className="px-5 py-4">
                      <Badge tone={statusTone[item.status]}>{item.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-5 py-4">{item.lastLoginAt ? format(new Date(item.lastLoginAt), "dd MMM yyyy, hh:mm a") : "-"}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={!canManage || item.id === auth.user?.id}
                          onClick={() => {
                            setSelectedUser(item);
                            setRoleDraft(item.role);
                          }}
                        >
                          <UserCog className="mr-2 size-4" />
                          Role
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={!canManage || item.id === auth.user?.id}
                          onClick={() => {
                            setSelectedUser(item);
                            setStatusDraft(item.status === "active" || item.status === "suspended" || item.status === "disabled" ? item.status : "active");
                          }}
                        >
                          Status
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={!canManage}
                          onClick={() => {
                            setSelectedUser(item);
                            setPermissionDraft(item.permissions);
                          }}
                        >
                          <ShieldCheck className="mr-2 size-4" />
                          Permissions
                        </Button>
                      </div>
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

      <Modal
        open={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={selectedUser ? `${selectedUser.fullName}` : "User"}
      >
        {selectedUser ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Role</h3>
                  <Badge tone="info">{ROLE_LABELS[selectedUser.role]}</Badge>
                </div>
                <Select value={roleDraft} onChange={(event) => setRoleDraft(event.target.value as Role)} disabled={!selectedActions?.canEditRole}>
                  <option value="admin">Admin</option>
                  <option value="accountant">Accountant</option>
                  <option value="staff">Staff</option>
                  <option value="auditor">Auditor</option>
                </Select>
                <Button
                  disabled={!selectedActions?.canEditRole}
                  onClick={async () => {
                    try {
                      await usersApi.updateRole(selectedUser.id, roleDraft);
                      toast.success("Role updated");
                      setSelectedUser(null);
                      await fetchUsers();
                    } catch (error) {
                      toast.error(getErrorMessage(error, "Role update failed"));
                    }
                  }}
                >
                  Save Role
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Status</h3>
                  <Badge tone={statusTone[selectedUser.status]}>{selectedUser.status.replace("_", " ")}</Badge>
                </div>
                <Select
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as Extract<UserStatus, "active" | "suspended" | "disabled">)}
                  disabled={!selectedActions?.canEditStatus}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="disabled">Disabled</option>
                </Select>
                <Button
                  disabled={!selectedActions?.canEditStatus}
                  onClick={async () => {
                    try {
                      await usersApi.updateStatus(selectedUser.id, statusDraft);
                      toast.success("Status updated");
                      setSelectedUser(null);
                      await fetchUsers();
                    } catch (error) {
                      toast.error(getErrorMessage(error, "Status update failed"));
                    }
                  }}
                >
                  Save Status
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Custom Permissions</h3>
                <PermissionCheckboxGrid selected={permissionDraft} onChange={setPermissionDraft} />
                <Button
                  onClick={async () => {
                    try {
                      await usersApi.updatePermissions(selectedUser.id, permissionDraft);
                      toast.success("Permissions updated");
                      setSelectedUser(null);
                      await fetchUsers();
                    } catch (error) {
                      toast.error(getErrorMessage(error, "Permissions update failed"));
                    }
                  }}
                >
                  Save Permissions
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
