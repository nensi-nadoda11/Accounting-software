import { z } from "zod";

import { ALL_PERMISSIONS } from "../../constants/permissions";

const indianMobileRegex = /^[6-9]\d{9}$/;

export const inviteSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.email(),
  mobileNumber: z.string().optional().refine((value) => !value || indianMobileRegex.test(value), "Enter valid Indian mobile number"),
  role: z.enum(["accountant", "staff", "auditor"]),
  permissions: z.array(z.enum(ALL_PERMISSIONS)),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  mobileNumber: z.string().optional().refine((value) => !value || indianMobileRegex.test(value), "Enter valid Indian mobile number"),
});

export const updatePermissionsSchema = z.object({
  permissions: z.array(z.enum(ALL_PERMISSIONS)),
});
