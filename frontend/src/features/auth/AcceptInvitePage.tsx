import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { usersApi } from "../../services/usersApi";
import { useToast } from "../../providers/useToast";
import { AuthShell } from "./AuthShell";
import { acceptInviteSchema } from "./authSchemas";
import { Button } from "../../components/ui/Button";
import { FormError } from "../../components/ui/FormError";
import { Input } from "../../components/ui/Input";

type AcceptInviteValues = z.infer<typeof acceptInviteSchema>;

export const AcceptInvitePage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string | undefined>(!token ? "Invite token is missing" : undefined);
  const form = useForm<AcceptInviteValues>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) {
      return;
    }

    setFormError(undefined);
    try {
      await usersApi.acceptInvite({ token, ...values });
      toast.success("Invite accepted successfully");
      navigate("/login", { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error, "Invite acceptance failed"));
    }
  });

  return (
    <AuthShell
      title="Accept Invite"
      footer={
        <Link to="/login" className="text-sm font-medium text-emerald-700">
          Login
        </Link>
      }
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <FormError error={formError} />
        <Input label="Password" type="password" {...form.register("password")} error={form.formState.errors.password?.message} />
        <Input
          label="Confirm Password"
          type="password"
          {...form.register("confirmPassword")}
          error={form.formState.errors.confirmPassword?.message}
        />
        <Button type="submit" loading={form.formState.isSubmitting} disabled={!token}>
          Accept Invite
        </Button>
      </form>
    </AuthShell>
  );
};

