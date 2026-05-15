import { useLocation } from "react-router-dom";

import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { useAuth } from "../../providers/AuthProvider";

const menuLabels: Record<string, string> = {
  dashboard: "Dashboard",
  accounting: "Accounting",
  sales: "Sales",
  purchases: "Purchases",
  inventory: "Inventory",
  reports: "Reports",
};

export const DashboardPage = () => {
  const location = useLocation();
  const { user, company } = useAuth();
  const activeMenu = new URLSearchParams(location.search).get("menu") || "dashboard";

  return (
    <div className="space-y-6">
      <PageHeader title={menuLabels[activeMenu] || "Dashboard"} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Company" />
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{company?.name || "Not available"}</p>
            <p>{company?.city || "City not set"}</p>
            <p>{company?.state || "State not set"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Current User" />
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p className="font-medium text-slate-800">{user?.fullName}</p>
            <p>{user?.email}</p>
            <p className="capitalize">{user?.role}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Workspace Status" />
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p className="font-medium capitalize text-slate-800">{company?.status?.replace("_", " ")}</p>
            <p>{menuLabels[activeMenu] || "Dashboard"} module home</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
