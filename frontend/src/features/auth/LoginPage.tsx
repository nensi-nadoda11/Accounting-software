import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { loginSchema } from "./authSchemas";
import type { z } from "zod";
import { AuthShell } from "./AuthShell";
import { Button } from "../../components/ui/Button";
import { Checkbox } from "../../components/ui/Checkbox";
import { FormError } from "../../components/ui/FormError";
import { Input } from "../../components/ui/Input";
import { getErrorMessage } from "../../lib/errors";
import { useAuth } from "../../providers/useAuth";
import { useToast } from "../../providers/useToast";

type LoginValues = z.infer<typeof loginSchema>;

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const auth = useAuth();
  const [formError, setFormError] = useState<string>();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      rememberMe: true,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(undefined);

    try {
      await auth.login(values);
      toast.success("Login successful");
      navigate(location.state?.from || "/app");
    } catch (error) {
      setFormError(getErrorMessage(error, "Login failed"));
    }
  });

  return (
    <AuthShell
      title="Login"
      footer={
        <Link to="/register" className="text-sm font-medium text-emerald-700">
          Register
        </Link>
      }
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <FormError error={formError} />
        <Input label="Email or Mobile" {...form.register("identifier")} error={form.formState.errors.identifier?.message} />
        <Input
          label="Password"
          type="password"
          {...form.register("password")}
          error={form.formState.errors.password?.message}
        />
        <div className="flex items-center justify-between gap-4">
          <Checkbox label="Remember me" {...form.register("rememberMe")} />
          <Link to="/forgot-password" className="text-sm font-medium text-emerald-700">
            Forgot password
          </Link>
        </div>
        <Button type="submit" loading={form.formState.isSubmitting}>
          Login
        </Button>
      </form>
    </AuthShell>
  );
};

