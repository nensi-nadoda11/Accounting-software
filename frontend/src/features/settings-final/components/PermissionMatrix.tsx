import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Checkbox } from "../../../components/ui/Checkbox";
import { Select } from "../../../components/ui/Select";
import type { PermissionKey, Role } from "../../../types/auth";
import type { PermissionMatrix as PermissionMatrixData } from "../../../types/settings";
import { toSortedPermissionSelection } from "../settingsFinalSchemas";

type Scope = "user" | "role";
type PermissionGroupView = {
  key: string;
  label: string;
  permissions: PermissionKey[];
};

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
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

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

  const groupedModules = useMemo<PermissionGroupView[]>(
    () => {
      const grouped = new Map<string, PermissionGroupView>();

      for (const group of matrix.groups) {
        const normalizedKey = group.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const existing = grouped.get(normalizedKey);

        if (!existing) {
          grouped.set(normalizedKey, {
            key: normalizedKey,
            label: group.label,
            permissions: [...group.permissions],
          });
          continue;
        }

        for (const permission of group.permissions) {
          if (!existing.permissions.includes(permission)) {
            existing.permissions.push(permission);
          }
        }
      }

      return Array.from(grouped.values());
    },
    [matrix.groups],
  );

  const visibleGroups = useMemo(
    () => groupedModules.filter((group) => moduleFilter === "all" || group.key === moduleFilter),
    [groupedModules, moduleFilter],
  );

  const groupedColumns = useMemo(
    () => visibleGroups.reduce<[PermissionGroupView[], PermissionGroupView[]]>(
      (columns, group, index) => {
        columns[index % 2].push(group);
        return columns;
      },
      [[], []],
    ),
    [visibleGroups],
  );

  useEffect(() => {
    setExpandedGroups((current) => current.filter((key) => visibleGroups.some((group) => group.key === key)));
  }, [visibleGroups]);

  useEffect(() => {
    if (moduleFilter === "all") {
      return;
    }

    setExpandedGroups(visibleGroups.map((group) => group.key));
  }, [moduleFilter, visibleGroups]);

  const togglePermission = (permission: PermissionKey) => {
    setDraftPermissions((current) =>
      current.includes(permission)
        ? current.filter((entry) => entry !== permission)
        : toSortedPermissionSelection([...current, permission]),
    );
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((current) =>
      current.includes(groupKey) ? current.filter((key) => key !== groupKey) : [...current, groupKey],
    );
  };

  const renderGroupCard = (group: PermissionGroupView) => (
    <div key={group.key} className="rounded-2xl border border-slate-200">
      <button
        type="button"
        onClick={() => toggleGroup(group.key)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{group.label}</p>
          <p className="mt-1 text-xs text-slate-500">{group.permissions.length} permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone="neutral">
            {group.permissions.filter((permission) => draftPermissions.includes(permission)).length}/{group.permissions.length}
          </Badge>
          {expandedGroups.includes(group.key) ? (
            <ChevronDown className="size-4 text-slate-400" />
          ) : (
            <ChevronRight className="size-4 text-slate-400" />
          )}
        </div>
      </button>

      {expandedGroups.includes(group.key) ? (
        <div className="grid gap-3 border-t border-slate-100 px-4 py-4 md:grid-cols-2">
          {group.permissions.map((permission) => (
            <Checkbox
              key={permission}
              label={permission}
              checked={draftPermissions.includes(permission)}
              onChange={() => togglePermission(permission)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );

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
            {groupedModules.map((group) => (
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

        <div className="grid gap-4 xl:grid-cols-2">
          {groupedColumns.map((column, columnIndex) => (
            <div key={columnIndex} className="space-y-4">
              {column.map((group) => renderGroupCard(group))}
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
