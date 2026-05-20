import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { profileApi } from "../../services/profileApi";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { updateProfileSchema } from "./settingsSchemas";

type ProfileValues = z.infer<typeof updateProfileSchema>;

export const ProfilePage = () => {
  const auth = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      fullName: auth.user?.fullName || "",
      mobileNumber: auth.user?.mobileNumber || "",
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" />
      <Card>
        <CardHeader title="Account Details" />
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Input label="Full Name" {...form.register("fullName")} error={form.formState.errors.fullName?.message} />
          <Input
            label="Mobile Number"
            inputMode="numeric"
            {...form.register("mobileNumber")}
            error={form.formState.errors.mobileNumber?.message}
          />
          <Input label="Email" value={auth.user?.email || ""} readOnly />
          <Input label="Role" value={auth.user?.role || ""} readOnly />
          <Input label="Company" value={auth.company?.name || ""} readOnly />
          <Input label="GST Number" value={auth.company?.gstNumber || ""} readOnly />
          <div className="md:col-span-2">
            <Button
              loading={submitting}
              onClick={form.handleSubmit(async (values) => {
                try {
                  setSubmitting(true);
                  const response = await profileApi.update({
                    fullName: values.fullName,
                    mobileNumber: values.mobileNumber || null,
                  });
                  auth.updateUser(response.data.user);
                  toast.success("Profile updated");
                } catch (error) {
                  toast.error(getErrorMessage(error, "Profile update failed"));
                } finally {
                  setSubmitting(false);
                }
              })}
            >
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

