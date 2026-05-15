import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { authApi } from "../../services/authApi";
import { getOtpCooldown, setOtpCooldown } from "../../lib/otp-cooldown";
import { useToast } from "../../providers/ToastProvider";
import { AuthShell } from "./AuthShell";
import { verifyOtpSchema } from "./authSchemas";
import { Button } from "../../components/ui/Button";
import { FormError } from "../../components/ui/FormError";
import { Input } from "../../components/ui/Input";

type VerifyOtpValues = z.infer<typeof verifyOtpSchema>;

export const VerifyOtpPage = () => {
  const [params] = useSearchParams();
  const emailFromQuery = params.get("email") || "";
  const toast = useToast();
  const [formError, setFormError] = useState<string>();
  const [cooldown, setCooldown] = useState(() => getOtpCooldown(emailFromQuery, "register"));

  useEffect(() => {
    if (!cooldown) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const form = useForm<VerifyOtpValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: {
      email: emailFromQuery,
      otp: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await authApi.verifyOtp({ ...values, purpose: "register" });
      toast.success("OTP verified successfully");
      window.location.href = "/login";
    } catch (error) {
      setFormError(getErrorMessage(error, "OTP verification failed"));
    }
  });

  const handleResend = async () => {
    const email = form.getValues("email");
    if (!email) {
      setFormError("Enter your email first");
      return;
    }

    try {
      await authApi.resendOtp({ email, purpose: "register" });
      setOtpCooldown(email, "register", 60);
      setCooldown(60);
      toast.success("OTP resent successfully");
    } catch (error) {
      setFormError(getErrorMessage(error, "Failed to resend OTP"));
    }
  };

  return (
    <AuthShell
      title="Verify OTP"
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
        <div className="flex items-center justify-between gap-4">
          <Button type="submit" loading={form.formState.isSubmitting}>
            Verify OTP
          </Button>
          <Button type="button" variant="secondary" onClick={handleResend} disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
};
