import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { authApi } from "../../services/authApi";
import { useToast } from "../../providers/useToast";
import { AuthShell } from "./AuthShell";
import { forgotPasswordSchema } from "./authSchemas";
import { Button } from "../../components/ui/Button";
import { FormError } from "../../components/ui/FormError";
import { Input } from "../../components/ui/Input";

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string>();
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      identifier: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await authApi.forgotPassword(values);
      toast.success("If account exists, reset instructions have been sent.");
      navigate(`/reset-password?email=${encodeURIComponent(values.identifier)}`);
    } catch (error) {
      setFormError(getErrorMessage(error, "Request failed"));
    }
  });

  return (
    <AuthShell
      title="Forgot Password"
      footer={
        <Link to="/login" className="text-sm font-medium text-emerald-700">
          Login
        </Link>
      }
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <FormError error={formError} />
        <Input label="Email or Mobile" {...form.register("identifier")} error={form.formState.errors.identifier?.message} />
        <Button type="submit" loading={form.formState.isSubmitting}>
          Send Reset OTP
        </Button>
      </form>
    </AuthShell>
  );
};

