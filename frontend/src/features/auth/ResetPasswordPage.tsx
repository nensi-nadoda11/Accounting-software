import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { authApi } from "../../services/authApi";
import { useToast } from "../../providers/ToastProvider";
import { AuthShell } from "./AuthShell";
import { resetPasswordSchema } from "./authSchemas";
import { Button } from "../../components/ui/Button";
import { FormError } from "../../components/ui/FormError";
import { Input } from "../../components/ui/Input";

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const toast = useToast();
  const [formError, setFormError] = useState<string>();
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: params.get("email") || "",
      otp: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await authApi.resetPassword(values);
      toast.success("Password reset successful");
      window.location.href = "/login";
    } catch (error) {
      setFormError(getErrorMessage(error, "Reset failed"));
    }
  });

  return (
    <AuthShell
      title="Reset Password"
      footer={
        <Link to="/login" className="text-sm font-medium text-emerald-700">
          Login
        </Link>
      }
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <FormError error={formError} />
        <Input label="Email" type="email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <Input label="OTP" inputMode="numeric" maxLength={6} {...form.register("otp")} error={form.formState.errors.otp?.message} />
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
        <Button type="submit" loading={form.formState.isSubmitting}>
          Reset Password
        </Button>
      </form>
    </AuthShell>
  );
};
