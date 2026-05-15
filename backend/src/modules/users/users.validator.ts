import { z } from "zod";

import { ALL_PERMISSIONS } from "../permissions/permission.constants";
import { indianMobileRegex, paginationQuerySchema, passwordSchema } from "../../validators/common.validator";

export const inviteUserSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.email().transform((value) => value.toLowerCase()),
  mobileNumber: z.string().regex(indianMobileRegex, "Invalid Indian mobile number").optional(),
  role: z.enum(["accountant", "staff", "auditor"]),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional().default([])
});

export const acceptInviteSchema = z
  .object({
    token: z.string().min(32),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Confirm password must match password"
  });

export const resendInviteSchema = z.object({
  inviteId: z.string().uuid()
});

export const revokeInviteSchema = z.object({
  inviteId: z.string().uuid()
});

export const usersListQuerySchema = paginationQuerySchema.extend({
  role: z.enum(["admin", "accountant", "staff", "auditor"]).optional(),
  status: z.enum(["pending_verification", "invited", "active", "suspended", "disabled"]).optional()
});

export const userIdParamSchema = z.object({
  id: z.string().uuid()
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["active", "suspended", "disabled"])
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "accountant", "staff", "auditor"])
});

export const updateUserPermissionsSchema = z.object({
  permissions: z.array(z.enum(ALL_PERMISSIONS)).default([])
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  mobileNumber: z.string().regex(indianMobileRegex, "Invalid Indian mobile number").nullable().optional()
});
