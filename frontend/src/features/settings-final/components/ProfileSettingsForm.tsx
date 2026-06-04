import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, KeyRound, LogOut } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "../../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { formatDateTime } from "../../customers/customerUtils";
import type { ProfileSettings } from "../../../types/settings";
import { passwordChangeSchema, profileSettingsSchema } from "../settingsFinalSchemas";

type ProfileValues = z.infer<typeof profileSettingsSchema>;
type PasswordValues = z.infer<typeof passwordChangeSchema>;

export const ProfileSettingsForm = ({
  value,
  saving,
  passwordSaving,
  logoutAllLoading,
  onSubmit,
  onChangePassword,
  onLogoutAll,
}: {
  value: ProfileSettings;
  saving?: boolean;
  passwordSaving?: boolean;
  logoutAllLoading?: boolean;
  onSubmit: (value: ProfileValues) => Promise<void>;
  onChangePassword: (value: PasswordValues) => Promise<void>;
  onLogoutAll: () => Promise<void>;
}) => {
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSettingsSchema),
    values: {
      fullName: value.user.fullName,
      mobileNumber: value.user.mobileNumber || "",
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
      <Card>
        <CardHeader title="Profile Settings" />
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Full Name" {...profileForm.register("fullName")} error={profileForm.formState.errors.fullName?.message} />
            <Input label="Mobile Number" {...profileForm.register("mobileNumber")} error={profileForm.formState.errors.mobileNumber?.message} />
            <Input label="Email" value={value.user.email} readOnly />
            <Input label="Role" value={value.user.role} readOnly />
            <Input label="Company" value={value.company?.name || "-"} readOnly />
            <Input
              label="Last Login"
              value={value.session.lastLoginAt ? formatDateTime(value.session.lastLoginAt) : "-"}
              readOnly
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button loading={saving} onClick={profileForm.handleSubmit(async (nextValue) => onSubmit(nextValue))}>
              Save Profile
            </Button>
            <Button variant="secondary" onClick={() => window.location.assign("/app/system/notifications")}>
              <Bell className="mr-2 size-4" />
              Notifications
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Change Password" />
          <CardContent className="space-y-4">
            <Input type="password" label="Current Password" {...passwordForm.register("currentPassword")} error={passwordForm.formState.errors.currentPassword?.message} />
            <Input type="password" label="New Password" {...passwordForm.register("newPassword")} error={passwordForm.formState.errors.newPassword?.message} />
            <Input type="password" label="Confirm Password" {...passwordForm.register("confirmPassword")} error={passwordForm.formState.errors.confirmPassword?.message} />
            <Button loading={passwordSaving} onClick={passwordForm.handleSubmit(async (nextValue) => onChangePassword(nextValue))}>
              <KeyRound className="mr-2 size-4" />
              Update Password
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Security Actions" />
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Use this when you need to invalidate every active browser session for your account.</p>
            <Button variant="danger" loading={logoutAllLoading} onClick={async () => onLogoutAll()}>
              <LogOut className="mr-2 size-4" />
              Logout All Devices
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
