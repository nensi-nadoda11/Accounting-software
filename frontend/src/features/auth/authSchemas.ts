import { z } from "zod";

const indianMobileRegex = /^[6-9]\d{9}$/;
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const passwordSchema = z
  .string()
  .min(8, "Minimum 8 characters")
  .regex(strongPasswordRegex, "Use uppercase, lowercase, number and special character");

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    email: z.email(),
    mobileNumber: z.string().regex(indianMobileRegex, "Enter valid Indian mobile number"),
    password: passwordSchema,
    confirmPassword: z.string(),
    companyName: z.string().trim().min(2).max(150),
    gstNumber: z.string().trim().optional().refine((value) => !value || gstRegex.test(value), "Invalid GST number"),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    termsAccepted: z.boolean().refine((value) => value, "Accept terms to continue"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email or mobile is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export const verifyOtpSchema = z.object({
  email: z.email(),
  otp: z.string().regex(/^\d{6}$/, "Enter 6 digit OTP"),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, "Email or mobile is required"),
});

export const resetPasswordSchema = z
  .object({
    email: z.email(),
    otp: z.string().regex(/^\d{6}$/, "Enter 6 digit OTP"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const acceptInviteSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
