import { z } from "zod";

export const indianMobileRegex = /^[6-9]\d{9}$/;
export const gstRegex =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  search: z.string().trim().optional()
});

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(strongPasswordRegex, "Password must include uppercase, lowercase, number and special character");
