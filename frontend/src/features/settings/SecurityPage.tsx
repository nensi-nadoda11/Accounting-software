import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { ShieldCheck } from "lucide-react";

import { getErrorMessage } from "../../lib/errors";
import { authApi } from "../../services/authApi";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { changePasswordSchema } from "../auth/authSchemas";

type SecurityValues = z.infer<typeof changePasswordSchema>;

export const SecurityPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const form = useForm<SecurityValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Security" />
      <Card>
        <CardHeader title="Change Password" />
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Input
            label="Current Password"
            type="password"
            {...form.register("currentPassword")}
            error={form.formState.errors.currentPassword?.message}
          />
          <div />
          <Input
            label="New Password"
            type="password"
            {...form.register("newPassword")}
            error={form.formState.errors.newPassword?.message}
          />
          <Input
            label="Confirm Password"
            type="password"
            {...form.register("confirmPassword")}
            error={form.formState.errors.confirmPassword?.message}
          />
          <div className="md:col-span-2">
            <Button
              loading={form.formState.isSubmitting}
              onClick={form.handleSubmit(async (values) => {
                try {
                  await authApi.changePassword(values);
                  form.reset();
                  toast.success("Password changed successfully");
                } catch (error) {
                  toast.error(getErrorMessage(error, "Password change failed"));
                }
              })}
            >
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Sessions" />
        <CardContent>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Logout All Devices
          </Button>
        </CardContent>
      </Card>

      {auth.hasPermission(["audit.view", "audit.export", "backup.create", "backup.download", "backup.restore", "backup.delete"]) ? (
        <Card>
          <CardHeader title="Security Admin" />
          <CardContent className="flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
              <ShieldCheck className="size-4 text-emerald-600" />
              Audit logs, login history, backups, and restore controls
            </div>
            <Link
              to="/app/system/security-admin"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Open
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Logout All Devices"
        description="All active sessions will be revoked and you will need to login again."
        onConfirm={async () => {
          await auth.logoutAll();
          toast.success("All devices logged out");
          setConfirmOpen(false);
          window.location.href = "/login";
        }}
      />
    </div>
  );
};

