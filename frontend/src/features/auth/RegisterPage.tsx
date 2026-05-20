import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { getErrorMessage } from "../../lib/errors";
import { authApi } from "../../services/authApi";
import { useToast } from "../../providers/useToast";
import { AuthShell } from "./AuthShell";
import { registerSchema } from "./authSchemas";
import { Button } from "../../components/ui/Button";
import { Checkbox } from "../../components/ui/Checkbox";
import { FormError } from "../../components/ui/FormError";
import { Input } from "../../components/ui/Input";

type RegisterValues = z.infer<typeof registerSchema>;

export const RegisterPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState<string>();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      mobileNumber: "",
      password: "",
      confirmPassword: "",
      companyName: "",
      gstNumber: "",
      city: "",
      state: "",
      termsAccepted: true,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(undefined);
    try {
      await authApi.register({
        ...values,
        email: values.email.toLowerCase(),
      });
      toast.success("Registration submitted. Verify OTP to continue.");
      navigate(`/verify-otp?email=${encodeURIComponent(values.email)}&purpose=register`);
    } catch (error) {
      setFormError(getErrorMessage(error, "Registration failed"));
    }
  });

  return (
    <AuthShell
      title="Register Admin Account"
      footer={
        <Link to="/login" className="text-sm font-medium text-emerald-700">
          Login
        </Link>
      }
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <div className="md:col-span-2">
          <FormError error={formError} />
        </div>
        <Input label="Full Name" {...form.register("fullName")} error={form.formState.errors.fullName?.message} />
        <Input label="Email" type="email" {...form.register("email")} error={form.formState.errors.email?.message} />
        <Input
          label="Mobile Number"
          inputMode="numeric"
          {...form.register("mobileNumber")}
          error={form.formState.errors.mobileNumber?.message}
        />
        <Input label="Company Name" {...form.register("companyName")} error={form.formState.errors.companyName?.message} />
        <Input
          label="Password"
          type="password"
          {...form.register("password")}
          error={form.formState.errors.password?.message}
        />
        <Input
          label="Confirm Password"
          type="password"
          {...form.register("confirmPassword")}
          error={form.formState.errors.confirmPassword?.message}
        />
        <Input label="GST Number" {...form.register("gstNumber")} error={form.formState.errors.gstNumber?.message} />
        <Input label="City" {...form.register("city")} error={form.formState.errors.city?.message} />
        <Input label="State" {...form.register("state")} error={form.formState.errors.state?.message} />
        <div className="md:col-span-2">
          <Checkbox label="I accept the terms and conditions" {...form.register("termsAccepted")} />
          {form.formState.errors.termsAccepted?.message ? (
            <span className="mt-2 block text-xs text-rose-600">{form.formState.errors.termsAccepted.message}</span>
          ) : null}
        </div>
        <div className="md:col-span-2">
          <Button type="submit" loading={form.formState.isSubmitting} className="w-full">
            Create Account
          </Button>
        </div>
      </form>
    </AuthShell>
  );
};

