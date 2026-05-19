import { useEffect, useMemo, useState } from "react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Select } from "../../../components/ui/Select";
import type { PermissionKey, Role } from "../../../types/auth";
import type { PermissionMatrix as PermissionMatrixData } from "../../../types/settings";
import { toSortedPermissionSelection } from "../settingsFinalSchemas";

type Scope = "user" | "role";

export const PermissionMatrix = ({
  matrix,
  currentUserId,
  onSaveUser,
  onSaveRole,
  userSaving,
  roleSaving,
}: {
  matrix: PermissionMatrixData;
  currentUserId?: string;
  onSaveUser: (userId: string, permissions: PermissionKey[]) => Promise<void>;
  onSaveRole: (role: Role, permissions: PermissionKey[]) => Promise<void>;
  userSaving?: boolean;
  roleSaving?: boolean;
}) => {
  const [scope, setScope] = useState<Scope>("user");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<string>(matrix.users[0]?.id || "");
  const [selectedRole, setSelectedRole] = useState<Role>(matrix.roles[0]?.role || "admin");
  const [draftPermissions, setDraftPermissions] = useState<PermissionKey[]>([]);

  const selectedUser = useMemo(
    () => matrix.users.find((user) => user.id === selectedUserId) || null,
    [matrix.users, selectedUserId],
  );
  const selectedRoleRecord = useMemo(
    () => matrix.roles.find((role) => role.role === selectedRole) || null,
    [matrix.roles, selectedRole],
  );

  useEffect(() => {
    if (scope === "user" && selectedUser) {
      setDraftPermissions(toSortedPermissionSelection(selectedUser.permissions));
    }
  }, [scope, selectedUser]);

  useEffect(() => {
    if (scope === "role" && selectedRoleRecord) {
      setDraftPermissions(toSortedPermissionSelection(selectedRoleRecord.permissions));
    }
  }, [scope, selectedRoleRecord]);

  const visibleGroups = useMemo(
    () => matrix.groups.filter((group) => moduleFilter === "all" || group.key === moduleFilter),
    [matrix.groups, moduleFilter],
  );

  const togglePermission = (permission: PermissionKey) => {
    setDraftPermissions((current) =>
      current.includes(permission)
        ? current.filter((entry) => entry !== permission)
        : toSortedPermissionSelection([...current, permission]),
    );
  };

  return (
    <Card>
      <CardHeader
        title="Permission Matrix"
        action={
          <div className="flex gap-2">
            <Button variant={scope === "user" ? "primary" : "secondary"} onClick={() => setScope("user")}>
              User
            </Button>
            <Button variant={scope === "role" ? "primary" : "secondary"} onClick={() => setScope("role")}>
              Role
            </Button>
          </div>
        }
      />
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <Select label="Module" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="all">All Modules</option>
            {matrix.groups.map((group) => (
              <option key={group.key} value={group.key}>
                {group.label}
              </option>
            ))}
          </Select>
          {scope === "user" ? (
            <Select label="User" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              {matrix.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.role})
                </option>
              ))}
            </Select>
          ) : (
            <Select label="Role" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Role)}>
              {matrix.roles.map((role) => (
                <option key={role.role} value={role.role}>
                  {role.role}
                </option>
              ))}
            </Select>
          )}
          <div className="flex items-end">
            {scope === "user" && selectedUser ? (
              <Badge tone={selectedUser.id === currentUserId ? "warning" : "info"}>
                {selectedUser.id === currentUserId ? "Self Protection Active" : selectedUser.role}
              </Badge>
            ) : selectedRoleRecord ? (
              <Badge tone={selectedRole === "admin" ? "warning" : "info"}>{selectedRole}</Badge>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          {visibleGroups.map((group) => (
            <div key={group.key} className="rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-800">{group.label}</p>
                <Badge tone="neutral">
                  {group.permissions.filter((permission) => draftPermissions.includes(permission)).length}/{group.permissions.length}
                </Badge>
              </div>
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
                {group.permissions.map((permission) => (
                  <Checkbox
                    key={permission}
                    label={permission}
                    checked={draftPermissions.includes(permission)}
                    onChange={() => togglePermission(permission)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <Button
          loading={scope === "user" ? userSaving : roleSaving}
          onClick={async () => {
            if (scope === "user" && selectedUser) {
              await onSaveUser(selectedUser.id, draftPermissions);
            }

            if (scope === "role" && selectedRoleRecord) {
              await onSaveRole(selectedRoleRecord.role, draftPermissions);
            }
          }}
        >
          Save Permission Changes
        </Button>
      </CardContent>
    </Card>
  );
};
