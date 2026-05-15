import { useEffect, useState } from "react";

import { permissionsApi } from "../../services/permissionsApi";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { LoadingState } from "../../components/ui/LoadingState";
import { PageHeader } from "../../components/ui/PageHeader";
import type { PermissionKey, Role } from "../../types/auth";
import { Badge } from "../../components/ui/Badge";

export const RolesPermissionsPage = () => {
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState<{
    groups: Array<{ label: string; permissions: PermissionKey[] }>;
    defaults: Record<Role, PermissionKey[]>;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await permissionsApi.getRoleMatrix();
      setMatrix(response);
      setLoading(false);
    })();
  }, []);

  if (loading || !matrix) {
    return <LoadingState label="Loading permissions..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Roles & Permissions" />
      <Card>
        <CardHeader title="Default Role Matrix" />
        <CardContent className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Permission Group</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Admin</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Accountant</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Staff</th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">Auditor</th>
              </tr>
            </thead>
            <tbody>
              {matrix.groups.map((group) => (
                <tr key={group.label} className="align-top">
                  <td className="border-b border-slate-100 px-3 py-4 font-medium text-slate-900">{group.label}</td>
                  {(["admin", "accountant", "staff", "auditor"] as Role[]).map((role) => {
                    const count = group.permissions.filter((permission) => matrix.defaults[role].includes(permission)).length;
                    return (
                      <td key={role} className="border-b border-slate-100 px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={count ? "success" : "neutral"}>{count} / {group.permissions.length}</Badge>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
