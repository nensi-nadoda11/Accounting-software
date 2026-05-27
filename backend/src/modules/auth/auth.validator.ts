import { z } from "zod";

import { gstRegex, indianMobileRegex, passwordSchema } from "../../validators/common.validator";

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    email: z.email().transform((value) => value.toLowerCase()),
    mobileNumber: z.string().regex(indianMobileRegex, "Invalid Indian mobile number"),
    password: passwordSchema,
    confirmPassword: z.string(),
    companyName: z.string().trim().min(2).max(150),
    gstNumber: z
      .string()
      .trim()
      .regex(gstRegex, "Invalid GST number")
      .optional()
      .or(z.literal("")),
    city: z.string().trim().max(80).optional().or(z.literal("")),
    state: z.string().trim().max(80).optional().or(z.literal("")),
    termsAccepted: z.literal(true)
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Confirm password must match password"
  });

export const verifyOtpSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  purpose: z.enum(["register", "forgot_password", "change_email"])
});

export const resendOtpSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  purpose: z.enum(["register", "forgot_password", "change_email"])
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(true)
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1)
});

export const resetPasswordSchema = z
  .object({
    email: z.email().transform((value) => value.toLowerCase()),
    otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
    newPassword: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Confirm password must match new password"
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Confirm password must match new password"
  });
